import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { DomainError } from './domain/errors/DomainError.js';
import { createContainer } from './container.js';
import { PubSubBroker } from './infrastructure/redis/PubSubBroker.js';

// ─── Room → connected clients map ─────────────────────────────────────────────
// roomCode → Map<playerId, WebSocket>
const roomSessions = new Map<string, Map<string, WebSocket>>();

// Broker is wired in bootstrap(). Until then, broadcast falls back to local
// fanout so unit tests and pre-listen code paths still work.
let broker: PubSubBroker | null = null;

function localFanout(roomCode: string, payload: unknown, excludePlayerId?: string): void {
  const room = roomSessions.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const [pid, ws] of room) {
    if (pid === excludePlayerId) continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function broadcast(roomCode: string, payload: unknown, excludePlayerId?: string): void {
  if (broker !== null) {
    void broker.publish(roomCode, payload, excludePlayerId);
  } else {
    localFanout(roomCode, payload, excludePlayerId);
  }
}

/**
 * Strip the PRNG seed from the ladder before sending to clients.
 * The visual structure (rowCount, colCount, segments) is needed by the
 * renderer to draw the grid. Only seed + seedSource are stripped to prevent
 * clients from running ComputeResults locally to pre-determine outcomes.
 */
function sanitizeRoomForClient<T extends { ladder?: unknown }>(room: T): T {
  const r = room as Record<string, unknown>;
  if (r['ladder'] && typeof r['ladder'] === 'object') {
    const { seed: _seed, seedSource: _seedSource, ...ladderRest } = r['ladder'] as Record<string, unknown>;
    return { ...r, ladder: ladderRest } as T;
  }
  return room;
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

const jwtSecretRaw = process.env['JWT_SECRET'];
if (!jwtSecretRaw || jwtSecretRaw.trim() === '') {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'Generate one with: openssl rand -hex 64'
  );
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

interface JwtClaims {
  playerId: string;
  roomCode: string;
  role: 'host' | 'player';
}

async function signToken(claims: JwtClaims): Promise<string> {
  return new SignJWT({ playerId: claims.playerId, roomCode: claims.roomCode, role: claims.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('6h')
    .sign(JWT_SECRET);
}

async function verifyToken(token: string): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const playerId = payload['playerId'];
  const roomCode = payload['roomCode'];
  const role = payload['role'];

  if (typeof playerId !== 'string' || typeof roomCode !== 'string') {
    throw new Error('Invalid token claims');
  }
  if (role !== 'host' && role !== 'player') {
    throw new Error('Invalid token role');
  }

  return { playerId, roomCode, role };
}

function extractBearer(authHeader: string | undefined): string | null {
  if (authHeader === undefined) return null;
  const parts = authHeader.split(' ');
  if (parts[0]?.toLowerCase() !== 'bearer' || parts[1] === undefined) return null;
  return parts[1];
}

async function requireAuth(
  authHeader: string | undefined
): Promise<{ claims: JwtClaims; error: null } | { claims: null; error: string }> {
  const token = extractBearer(authHeader);
  if (token === null) return { claims: null, error: 'AUTH_MISSING_TOKEN' };
  try {
    const claims = await verifyToken(token);
    return { claims, error: null };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return { claims: null, error: 'AUTH_TOKEN_EXPIRED' };
    }
    return { claims: null, error: 'AUTH_INVALID_TOKEN' };
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const app = Fastify({ logger: true });
  const { repo, roomService, gameService, redis } = createContainer();

  // ─── Plugins ───────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin:
      process.env['NODE_ENV'] === 'production'
        ? (process.env['ALLOWED_ORIGINS'] ?? '').split(',').filter(Boolean)
        : true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // ─── Error handler ─────────────────────────────────────────────────────────

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof DomainError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    }
    app.log.error(err);
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  // ─── Health / Readiness ────────────────────────────────────────────────────

  app.get('/health', async (_req, reply) => {
    let redisOk = false;
    try { await redis.ping(); redisOk = true; } catch { /* ignore */ }
    const wsCount = [...roomSessions.values()].reduce((sum, m) => sum + m.size, 0);
    return reply.status(200).send({
      status: 'ok',
      redis: redisOk ? 'ok' : 'unavailable',
      wsCount,
      uptime: Math.floor(process.uptime()),
    });
  });

  app.get('/ready', async (_req, reply) => {
    try {
      await redis.ping();
      return reply.status(200).send({ status: 'ok' });
    } catch {
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  // ─── POST /api/rooms ───────────────────────────────────────────────────────

  app.post('/api/rooms', async (req, reply) => {
    const body = req.body as { hostNickname?: unknown; winnerCount?: unknown };
    const hostNickname = typeof body.hostNickname === 'string' ? body.hostNickname : undefined;
    const winnerCount = typeof body.winnerCount === 'number' ? body.winnerCount : undefined;

    if (hostNickname === undefined || winnerCount === undefined) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'hostNickname (string) and winnerCount (number) are required',
      });
    }

    const { room, hostId } = await roomService.createRoom(hostNickname, winnerCount);
    const token = await signToken({ playerId: hostId, roomCode: room.code, role: 'host' });

    return reply.status(201).send({ roomCode: room.code, playerId: hostId, token, room: sanitizeRoomForClient(room) });
  });

  // ─── GET /api/rooms/:code ──────────────────────────────────────────────────

  app.get('/api/rooms/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const room = await repo.findByCode(code);
    if (room === null) {
      return reply.status(404).send({ error: 'ROOM_NOT_FOUND', message: `Room ${code} not found` });
    }
    const onlineCount = room.players.filter((p) => p.isOnline).length;
    return reply.status(200).send({
      code: room.code,
      status: room.status,
      playerCount: room.players.length,
      onlineCount,
      maxPlayers: 50,
    });
  });

  // ─── POST /api/rooms/:code/players ────────────────────────────────────────

  app.post('/api/rooms/:code/players', async (req, reply) => {
    const { code } = req.params as { code: string };
    const body = req.body as { nickname?: unknown };
    const nickname = typeof body.nickname === 'string' ? body.nickname : undefined;

    if (nickname === undefined) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'nickname (string) is required',
      });
    }

    const { room, playerId } = await roomService.joinRoom(code, nickname);
    const token = await signToken({ playerId, roomCode: code, role: 'player' });

    return reply.status(201).send({ playerId, token, room: sanitizeRoomForClient(room) });
  });

  // ─── DELETE /api/rooms/:code/players/:playerId ─────────────────────────────

  app.delete('/api/rooms/:code/players/:playerId', async (req, reply) => {
    const { code, playerId: targetPlayerId } = req.params as { code: string; playerId: string };

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: auth.error, message: auth.error === 'AUTH_TOKEN_EXPIRED' ? 'Token has expired' : 'Invalid or missing token' });
    }

    await gameService.kickPlayer(code, auth.claims.playerId, targetPlayerId);
    return reply.status(204).send();
  });

  // ─── POST /api/rooms/:code/game/start ─────────────────────────────────────

  app.post('/api/rooms/:code/game/start', async (req, reply) => {
    const { code } = req.params as { code: string };

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: auth.error, message: auth.error === 'AUTH_TOKEN_EXPIRED' ? 'Token has expired' : 'Invalid or missing token' });
    }

    const room = await gameService.startGame(code, auth.claims.playerId);
    return reply.status(200).send(sanitizeRoomForClient(room));
  });

  // ─── POST /api/rooms/:code/game/reveal ────────────────────────────────────

  app.post('/api/rooms/:code/game/reveal', async (req, reply) => {
    const { code } = req.params as { code: string };
    const body = req.body as { mode?: unknown };
    const mode = body.mode;

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: auth.error, message: auth.error === 'AUTH_TOKEN_EXPIRED' ? 'Token has expired' : 'Invalid or missing token' });
    }

    if (mode === 'all') {
      const { results, room } = await gameService.revealAll(code, auth.claims.playerId);
      return reply.status(200).send({ results, room: sanitizeRoomForClient(room) });
    } else if (mode === 'next') {
      const { result, room } = await gameService.revealNext(code, auth.claims.playerId);
      return reply.status(200).send({ result, room: sanitizeRoomForClient(room) });
    } else {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'mode must be "next" or "all"',
      });
    }
  });

  // ─── POST /api/rooms/:code/game/reset ─────────────────────────────────────

  app.post('/api/rooms/:code/game/reset', async (req, reply) => {
    const { code } = req.params as { code: string };

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: auth.error, message: auth.error === 'AUTH_TOKEN_EXPIRED' ? 'Token has expired' : 'Invalid or missing token' });
    }

    const room = await gameService.resetRoom(code, auth.claims.playerId);
    return reply.status(200).send(sanitizeRoomForClient(room));
  });

  // ─── POST /api/rooms/:code/game/end ───────────────────────────────────────

  app.post('/api/rooms/:code/game/end', async (req, reply) => {
    const { code } = req.params as { code: string };

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: auth.error, message: auth.error === 'AUTH_TOKEN_EXPIRED' ? 'Token has expired' : 'Invalid or missing token' });
    }

    const room = await gameService.endGame(code, auth.claims.playerId);
    return reply.status(200).send(sanitizeRoomForClient(room));
  });

  // ─── POST /api/rooms/:code/game/play-again ────────────────────────────────

  app.post('/api/rooms/:code/game/play-again', async (req, reply) => {
    const { code } = req.params as { code: string };

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: auth.error, message: auth.error === 'AUTH_TOKEN_EXPIRED' ? 'Token has expired' : 'Invalid or missing token' });
    }

    const room = await gameService.playAgain(code, auth.claims.playerId);
    // AC-H08-4: broadcast ROOM_STATE to all connected clients so every online
    // player sees the reset — mirrors what the WS PLAY_AGAIN handler does.
    broadcast(code, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(room) });
    return reply.status(200).send(sanitizeRoomForClient(room));
  });

  // ─── Listen ────────────────────────────────────────────────────────────────

  const port = Number(process.env['PORT'] ?? 3000);

  try {
    await redis.connect();
    app.log.info('Redis connected');
  } catch (err) {
    app.log.warn({ err }, 'Redis initial connect failed — will retry on demand');
  }

  broker = new PubSubBroker(redis);
  try {
    await broker.start((roomCode, payload, excludePlayerId) =>
      localFanout(roomCode, payload, excludePlayerId)
    );
    app.log.info('PubSubBroker subscribed to room:*:events');
  } catch (err) {
    app.log.error({ err }, 'PubSubBroker subscribe failed — multi-pod broadcast will not work');
    broker = null;
  }

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Server listening on port ${port}`);

  // ─── WebSocket Server (attached to same HTTP server) ───────────────────────

  const wss = new WebSocketServer({ server: app.server, path: '/ws', maxPayload: 65536 });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    handleWsConnection(ws, req, repo, gameService).catch(() => {
      ws.close(4000, 'Connection setup failed');
    });
  });

  app.log.info('WebSocket server ready at /ws');
}

// ─── Dependency interfaces for WS handler ─────────────────────────────────────

interface WsHandlerDeps {
  findByCode: (code: string) => Promise<import('@ladder-room/shared').Room | null>;
  isKicked: (code: string, playerId: string) => Promise<boolean>;
  update: (code: string, partial: Partial<import('@ladder-room/shared').Room>) => Promise<import('@ladder-room/shared').Room>;
}

interface WsGameDeps {
  startGame: (roomCode: string, playerId: string) => Promise<import('@ladder-room/shared').Room>;
  beginReveal: (roomCode: string, playerId: string) => Promise<import('@ladder-room/shared').Room>;
  revealNext: (roomCode: string, playerId: string) => Promise<{ result: import('@ladder-room/shared').ResultSlot; room: import('@ladder-room/shared').Room }>;
  revealAll: (roomCode: string, playerId: string) => Promise<{ results: readonly import('@ladder-room/shared').ResultSlot[]; room: import('@ladder-room/shared').Room }>;
  endGame: (roomCode: string, playerId: string) => Promise<import('@ladder-room/shared').Room>;
  playAgain: (roomCode: string, playerId: string) => Promise<import('@ladder-room/shared').Room>;
  resetRoom: (roomCode: string, playerId: string) => Promise<import('@ladder-room/shared').Room>;
  kickPlayer: (roomCode: string, hostPlayerId: string, targetPlayerId: string) => Promise<import('@ladder-room/shared').Room>;
}

async function handleWsConnection(
  ws: WebSocket,
  req: IncomingMessage,
  repo: WsHandlerDeps,
  gameService: WsGameDeps,
): Promise<void> {
  // Extract JWT from query string: /ws?token=...
  const url = new URL(req.url ?? '', `http://localhost`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001, 'Missing token');
    return;
  }

  let claims: JwtClaims;
  try {
    claims = await verifyToken(token);
  } catch {
    ws.close(4001, 'Invalid token');
    return;
  }

  const { playerId, roomCode } = claims;

  // Validate room query param matches JWT roomCode
  const roomParam = url.searchParams.get('room');
  if (roomParam && roomParam !== roomCode) {
    ws.close(4001, 'Room mismatch');
    return;
  }

  // Reject kicked players
  try {
    const kicked = await repo.isKicked(roomCode, playerId);
    if (kicked) { ws.close(4003, 'Kicked'); return; }
  } catch { /* ignore on error */ }

  // Register in room sessions map
  if (!roomSessions.has(roomCode)) roomSessions.set(roomCode, new Map());
  const roomMap = roomSessions.get(roomCode)!;

  // Kick previous session if same player reconnects
  const prev = roomMap.get(playerId);
  if (prev && prev.readyState === WebSocket.OPEN) {
    prev.send(JSON.stringify({ type: 'SESSION_REPLACED', payload: { message: 'Session replaced by new connection' } }));
    prev.close(4002, 'Session replaced');
  }
  roomMap.set(playerId, ws);

  // Send current room state on connect
  try {
    const room = await repo.findByCode(roomCode);
    if (room) ws.send(JSON.stringify({
      type: 'ROOM_STATE_FULL',
      payload: { ...sanitizeRoomForClient(room), selfPlayerId: playerId },
    }));
  } catch { /* ignore */ }

  // Mark player online
  try {
    const room = await repo.findByCode(roomCode);
    if (room) {
      const updatedPlayers = room.players.map(p =>
        p.id === playerId ? { ...p, isOnline: true } : p
      );
      const updated = await repo.update(roomCode, { players: updatedPlayers });
      broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(updated) });
    }
  } catch { /* ignore */ }

  // ─── Message handler ───────────────────────────────────────────────────────
  ws.on('message', (raw) => {
    handleWsMessage(ws, raw, roomCode, playerId, repo, gameService).catch(() => {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { code: 'SYS_INTERNAL_ERROR', message: 'Internal server error' } }));
    });
  });

  // ─── Disconnect handler ────────────────────────────────────────────────────
  ws.on('close', async () => {
    const rm = roomSessions.get(roomCode);
    if (rm?.get(playerId) === ws) rm.delete(playerId);
    if (rm?.size === 0) roomSessions.delete(roomCode);

    try {
      const room = await repo.findByCode(roomCode);
      if (room) {
        const updatedPlayers = room.players.map(p =>
          p.id === playerId ? { ...p, isOnline: false } : p
        );
        await repo.update(roomCode, { players: updatedPlayers });
        const updated = await repo.findByCode(roomCode);
        if (updated) broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(updated) });
      }
    } catch { /* ignore */ }
  });
}

async function handleWsMessage(
  ws: WebSocket,
  raw: import('ws').RawData,
  roomCode: string,
  playerId: string,
  repo: WsHandlerDeps,
  gameService: WsGameDeps,
): Promise<void> {
  let msg: { type: string; payload?: unknown };
  try {
    const parsed: unknown = JSON.parse(raw.toString());
    if (typeof parsed !== 'object' || parsed === null || typeof (parsed as Record<string, unknown>)['type'] !== 'string') {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { code: 'WS_INVALID_MSG', message: 'Invalid message structure' } }));
      return;
    }
    msg = parsed as { type: string; payload?: unknown };
  } catch {
    ws.send(JSON.stringify({ type: 'ERROR', payload: { code: 'WS_INVALID_MSG', message: 'Invalid JSON' } }));
    return;
  }

  const send = (type: string, payload?: unknown) =>
    ws.send(JSON.stringify({ type, payload }));

  try {
    switch (msg.type) {
      case 'PING':
        send('PONG');
        break;

      case 'START_GAME': {
        const room = await gameService.startGame(roomCode, playerId);
        broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(room) });
        break;
      }

      case 'BEGIN_REVEAL': {
        const room = await gameService.beginReveal(roomCode, playerId);
        broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(room) });
        break;
      }

      case 'REVEAL_NEXT': {
        const { result, room } = await gameService.revealNext(roomCode, playerId);
        broadcast(roomCode, {
          type: 'REVEAL_INDEX',
          payload: {
            playerIndex: room.revealedCount - 1,
            result,
            revealedCount: room.revealedCount,
            totalCount: room.players.length,
          },
        });
        break;
      }

      case 'REVEAL_ALL_TRIGGER': {
        const { results, room } = await gameService.revealAll(roomCode, playerId);
        broadcast(roomCode, { type: 'REVEAL_ALL', payload: { results, room: sanitizeRoomForClient(room) } });
        break;
      }

      case 'END_GAME': {
        const room = await gameService.endGame(roomCode, playerId);
        broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(room) });
        break;
      }

      case 'PLAY_AGAIN': {
        const room = await gameService.playAgain(roomCode, playerId);
        broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(room) });
        break;
      }

      case 'RESET_ROOM': {
        const room = await gameService.resetRoom(roomCode, playerId);
        broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(room) });
        break;
      }

      case 'SET_REVEAL_MODE': {
        const p = msg.payload as { mode?: unknown; intervalSec?: unknown } | undefined;
        const mode = p?.mode;
        if (mode !== 'manual' && mode !== 'auto') {
          send('ERROR', { code: 'INVALID_MODE', message: 'mode must be "manual" or "auto"' });
          break;
        }
        // Only the host may change the reveal mode
        const revealModeRoom = await repo.findByCode(roomCode);
        if (revealModeRoom === null) {
          send('ERROR', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
          break;
        }
        if (revealModeRoom.hostId !== playerId) {
          send('ERROR', { code: 'NOT_HOST', message: 'Only the host can change the reveal mode' });
          break;
        }
        const rawIntervalSec = mode === 'auto' && typeof p?.intervalSec === 'number' ? p.intervalSec : null;
        // Guard: interval must be between 1 and 300 seconds when in auto mode
        if (rawIntervalSec !== null && (rawIntervalSec < 1 || rawIntervalSec > 300 || !Number.isFinite(rawIntervalSec))) {
          send('ERROR', { code: 'INVALID_INTERVAL', message: 'intervalSec must be between 1 and 300' });
          break;
        }
        const intervalSec = rawIntervalSec;
        const room = await repo.update(roomCode, { revealMode: mode, autoRevealIntervalSec: intervalSec });
        broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(room) });
        break;
      }

      case 'KICK_PLAYER': {
        const kpPayload = msg.payload as { targetPlayerId?: string; playerId?: string } | undefined;
        const targetId = kpPayload?.targetPlayerId ?? kpPayload?.playerId;
        if (!targetId) { send('ERROR', { code: 'MISSING_PARAM', message: 'targetPlayerId required' }); break; }
        const room = await gameService.kickPlayer(roomCode, playerId, targetId);
        // Notify kicked player
        const kickedWs = roomSessions.get(roomCode)?.get(targetId);
        if (kickedWs?.readyState === WebSocket.OPEN) {
          kickedWs.send(JSON.stringify({ type: 'PLAYER_KICKED', payload: { kickedPlayerId: targetId, reason: 'host_kick' } }));
          kickedWs.close(4003, 'Kicked');
        }
        broadcast(roomCode, { type: 'ROOM_STATE', payload: sanitizeRoomForClient(room) });
        break;
      }

      default:
        send('ERROR', { code: 'WS_UNKNOWN_TYPE', message: `Unknown type: ${msg.type}` });
    }
  } catch (err) {
    if (err instanceof DomainError) {
      send('ERROR', { code: err.code, message: err.message });
    } else {
      send('ERROR', { code: 'SYS_INTERNAL_ERROR', message: 'Internal server error' });
    }
  }
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
