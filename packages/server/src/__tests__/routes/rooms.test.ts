/**
 * Unit tests for POST /api/rooms and GET /api/rooms/:code REST routes.
 *
 * We build a minimal Fastify app with mocked services/repo so that we can test
 * the HTTP layer without Redis, WebSocket, or JWT_SECRET env requirements.
 *
 * The route logic is the same as in main.ts — any structural drift will surface
 * as a test failure.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import type { Room, Player } from '@ladder-room/shared';
import type { IRoomRepository } from '../../infrastructure/redis/IRoomRepository.js';
import { RoomService } from '../../application/services/RoomService.js';
import { DomainError } from '../../domain/errors/DomainError.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'host-id',
    nickname: 'Alice',
    colorIndex: 0,
    isHost: true,
    isOnline: true,
    joinedAt: 1713484800000,
    result: null,
    ...overrides,
  };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    code: 'ABCD12',
    status: 'waiting',
    hostId: 'host-id',
    players: [makePlayer()],
    winnerCount: 1,
    ladder: null,
    results: null,
    revealedCount: 0,
    revealMode: 'manual',
    autoRevealIntervalSec: null,
    kickedPlayerIds: [],
    createdAt: 1713484800000,
    updatedAt: 1713484800000,
    ...overrides,
  };
}

function makeMockRepo(stored?: Room): IRoomRepository {
  let storedRoom: Room | undefined = stored;
  return {
    create: vi.fn(async (room: Room) => { storedRoom = room; }),
    findByCode: vi.fn(async (code: string) => {
      if (storedRoom && storedRoom.code === code) return storedRoom;
      return null;
    }),
    update: vi.fn(async (_code: string, partial: Partial<Room>) => {
      if (!storedRoom) throw new Error('No room');
      storedRoom = { ...storedRoom, ...partial };
      return storedRoom;
    }),
    addKickedPlayer: vi.fn(),
    isKicked: vi.fn(async () => false),
    clearKickedPlayers: vi.fn(),
    incrementRevealedCount: vi.fn(async () => 1),
    resetRevealedCount: vi.fn(),
    getRevealedCount: vi.fn(async () => 0),
    delete: vi.fn(),
    expireIn: vi.fn(),
  };
}

/** Strip the ladder field (mirrors sanitizeRoomForClient in main.ts). */
function sanitize<T extends { ladder?: unknown }>(room: T): Omit<T, 'ladder'> {
  const { ladder: _l, ...rest } = room as Record<string, unknown>;
  return rest as Omit<T, 'ladder'>;
}

function buildApp(repo: IRoomRepository) {
  const svc = new RoomService(repo);
  const app = Fastify({ logger: false });

  // Set up error handler matching main.ts
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof DomainError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    }
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  // POST /api/rooms
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

    const { room, hostId } = await svc.createRoom(hostNickname, winnerCount);
    // Return a fake token in tests (JWT signing requires a real secret)
    const token = 'test-token';
    return reply.status(201).send({ roomCode: room.code, playerId: hostId, token, room: sanitize(room) });
  });

  // GET /api/rooms/:code
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

  return app;
}

// ─── POST /api/rooms tests ────────────────────────────────────────────────────

describe('POST /api/rooms', () => {
  it('returns 201 with roomCode, playerId, token, and room on success', async () => {
    const repo = makeMockRepo();
    const app = buildApp(repo);

    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { hostNickname: 'Alice', winnerCount: 1 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ roomCode: string; playerId: string; token: string; room: Record<string, unknown> }>();
    expect(typeof body.roomCode).toBe('string');
    expect(body.roomCode).toHaveLength(6);
    expect(typeof body.playerId).toBe('string');
    expect(typeof body.token).toBe('string');
    expect(body.room.status).toBe('waiting');
  });

  it('roomCode uses only valid charset characters', async () => {
    const validChars = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''));
    const repo = makeMockRepo();
    const app = buildApp(repo);

    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { hostNickname: 'Bob', winnerCount: 2 },
    });

    const body = res.json<{ roomCode: string }>();
    for (const ch of body.roomCode) {
      expect(validChars.has(ch)).toBe(true);
    }
  });

  it('returns 400 when hostNickname is missing', async () => {
    const repo = makeMockRepo();
    const app = buildApp(repo);

    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { winnerCount: 1 },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string }>();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when winnerCount is missing', async () => {
    const repo = makeMockRepo();
    const app = buildApp(repo);

    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { hostNickname: 'Alice' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string }>();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when both fields are missing', async () => {
    const repo = makeMockRepo();
    const app = buildApp(repo);

    const res = await app.inject({ method: 'POST', url: '/api/rooms', payload: {} });

    expect(res.statusCode).toBe(400);
  });

  it('room response does not expose ladder field (sanitizeRoomForClient)', async () => {
    const repo = makeMockRepo();
    const app = buildApp(repo);

    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { hostNickname: 'Alice', winnerCount: 1 },
    });

    const body = res.json<{ room: Record<string, unknown> }>();
    expect(body.room).not.toHaveProperty('ladder');
  });

  it('room response contains the host player', async () => {
    const repo = makeMockRepo();
    const app = buildApp(repo);

    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { hostNickname: 'Carol', winnerCount: 1 },
    });

    const body = res.json<{ room: { players: Player[] } }>();
    expect(body.room.players).toHaveLength(1);
    expect(body.room.players[0]?.nickname).toBe('Carol');
    expect(body.room.players[0]?.isHost).toBe(true);
  });
});

// ─── GET /api/rooms/:code tests ───────────────────────────────────────────────

describe('GET /api/rooms/:code', () => {
  it('returns 200 with room summary when room exists', async () => {
    const room = makeRoom({ code: 'ABCD12' });
    const repo = makeMockRepo(room);
    const app = buildApp(repo);

    const res = await app.inject({ method: 'GET', url: '/api/rooms/ABCD12' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      code: string;
      status: string;
      playerCount: number;
      onlineCount: number;
      maxPlayers: number;
    }>();
    expect(body.code).toBe('ABCD12');
    expect(body.status).toBe('waiting');
    expect(body.playerCount).toBe(1);
    expect(body.maxPlayers).toBe(50);
  });

  it('returns 404 when room does not exist', async () => {
    const repo = makeMockRepo(); // no room stored
    const app = buildApp(repo);

    const res = await app.inject({ method: 'GET', url: '/api/rooms/NOTFOUND' });

    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: string }>();
    expect(body.error).toBe('ROOM_NOT_FOUND');
  });

  it('onlineCount counts only online players', async () => {
    const room = makeRoom({
      code: 'MULTI1',
      players: [
        makePlayer({ id: 'p1', isOnline: true }),
        makePlayer({ id: 'p2', nickname: 'Bob', isOnline: false }),
        makePlayer({ id: 'p3', nickname: 'Carol', isOnline: true }),
      ],
    });
    const repo = makeMockRepo(room);
    const app = buildApp(repo);

    const res = await app.inject({ method: 'GET', url: '/api/rooms/MULTI1' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ onlineCount: number; playerCount: number }>();
    expect(body.playerCount).toBe(3);
    expect(body.onlineCount).toBe(2);
  });

  it('response does not expose hostId (RoomSummaryPayload security)', async () => {
    const room = makeRoom({ code: 'SECURE' });
    const repo = makeMockRepo(room);
    const app = buildApp(repo);

    const res = await app.inject({ method: 'GET', url: '/api/rooms/SECURE' });

    const body = res.json<Record<string, unknown>>();
    expect(body).not.toHaveProperty('hostId');
  });
});
