import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { SignJWT, jwtVerify } from 'jose';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { DomainError } from './domain/errors/DomainError.js';
import { createContainer } from './container.js';

// ─── Room → connected clients map ─────────────────────────────────────────────
// roomCode → Map<playerId, WebSocket>
const roomSessions = new Map<string, Map<string, WebSocket>>();

function broadcast(roomCode: string, payload: unknown, excludePlayerId?: string): void {
  const room = roomSessions.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const [pid, ws] of room) {
    if (pid === excludePlayerId) continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function broadcastAll(roomCode: string, payload: unknown): void {
  broadcast(roomCode, payload);
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env['JWT_SECRET'] ?? 'dev-secret-change-in-prod'
);

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
  return {
    playerId: payload['playerId'] as string,
    roomCode: payload['roomCode'] as string,
    role: payload['role'] as 'host' | 'player',
  };
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
  if (token === null) return { claims: null, error: 'Bearer token required' };
  try {
    const claims = await verifyToken(token);
    return { claims, error: null };
  } catch {
    return { claims: null, error: 'Invalid or expired token' };
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
    return reply.status(200).send({ status: 'ok' });
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

    return reply.status(201).send({ roomCode: room.code, playerId: hostId, token, room });
  });

  // ─── GET /api/rooms/:code ──────────────────────────────────────────────────

  app.get('/api/rooms/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const room = await repo.findByCode(code);
    if (room === null) {
      return reply.status(404).send({ error: 'ROOM_NOT_FOUND', message: `Room ${code} not found` });
    }
    return reply.status(200).send(room);
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

    return reply.status(201).send({ playerId, token, room });
  });

  // ─── DELETE /api/rooms/:code/players/:playerId ─────────────────────────────

  app.delete('/api/rooms/:code/players/:playerId', async (req, reply) => {
    const { code, playerId: targetPlayerId } = req.params as { code: string; playerId: string };

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: auth.error });
    }

    const room = await gameService.kickPlayer(code, auth.claims.playerId, targetPlayerId);
    return reply.status(200).send(room);
  });

  // ─── POST /api/rooms/:code/game/start ─────────────────────────────────────

  app.post('/api/rooms/:code/game/start', async (req, reply) => {
    const { code } = req.params as { code: string };

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: auth.error });
    }

    const room = await gameService.startGame(code, auth.claims.playerId);
    return reply.status(200).send(room);
  });

  // ─── POST /api/rooms/:code/game/reveal ────────────────────────────────────

  app.post('/api/rooms/:code/game/reveal', async (req, reply) => {
    const { code } = req.params as { code: string };
    const body = req.body as { mode?: unknown };
    const mode = body.mode;

    const auth = await requireAuth(req.headers['authorization']);
    if (auth.error !== null) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: auth.error });
    }

    if (mode === 'all') {
      const { results, room } = await gameService.revealAll(code, auth.claims.playerId);
      return reply.status(200).send({ results, room });
    } else if (mode === 'next') {
      const { result, room } = await gameService.revealNext(code, auth.claims.playerId);
      return reply.status(200).send({ result, room });
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
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: auth.error });
    }

    const room = await gameService.resetRoom(code, auth.claims.playerId);
    return reply.status(200).send(room);
  });

  // ─── Listen ────────────────────────────────────────────────────────────────

  const port = Number(process.env['PORT'] ?? 3000);

  try {
    await redis.connect();
    app.log.info('Redis connected');
  } catch (err) {
    app.log.warn({ err }, 'Redis initial connect failed — will retry on demand');
  }

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Server listening on port ${port}`);

  // ─── WebSocket Server (attached to same HTTP server) ───────────────────────

  const wss = new WebSocketServer({ server: app.server, path: '/ws', maxPayload: 65536 });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
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
      prev.send(JSON.stringify({ type: 'SESSION_REPLACED', payload: {} }));
      prev.close(4002, 'Session replaced');
    }
    roomMap.set(playerId, ws);

    // Send current room state on connect
    try {
      const room = await repo.findByCode(roomCode);
      if (room) ws.send(JSON.stringify({ type: 'ROOM_STATE', payload: room }));
    } catch { /* ignore */ }

    // Mark player online
    try {
      await repo.update(roomCode, {});
      const room = await repo.findByCode(roomCode);
      if (room) {
        const updatedPlayers = room.players.map(p =>
          p.id === playerId ? { ...p, isOnline: true } : p
        );
        await repo.update(roomCode, { players: updatedPlayers });
        const updated = await repo.findByCode(roomCode);
        if (updated) broadcastAll(roomCode, { type: 'ROOM_STATE', payload: updated });
      }
    } catch { /* ignore */ }

    // ─── Message handler ─────────────────────────────────────────────────────
    ws.on('message', async (raw) => {
      let msg: { type: string; payload?: unknown };
      try {
        msg = JSON.parse(raw.toString()) as { type: string; payload?: unknown };
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
            broadcastAll(roomCode, { type: 'ROOM_STATE', payload: room });
            break;
          }

          case 'BEGIN_REVEAL': {
            const room = await gameService.beginReveal(roomCode, playerId);
            broadcastAll(roomCode, { type: 'ROOM_STATE', payload: room });
            break;
          }

          case 'REVEAL_NEXT': {
            const { result, room } = await gameService.revealNext(roomCode, playerId);
            broadcastAll(roomCode, { type: 'REVEAL_INDEX', payload: { index: room.revealedCount - 1, result, room } });
            break;
          }

          case 'REVEAL_ALL_TRIGGER': {
            const { results, room } = await gameService.revealAll(roomCode, playerId);
            broadcastAll(roomCode, { type: 'REVEAL_ALL', payload: { results, room } });
            break;
          }

          case 'RESET_ROOM': {
            const room = await gameService.resetRoom(roomCode, playerId);
            broadcastAll(roomCode, { type: 'ROOM_STATE', payload: room });
            break;
          }

          case 'SET_REVEAL_MODE': {
            const p = msg.payload as { mode?: unknown; intervalSec?: unknown } | undefined;
            const mode = p?.mode;
            if (mode !== 'manual' && mode !== 'auto') {
              send('ERROR', { code: 'INVALID_MODE', message: 'mode must be "manual" or "auto"' });
              break;
            }
            const intervalSec = mode === 'auto' && typeof p?.intervalSec === 'number' ? p.intervalSec : null;
            const room = await repo.update(roomCode, { revealMode: mode, autoRevealIntervalSec: intervalSec });
            broadcastAll(roomCode, { type: 'ROOM_STATE', payload: room });
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
            broadcastAll(roomCode, { type: 'ROOM_STATE', payload: room });
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
    });

    // ─── Disconnect handler ───────────────────────────────────────────────────
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
          if (updated) broadcastAll(roomCode, { type: 'ROOM_STATE', payload: updated });
        }
      } catch { /* ignore */ }
    });
  });

  app.log.info('WebSocket server ready at /ws');
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
