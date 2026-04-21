/**
 * Supplemental tests for GameService — RESULT_PLAYER_MISMATCH edge case.
 *
 * The RESULT_PLAYER_MISMATCH branch (lines 49-54 in GameService.ts) fires when
 * computeResults returns a slot whose playerIndex exceeds the players array
 * bounds.  This is a defensive guard against internal inconsistency.
 *
 * We trigger this by mocking @ladder-room/shared so that computeResults returns
 * an out-of-bounds playerIndex, making the branch reachable.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Room, Player } from '@ladder-room/shared';
import type { IRoomRepository } from '../../infrastructure/redis/IRoomRepository.js';
import { DomainError } from '../../domain/errors/DomainError.js';

// ─── Mock @ladder-room/shared ─────────────────────────────────────────────────

vi.mock('@ladder-room/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ladder-room/shared')>();
  return {
    ...original,
    computeResults: vi.fn((_ladder: unknown, _winnerCount: number) => [
      // Return a slot with playerIndex=99, which will be out of bounds for any small players array
      {
        playerIndex: 99,
        playerId: '',
        startCol: 0,
        endCol: 0,
        isWinner: false,
        path: [],
      },
    ]),
  };
});

// Import GameService AFTER the mock is set up
const { GameService } = await import('../../application/services/GameService.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    players: [
      makePlayer({ id: 'player-1', isHost: true }),
      makePlayer({ id: 'player-2', isHost: false, nickname: 'Bob', colorIndex: 1 }),
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GameService — RESULT_PLAYER_MISMATCH defensive guard', () => {
  it('throws RESULT_PLAYER_MISMATCH when computeResults returns an out-of-bounds playerIndex', async () => {
    // Arrange: players array has 2 entries (indices 0 and 1);
    // the mock computeResults returns playerIndex=99 which is out of bounds.
    const repo = makeMockRepo();
    const svc = new GameService(repo);

    // Act & Assert
    await expect(svc.startGame('ABCD12', 'player-1')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof DomainError &&
        e.code === 'RESULT_PLAYER_MISMATCH'
    );
  });
});
