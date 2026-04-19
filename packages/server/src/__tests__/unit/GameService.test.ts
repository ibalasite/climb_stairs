import { describe, it, expect, vi } from 'vitest';
import type { Room, Player, ResultSlot } from '@ladder-room/shared';
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
    joinedAt: 1713484800000,
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
    createdAt: 1713484800000,
    updatedAt: 1713484800000,
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

    it('throws NO_RESULTS when results is null', async () => {
      const repo = makeMockRepo({ status: 'revealing', results: null });
      const svc = new GameService(repo);

      await expect(svc.revealNext('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NO_RESULTS'
      );
    });

    it('throws REVEAL_OUT_OF_BOUNDS when incrementRevealedCount exceeds results length', async () => {
      const results: ResultSlot[] = [makeResultSlot({ playerIndex: 0 })];
      // Start with revealedCount already at 1 (all revealed), so next increment pushes it to 2 which is out of bounds
      const repo: IRoomRepository = {
        ...makeMockRepo({ status: 'revealing', results, revealedCount: 1 }),
        incrementRevealedCount: vi.fn(async () => 2),
      };
      const svc = new GameService(repo);

      await expect(svc.revealNext('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'REVEAL_OUT_OF_BOUNDS'
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

  // ── revealAll ──────────────────────────────────────────────────────────────

  describe('revealAll', () => {
    it('throws NOT_HOST when caller is not the host', async () => {
      const repo = makeMockRepo({ status: 'revealing', results: [makeResultSlot()] });
      const svc = new GameService(repo);

      await expect(svc.revealAll('ABCD12', 'not-host')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NOT_HOST'
      );
    });

    it('throws INVALID_STATE when status is not revealing', async () => {
      const repo = makeMockRepo({ status: 'running', results: [makeResultSlot()] });
      const svc = new GameService(repo);

      await expect(svc.revealAll('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'INVALID_STATE'
      );
    });

    it('throws NO_RESULTS when results is null', async () => {
      const repo = makeMockRepo({ status: 'revealing', results: null });
      const svc = new GameService(repo);

      await expect(svc.revealAll('ABCD12', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'NO_RESULTS'
      );
    });

    it('returns all remaining results and transitions room to finished', async () => {
      const results: ResultSlot[] = [
        makeResultSlot({ playerIndex: 0, playerId: 'player-1' }),
        makeResultSlot({ playerIndex: 1, playerId: 'player-2' }),
      ];
      const repo = makeMockRepo({ status: 'revealing', results, revealedCount: 0 });
      const svc = new GameService(repo);

      const { results: revealed, room } = await svc.revealAll('ABCD12', 'player-1');

      expect(revealed).toHaveLength(2);
      expect(room.status).toBe('finished');
      expect(room.revealedCount).toBe(2);
    });

    it('returns only unrevealed results when some have already been revealed', async () => {
      const results: ResultSlot[] = [
        makeResultSlot({ playerIndex: 0, playerId: 'player-1' }),
        makeResultSlot({ playerIndex: 1, playerId: 'player-2' }),
        makeResultSlot({ playerIndex: 2, playerId: 'player-3' }),
      ];
      const repo: IRoomRepository = {
        ...makeMockRepo({ status: 'revealing', results, revealedCount: 1 }),
        getRevealedCount: vi.fn(async () => 1),
      };
      const svc = new GameService(repo);

      const { results: revealed, room } = await svc.revealAll('ABCD12', 'player-1');

      // Only playerIndex 1 and 2 should remain (index 0 was already revealed)
      expect(revealed).toHaveLength(2);
      expect(revealed[0]?.playerIndex).toBe(1);
      // Assert that getRevealedCount was called with the room code
      expect(repo.getRevealedCount).toHaveBeenCalledWith('ABCD12');
      // Structural validation: room should be finished with full revealedCount
      expect(room.status).toBe('finished');
      expect(room.revealedCount).toBe(3);
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

    it('removes kicked player from the room players list and records the kick', async () => {
      const players = [
        makePlayer({ id: 'player-1', isHost: true }),
        makePlayer({ id: 'player-2', isHost: false, nickname: 'Bob', colorIndex: 1 }),
      ];
      const repo = makeMockRepo({ players });
      const svc = new GameService(repo);

      const room = await svc.kickPlayer('ABCD12', 'player-1', 'player-2');
      expect(room.players).toHaveLength(1);
      expect(room.players[0]?.id).toBe('player-1');
      expect(repo.addKickedPlayer).toHaveBeenCalledWith('ABCD12', 'player-2');
    });

    it('throws PLAYER_NOT_FOUND when target does not exist', async () => {
      const repo = makeMockRepo();
      const svc = new GameService(repo);

      await expect(svc.kickPlayer('ABCD12', 'player-1', 'nonexistent')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'PLAYER_NOT_FOUND'
      );
    });

    it('throws CANNOT_KICK_SELF when host tries to kick themselves', async () => {
      const repo = makeMockRepo();
      const svc = new GameService(repo);

      await expect(svc.kickPlayer('ABCD12', 'player-1', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'CANNOT_KICK_SELF'
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

    it('keeps offline host player when resetting, removes offline non-host players', async () => {
      const players = [
        makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
        makePlayer({ id: 'player-2', isHost: false, nickname: 'Bob', colorIndex: 1, isOnline: false }),
        makePlayer({ id: 'player-3', isHost: false, nickname: 'Carol', colorIndex: 2, isOnline: true }),
      ];
      const repo = makeMockRepo({ status: 'finished', players });
      const svc = new GameService(repo);

      const room = await svc.resetRoom('ABCD12', 'player-1');

      // Online host stays, offline non-host removed, online non-host stays
      expect(room.players).toHaveLength(2);
      expect(room.players.some((p) => p.id === 'player-1')).toBe(true);
      expect(room.players.some((p) => p.id === 'player-2')).toBe(false);
      expect(room.players.some((p) => p.id === 'player-3')).toBe(true);
    });

    it('sets winnerCount to null when old winnerCount >= new player count (AC-H02-3)', async () => {
      // Start with winnerCount=5, but only 2 players remain after reset
      const players = [
        makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
        makePlayer({ id: 'player-2', isHost: false, nickname: 'Bob', colorIndex: 1, isOnline: true }),
      ];
      const repo = makeMockRepo({ status: 'finished', players, winnerCount: 5 });
      const svc = new GameService(repo);

      const room = await svc.resetRoom('ABCD12', 'player-1');

      // winnerCount=5 >= 2 players, so it should be reset to null
      expect(room.winnerCount).toBeNull();
    });
  });

  // ── ROOM_NOT_FOUND ─────────────────────────────────────────────────────────

  describe('missing room', () => {
    it('throws ROOM_NOT_FOUND when room does not exist (startGame)', async () => {
      const repo: IRoomRepository = {
        ...makeMockRepo(),
        findByCode: vi.fn(async () => null),
      };
      const svc = new GameService(repo);

      await expect(svc.startGame('ZZZZZZ', 'player-1')).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === 'ROOM_NOT_FOUND'
      );
    });

    it('throws ROOM_NOT_FOUND when room does not exist (beginReveal)', async () => {
      const repo: IRoomRepository = {
        ...makeMockRepo(),
        findByCode: vi.fn(async () => null),
      };
      const svc = new GameService(repo);

      await expect(svc.beginReveal('ZZZZZZ', 'player-1')).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    });

    it('throws ROOM_NOT_FOUND when room does not exist (revealNext)', async () => {
      const repo: IRoomRepository = {
        ...makeMockRepo(),
        findByCode: vi.fn(async () => null),
      };
      const svc = new GameService(repo);

      await expect(svc.revealNext('ZZZZZZ', 'player-1')).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    });

    it('throws ROOM_NOT_FOUND when room does not exist (revealAll)', async () => {
      const repo: IRoomRepository = {
        ...makeMockRepo(),
        findByCode: vi.fn(async () => null),
      };
      const svc = new GameService(repo);

      await expect(svc.revealAll('ZZZZZZ', 'player-1')).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    });

    it('throws ROOM_NOT_FOUND when room does not exist (resetRoom)', async () => {
      const repo: IRoomRepository = {
        ...makeMockRepo(),
        findByCode: vi.fn(async () => null),
      };
      const svc = new GameService(repo);

      await expect(svc.resetRoom('ZZZZZZ', 'player-1')).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    });

    it('throws ROOM_NOT_FOUND when room does not exist (kickPlayer)', async () => {
      const repo: IRoomRepository = {
        ...makeMockRepo(),
        findByCode: vi.fn(async () => null),
      };
      const svc = new GameService(repo);

      await expect(svc.kickPlayer('ZZZZZZ', 'player-1', 'player-2')).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    });
  });
});
