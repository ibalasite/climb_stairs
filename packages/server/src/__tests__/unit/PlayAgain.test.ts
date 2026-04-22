import { describe, it, expect, vi } from 'vitest';
import type { Room, Player } from '@ladder-room/shared';
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
    status: 'finished',
    hostId: 'player-1',
    players: [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: true }),
    ],
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
    resetRevealedCount: vi.fn(async () => {
      storedRoom = { ...storedRoom, revealedCount: 0 };
    }),
    getRevealedCount: vi.fn(async () => storedRoom.revealedCount),
    delete: vi.fn(),
    expireIn: vi.fn(),
  };
}

// ─── playAgain tests ─────────────────────────────────────────────────────────

describe('GameService.playAgain', () => {
  // 1. Normal flow: finished → playAgain → status=waiting, ladder=null, results=null, revealedCount=0
  it('resets finished room to waiting state clearing game data', async () => {
    const repo = makeMockRepo({ status: 'finished' });
    const svc = new GameService(repo);

    const room = await svc.playAgain('ABCD12', 'player-1');

    expect(room.status).toBe('waiting');
    expect(room.ladder).toBeNull();
    expect(room.results).toBeNull();
    expect(room.revealedCount).toBe(0);
  });

  // 2. Non-host call: throw NOT_HOST error
  it('throws NOT_HOST when caller is not the host', async () => {
    const repo = makeMockRepo({ status: 'finished' });
    const svc = new GameService(repo);

    await expect(svc.playAgain('ABCD12', 'not-the-host')).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === 'NOT_HOST'
    );
  });

  // 3. Non-finished state: throw INVALID_STATE error
  it('throws INVALID_STATE when room is not in finished state', async () => {
    const repo = makeMockRepo({ status: 'running' });
    const svc = new GameService(repo);

    await expect(svc.playAgain('ABCD12', 'player-1')).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === 'INVALID_STATE'
    );
  });

  it('throws INVALID_STATE when room is in waiting state', async () => {
    const repo = makeMockRepo({ status: 'waiting' });
    const svc = new GameService(repo);

    await expect(svc.playAgain('ABCD12', 'player-1')).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === 'INVALID_STATE'
    );
  });

  // 4. Online players < 2: throw INSUFFICIENT_ONLINE_PLAYERS error
  it('throws INSUFFICIENT_ONLINE_PLAYERS when fewer than 2 online players remain', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: false }),
    ];
    const repo = makeMockRepo({ status: 'finished', players });
    const svc = new GameService(repo);

    await expect(svc.playAgain('ABCD12', 'player-1')).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === 'INSUFFICIENT_ONLINE_PLAYERS'
    );
  });

  it('throws INSUFFICIENT_ONLINE_PLAYERS when only the host is present (no other players)', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
    ];
    const repo = makeMockRepo({ status: 'finished', players });
    const svc = new GameService(repo);

    await expect(svc.playAgain('ABCD12', 'player-1')).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === 'INSUFFICIENT_ONLINE_PLAYERS'
    );
  });

  // 5. kickedPlayerIds reset: playAgain calls clearKickedPlayers
  it('calls clearKickedPlayers so kicked player list is reset after playAgain', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: true }),
    ];
    const repo = makeMockRepo({ status: 'finished', players, kickedPlayerIds: ['player-x'] });
    const svc = new GameService(repo);

    await svc.playAgain('ABCD12', 'player-1');

    expect(repo.clearKickedPlayers).toHaveBeenCalledWith('ABCD12');
  });

  // 6. winnerCount auto-adjustment: new online player count < old winnerCount → reset to null
  it('sets winnerCount to null when old winnerCount >= new online player count', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: true }),
    ];
    const repo = makeMockRepo({ status: 'finished', players, winnerCount: 5 });
    const svc = new GameService(repo);

    const room = await svc.playAgain('ABCD12', 'player-1');

    // winnerCount=5 >= 2 players → must be reset to null
    expect(room.winnerCount).toBeNull();
  });

  it('preserves winnerCount when it remains valid for the new online player count', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: true }),
      makePlayer({ id: 'player-3', nickname: 'Carol', colorIndex: 2, isHost: false, isOnline: true }),
    ];
    const repo = makeMockRepo({ status: 'finished', players, winnerCount: 1 });
    const svc = new GameService(repo);

    const room = await svc.playAgain('ABCD12', 'player-1');

    // winnerCount=1 < 3 players → preserved
    expect(room.winnerCount).toBe(1);
  });

  it('sets winnerCount to null when winnerCount equals new player count (boundary)', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: true }),
    ];
    // winnerCount equals playerCount (2) — invalid, must be nulled
    const repo = makeMockRepo({ status: 'finished', players, winnerCount: 2 });
    const svc = new GameService(repo);

    const room = await svc.playAgain('ABCD12', 'player-1');

    expect(room.winnerCount).toBeNull();
  });

  // Additional: offline players are pruned, host always retained
  it('removes offline non-host players and retains all online players', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: true }),
      makePlayer({ id: 'player-3', nickname: 'Carol', colorIndex: 2, isHost: false, isOnline: false }),
    ];
    const repo = makeMockRepo({ status: 'finished', players });
    const svc = new GameService(repo);

    const room = await svc.playAgain('ABCD12', 'player-1');

    expect(room.players).toHaveLength(2);
    expect(room.players.some((p) => p.id === 'player-1')).toBe(true);
    expect(room.players.some((p) => p.id === 'player-2')).toBe(true);
    expect(room.players.some((p) => p.id === 'player-3')).toBe(false);
  });

  it('retains offline host regardless of online status', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: false }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: true }),
    ];
    const repo = makeMockRepo({ status: 'finished', players });
    const svc = new GameService(repo);

    const room = await svc.playAgain('ABCD12', 'player-1');

    expect(room.players.some((p) => p.id === 'player-1')).toBe(true);
    expect(room.players).toHaveLength(2);
  });

  it('throws ROOM_NOT_FOUND when room does not exist', async () => {
    const repo: IRoomRepository = {
      ...makeMockRepo(),
      findByCode: vi.fn(async () => null),
    };
    const svc = new GameService(repo);

    await expect(svc.playAgain('ZZZZZZ', 'player-1')).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
  });

  it('resets player result field to null for all retained players', async () => {
    const players = [
      makePlayer({ id: 'player-1', isHost: true, isOnline: true, result: 'winner' as unknown as null }),
      makePlayer({ id: 'player-2', nickname: 'Bob', colorIndex: 1, isHost: false, isOnline: true, result: 'loser' as unknown as null }),
    ];
    const repo = makeMockRepo({ status: 'finished', players });
    const svc = new GameService(repo);

    const room = await svc.playAgain('ABCD12', 'player-1');

    for (const player of room.players) {
      expect(player.result).toBeNull();
    }
  });
});
