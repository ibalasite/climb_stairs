import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Room, Player, LadderData, ResultSlot } from '@ladder-room/shared';
import type { IRoomRepository } from '../../infrastructure/redis/IRoomRepository.js';
import { GameService } from '../../application/services/GameService.js';
import { DomainError } from '../../domain/errors/DomainError.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    nickname: 'Alice',
    colorIndex: 0,
    isHost: true,
    isOnline: true,
    joinedAt: '2024-01-01T00:00:00.000Z',
    result: null,
    ...overrides,
  };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    code: 'ABCD12',
    status: 'waiting',
    hostId: 'player-1',
    players: [makePlayer()],
    winnerCount: 1,
    ladder: null,
    results: null,
    revealedCount: 0,
    revealMode: 'manual',
    autoRevealIntervalSec: null,
    kickedPlayerIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeResultSlot(overrides: Partial<ResultSlot> = {}): ResultSlot {
  return {
    playerIndex: 0,
    playerId: 'player-1',
    startCol: 0,
    endCol: 0,
    isWinner: true,
    path: [],
    ...overrides,
  };
}

function makeMockRepo(roomOverride?: Partial<Room>): IRoomRepository {
  let storedRoom = makeRoom(roomOverride);

  return {
    create: vi.fn(),
    findByCode: vi.fn(async () => storedRoom),
    update: vi.fn(async (_code: string, partial: Partial<Room>) => {
      storedRoom = { ...storedRoom, ...partial };
      return storedRoom;
    }),
    addKickedPlayer: vi.fn(),
    isKicked: vi.fn(async () => false),
    clearKickedPlayers: vi.fn(),
    incrementRevealedCount: vi.fn(async () => {
      storedRoom = { ...storedRoom, revealedCount: storedRoom.revealedCount + 1 };
      return storedRoom.revealedCount;
    }),
    getRevealedCount: vi.fn(async () => storedRoom.revealedCount),
    delete: vi.fn(),
    expireIn: vi.fn(),
  };
}

// ─── GameService Tests ───────────────────────────────────────────────────────

describe('GameService', () => {
  // ── startGame ──────────────────────────────────────────────────────────────

  describe('startGame', () => {
    it('throws NOT_HOST when caller is not the host', async () => {
      const repo = makeMockRepo();
      const svc = new GameService(repo);

      await expect(svc.startGame('ABCD12', 'not-host-id')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NOT_HOST'
      );
    });

    it('throws INVALID_STATE when room is not in waiting state', async () => {
      const repo = makeMockRepo({ status: 'running' });
      const svc = new GameService(repo);

      await expect(svc.startGame('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_STATE'
      );
    });

    it('throws INSUFFICIENT_PLAYERS when there is only 1 player', async () => {
      const repo = makeMockRepo({
        players: [makePlayer()],
        winnerCount: 1,
      });
      const svc = new GameService(repo);

      await expect(svc.startGame('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INSUFFICIENT_PLAYERS'
      );
    });

    it('throws PRIZES_NOT_SET when winnerCount is null', async () => {
      const repo = makeMockRepo({
        players: [makePlayer(), makePlayer({ id: 'player-2', isHost: false })],
        winnerCount: null,
      });
      const svc = new GameService(repo);

      await expect(svc.startGame('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'PRIZES_NOT_SET'
      );
    });

    it('throws INVALID_PRIZES_COUNT when winnerCount >= playerCount', async () => {
      const repo = makeMockRepo({
        players: [makePlayer(), makePlayer({ id: 'player-2', isHost: false })],
        winnerCount: 2, // equal to playerCount=2, which is invalid
      });
      const svc = new GameService(repo);

      await expect(svc.startGame('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_PRIZES_COUNT'
      );
    });

    it('transitions room to running with ladder and results when valid', async () => {
      const players = [
        makePlayer({ id: 'player-1', isHost: true }),
        makePlayer({ id: 'player-2', isHost: false, nickname: 'Bob', colorIndex: 1 }),
      ];
      const repo = makeMockRepo({ players, winnerCount: 1 });
      const svc = new GameService(repo);

      const room = await svc.startGame('ABCD12', 'player-1');

      expect(room.status).toBe('running');
      expect(room.ladder).not.toBeNull();
      expect(room.results).not.toBeNull();
      expect(room.results).toHaveLength(2);
    });
  });

  // ── beginReveal ────────────────────────────────────────────────────────────

  describe('beginReveal', () => {
    it('throws NOT_HOST when caller is not the host', async () => {
      const repo = makeMockRepo({ status: 'running' });
      const svc = new GameService(repo);

      await expect(svc.beginReveal('ABCD12', 'not-host')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NOT_HOST'
      );
    });

    it('throws INVALID_STATE when status is not running', async () => {
      const repo = makeMockRepo({ status: 'waiting' });
      const svc = new GameService(repo);

      await expect(svc.beginReveal('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_STATE'
      );
    });

    it('transitions room to revealing state', async () => {
      const repo = makeMockRepo({ status: 'running' });
      const svc = new GameService(repo);

      const room = await svc.beginReveal('ABCD12', 'player-1');
      expect(room.status).toBe('revealing');
    });
  });

  // ── revealNext ─────────────────────────────────────────────────────────────

  describe('revealNext', () => {
    it('throws INVALID_STATE when status is not revealing', async () => {
      const repo = makeMockRepo({ status: 'running' });
      const svc = new GameService(repo);

      await expect(svc.revealNext('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_STATE'
      );
    });

    it('throws NOT_HOST when caller is not the host', async () => {
      const repo = makeMockRepo({ status: 'revealing', results: [makeResultSlot()] });
      const svc = new GameService(repo);

      await expect(svc.revealNext('ABCD12', 'not-host')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NOT_HOST'
      );
    });

    it('returns the next result slot and increments revealedCount', async () => {
      const results: ResultSlot[] = [
        makeResultSlot({ playerIndex: 0, playerId: 'player-1' }),
        makeResultSlot({ playerIndex: 1, playerId: 'player-2' }),
      ];
      const repo = makeMockRepo({ status: 'revealing', results, revealedCount: 0 });
      const svc = new GameService(repo);

      const { result, room } = await svc.revealNext('ABCD12', 'player-1');

      expect(result.playerIndex).toBe(0);
      expect(room.revealedCount).toBe(1);
    });

    it('sets status to finished when all results revealed', async () => {
      const results: ResultSlot[] = [makeResultSlot({ playerIndex: 0 })];
      const repo = makeMockRepo({ status: 'revealing', results, revealedCount: 0 });
      const svc = new GameService(repo);

      const { room } = await svc.revealNext('ABCD12', 'player-1');
      expect(room.status).toBe('finished');
    });
  });

  // ── kickPlayer ─────────────────────────────────────────────────────────────

  describe('kickPlayer', () => {
    it('throws NOT_HOST when caller is not the host', async () => {
      const repo = makeMockRepo();
      const svc = new GameService(repo);

      await expect(svc.kickPlayer('ABCD12', 'not-host', 'player-2')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NOT_HOST'
      );
    });

    it('throws INVALID_STATE when room is not in waiting state', async () => {
      const repo = makeMockRepo({ status: 'running' });
      const svc = new GameService(repo);

      await expect(svc.kickPlayer('ABCD12', 'player-1', 'player-2')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_STATE'
      );
    });

    it('removes kicked player from the room players list', async () => {
      const players = [
        makePlayer({ id: 'player-1', isHost: true }),
        makePlayer({ id: 'player-2', isHost: false, nickname: 'Bob', colorIndex: 1 }),
      ];
      const repo = makeMockRepo({ players });
      const svc = new GameService(repo);

      const room = await svc.kickPlayer('ABCD12', 'player-1', 'player-2');
      expect(room.players).toHaveLength(1);
      expect(room.players[0]?.id).toBe('player-1');
    });

    it('throws PLAYER_NOT_FOUND when target does not exist', async () => {
      const repo = makeMockRepo();
      const svc = new GameService(repo);

      await expect(svc.kickPlayer('ABCD12', 'player-1', 'nonexistent')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'PLAYER_NOT_FOUND'
      );
    });
  });

  // ── resetRoom ──────────────────────────────────────────────────────────────

  describe('resetRoom', () => {
    it('throws NOT_HOST when caller is not the host', async () => {
      const repo = makeMockRepo({ status: 'finished' });
      const svc = new GameService(repo);

      await expect(svc.resetRoom('ABCD12', 'not-host')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NOT_HOST'
      );
    });

    it('throws INVALID_STATE when room is not finished', async () => {
      const repo = makeMockRepo({ status: 'running' });
      const svc = new GameService(repo);

      await expect(svc.resetRoom('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_STATE'
      );
    });

    it('throws INSUFFICIENT_ONLINE_PLAYERS when fewer than 2 online players remain', async () => {
      // Only the host is online — second player is offline
      const players = [
        makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
        makePlayer({ id: 'player-2', isHost: false, nickname: 'Bob', colorIndex: 1, isOnline: false }),
      ];
      const repo = makeMockRepo({ status: 'finished', players });
      const svc = new GameService(repo);

      await expect(svc.resetRoom('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INSUFFICIENT_ONLINE_PLAYERS'
      );
    });

    it('resets room to waiting state with online players when valid', async () => {
      const players = [
        makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
        makePlayer({ id: 'player-2', isHost: false, nickname: 'Bob', colorIndex: 1, isOnline: true }),
      ];
      const repo = makeMockRepo({ status: 'finished', players });
      const svc = new GameService(repo);

      const room = await svc.resetRoom('ABCD12', 'player-1');

      expect(room.status).toBe('waiting');
      expect(room.ladder).toBeNull();
      expect(room.results).toBeNull();
      expect(room.revealedCount).toBe(0);
    });
  });

  // ── ROOM_NOT_FOUND ─────────────────────────────────────────────────────────

  describe('missing room', () => {
    it('throws ROOM_NOT_FOUND when room does not exist', async () => {
      const repo: IRoomRepository = {
        ...makeMockRepo(),
        findByCode: vi.fn(async () => null),
      };
      const svc = new GameService(repo);

      await expect(svc.startGame('ZZZZZZ', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'ROOM_NOT_FOUND'
      );
    });
  });
});
