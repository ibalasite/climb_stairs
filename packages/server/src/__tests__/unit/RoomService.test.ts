import { describe, it, expect, vi } from 'vitest';
import type { Room, Player } from '@ladder-room/shared';
import type { IRoomRepository } from '../../infrastructure/redis/IRoomRepository.js';
import { RoomService } from '../../application/services/RoomService.js';
import { DomainError } from '../../domain/errors/DomainError.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
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
    players: [makePlayer({ id: 'host-id', isHost: true })],
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

/**
 * Build a minimal mock IRoomRepository.
 * By default, findByCode returns null (no collision) and create/update are no-ops.
 */
function makeMockRepo(existing?: Room): IRoomRepository {
  let storedRoom: Room | undefined = existing;

  return {
    create: vi.fn(async (room: Room) => {
      storedRoom = room;
    }),
    findByCode: vi.fn(async (code: string) => {
      if (storedRoom !== undefined && storedRoom.code === code) return storedRoom;
      return null;
    }),
    update: vi.fn(async (_code: string, partial: Partial<Room>) => {
      if (storedRoom === undefined) throw new Error('No room stored');
      storedRoom = { ...storedRoom, ...partial };
      return storedRoom;
    }),
    addKickedPlayer: vi.fn(),
    isKicked: vi.fn(async () => false),
    clearKickedPlayers: vi.fn(),
    incrementRevealedCount: vi.fn(async () => 1),
    resetRevealedCount: vi.fn(async () => {}),
    getRevealedCount: vi.fn(async () => 0),
    delete: vi.fn(),
    expireIn: vi.fn(),
  };
}

// ─── RoomService Tests ───────────────────────────────────────────────────────

describe('RoomService', () => {
  // ── generateRoomCode ───────────────────────────────────────────────────────

  describe('generateRoomCode', () => {
    it('generates a 6-character room code', () => {
      const svc = new RoomService(makeMockRepo());
      const code = svc.generateRoomCode();
      expect(code).toHaveLength(6);
    });

    it('uses only valid charset characters (A-HJ-NP-Z, 2-9)', () => {
      const validChars = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''));
      const svc = new RoomService(makeMockRepo());

      for (let i = 0; i < 50; i++) {
        const code = svc.generateRoomCode();
        for (const ch of code) {
          expect(validChars.has(ch)).toBe(true);
        }
      }
    });

    it('excludes ambiguous characters: 0, 1, I, O', () => {
      const ambiguous = new Set(['0', '1', 'I', 'O']);
      const svc = new RoomService(makeMockRepo());

      for (let i = 0; i < 100; i++) {
        const code = svc.generateRoomCode();
        for (const ch of code) {
          expect(ambiguous.has(ch)).toBe(false);
        }
      }
    });
  });

  // ── createRoom ─────────────────────────────────────────────────────────────

  describe('createRoom', () => {
    it('creates a room in waiting state with correct structure', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      const { room, hostId } = await svc.createRoom('Alice', 2);

      expect(room.status).toBe('waiting');
      expect(room.hostId).toBe(hostId);
      expect(room.winnerCount).toBe(2);
      expect(room.players).toHaveLength(1);
      expect(room.players[0]?.nickname).toBe('Alice');
      expect(room.players[0]?.isHost).toBe(true);
      expect(room.players[0]?.colorIndex).toBe(0);
      expect(room.players[0]?.isOnline).toBe(true);
      expect(room.ladder).toBeNull();
      expect(room.results).toBeNull();
    });

    it('generates a 6-char code from the valid charset', async () => {
      const validChars = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''));
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      const { room } = await svc.createRoom('Alice', 1);

      expect(room.code).toHaveLength(6);
      for (const ch of room.code) {
        expect(validChars.has(ch)).toBe(true);
      }
    });

    it('throws INVALID_NICKNAME when nickname is empty', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      await expect(svc.createRoom('', 1)).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_NICKNAME'
      );
    });

    it('throws INVALID_NICKNAME when nickname exceeds 20 characters', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      await expect(svc.createRoom('A'.repeat(21), 1)).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_NICKNAME'
      );
    });

    it('throws INVALID_WINNER_COUNT when winnerCount < 1', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      await expect(svc.createRoom('Alice', 0)).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_WINNER_COUNT'
      );
    });

    it('accepts a decimal winnerCount (no integer enforcement in domain layer)', async () => {
      // RoomService only enforces >= 1; decimal values like 1.9 are stored as-is.
      // If integer enforcement is required, it should be added to the validation layer.
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      const { room } = await svc.createRoom('Alice', 1.9);
      expect(room.winnerCount).toBe(1.9);
    });

    it('throws INVALID_NICKNAME when nickname contains injection characters', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      await expect(svc.createRoom('<script>', 1)).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_NICKNAME'
      );
      await expect(svc.createRoom('Alice"Bob', 1)).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_NICKNAME'
      );
    });

    it('accepts a nickname of exactly 1 character (lower boundary)', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      const { room } = await svc.createRoom('A', 1);
      expect(room.players[0]?.nickname).toBe('A');
    });

    it('accepts a nickname of exactly 20 characters (upper boundary)', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      const nick20 = 'A'.repeat(20);
      const { room } = await svc.createRoom(nick20, 1);
      expect(room.players[0]?.nickname).toBe(nick20);
    });

    it('throws CODE_COLLISION when all code generation attempts collide', async () => {
      // Repo always returns an existing room, forcing every attempt to fail
      const existingRoom = makeRoom();
      const findByCode = vi.fn(async () => existingRoom);
      const repo: IRoomRepository = {
        ...makeMockRepo(existingRoom),
        // Always return a non-null room to simulate code collision on every attempt
        findByCode,
      };
      const svc = new RoomService(repo);

      await expect(svc.createRoom('Alice', 1)).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'CODE_COLLISION'
      );
      // All 10 attempts should have been made before giving up
      expect(findByCode).toHaveBeenCalledTimes(10);
    });

    it('stores the host player with isHost=true', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      const { room } = await svc.createRoom('Alice', 1);
      expect(room.players[0]?.isHost).toBe(true);
    });

    it('initializes kickedPlayerIds as empty and revealedCount as 0', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      const { room } = await svc.createRoom('Alice', 1);

      expect(room.kickedPlayerIds).toEqual([]);
      expect(room.revealedCount).toBe(0);
      expect(room.ladder).toBeNull();
      expect(room.results).toBeNull();
    });

    it('trims leading/trailing whitespace from host nickname', async () => {
      const repo = makeMockRepo();
      const svc = new RoomService(repo);

      const { room } = await svc.createRoom('  Alice  ', 1);
      expect(room.players[0]?.nickname).toBe('Alice');
    });
  });

  // ── joinRoom ───────────────────────────────────────────────────────────────

  describe('joinRoom', () => {
    it('throws INVALID_NICKNAME when nickname is empty', async () => {
      const repo = makeMockRepo(makeRoom());
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', '')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_NICKNAME'
      );
    });

    it('throws INVALID_NICKNAME for whitespace-only nickname', async () => {
      const repo = makeMockRepo(makeRoom());
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', '   ')).rejects.toMatchObject({ code: 'INVALID_NICKNAME' });
    });

    it('throws INVALID_NICKNAME when nickname contains injection characters', async () => {
      const repo = makeMockRepo(makeRoom());
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', '<Bob>')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_NICKNAME'
      );
    });

    it('throws ROOM_NOT_FOUND when room does not exist', async () => {
      const repo = makeMockRepo(); // no stored room
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ZZZZZZ', 'Bob')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'ROOM_NOT_FOUND'
      );
    });

    it('throws ROOM_NOT_ACCEPTING when room status is not waiting', async () => {
      const room = makeRoom({ status: 'running' });
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', 'Bob')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'ROOM_NOT_ACCEPTING'
      );
    });

    it('throws ROOM_NOT_ACCEPTING when room status is finished', async () => {
      const room = makeRoom({ status: 'finished' });
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', 'Bob')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'ROOM_NOT_ACCEPTING'
      );
    });

    it('throws ROOM_NOT_ACCEPTING when room status is revealing', async () => {
      const room = makeRoom({ status: 'revealing' });
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', 'Bob')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'ROOM_NOT_ACCEPTING'
      );
    });

    it('throws ROOM_FULL when room already has 50 players', async () => {
      const players = Array.from({ length: 50 }, (_, i) =>
        makePlayer({ id: `p${i}`, nickname: `Player${i}`, colorIndex: i, isHost: i === 0 })
      );
      const room = makeRoom({ players });
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', 'Overflow')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'ROOM_FULL'
      );
    });

    it('throws NICKNAME_TAKEN when the nickname is already used', async () => {
      const room = makeRoom({
        players: [makePlayer({ id: 'host-id', nickname: 'Alice', isHost: true })],
      });
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', 'Alice')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NICKNAME_TAKEN'
      );
    });

    it('is case-insensitive for nickname uniqueness', async () => {
      const room = makeRoom({
        players: [makePlayer({ id: 'host-id', nickname: 'Alice', isHost: true })],
      });
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      await expect(svc.joinRoom('ABCD12', 'alice')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NICKNAME_TAKEN'
      );
    });

    it('assigns a colorIndex not already taken', async () => {
      // Host occupies colorIndex 0
      const room = makeRoom({
        players: [makePlayer({ id: 'host-id', nickname: 'Alice', colorIndex: 0, isHost: true })],
      });
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      const { room: updatedRoom } = await svc.joinRoom('ABCD12', 'Bob');

      const bobPlayer = updatedRoom.players.find((p) => p.nickname === 'Bob');
      expect(bobPlayer).toBeDefined();
      expect(bobPlayer!.colorIndex).not.toBe(0);
    });

    it('adds a new player and returns the updated room', async () => {
      const room = makeRoom();
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      const { room: updatedRoom, playerId } = await svc.joinRoom('ABCD12', 'Bob');

      expect(updatedRoom.players).toHaveLength(2);
      expect(updatedRoom.players.find((p) => p.id === playerId)).toBeDefined();
    });

    it('new player has isHost=false', async () => {
      const room = makeRoom();
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      const { room: updatedRoom, playerId } = await svc.joinRoom('ABCD12', 'Bob');

      const bob = updatedRoom.players.find((p) => p.id === playerId);
      expect(bob?.isHost).toBe(false);
    });

    it('new player has isOnline=true on join', async () => {
      const room = makeRoom();
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      const { room: updatedRoom, playerId } = await svc.joinRoom('ABCD12', 'Bob');

      const bob = updatedRoom.players.find((p) => p.id === playerId);
      expect(bob?.isOnline).toBe(true);
    });

    it('trims leading/trailing whitespace from nickname on join', async () => {
      const room = makeRoom();
      const repo = makeMockRepo(room);
      const svc = new RoomService(repo);

      const { room: updatedRoom, playerId } = await svc.joinRoom('ABCD12', '  Bob  ');

      const bob = updatedRoom.players.find((p) => p.id === playerId);
      expect(bob?.nickname).toBe('Bob');
    });
  });
});
