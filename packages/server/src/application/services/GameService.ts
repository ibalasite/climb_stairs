import { randomUUID } from 'node:crypto';
import type { Room, ResultSlot } from '@ladder-room/shared';
import { validateGameStart, generateLadder, computeResults } from '@ladder-room/shared';
import type { IRoomRepository } from '../../infrastructure/redis/IRoomRepository.js';
import { DomainError } from '../../domain/errors/DomainError.js';

export class GameService {
  constructor(private readonly repo: IRoomRepository) {}

  private async requireRoom(code: string): Promise<Room> {
    const room = await this.repo.findByCode(code);
    if (room === null) {
      throw new DomainError('ROOM_NOT_FOUND', `Room ${code} not found`, 404);
    }
    return room;
  }

  private assertHost(room: Room, playerId: string): void {
    if (room.hostId !== playerId) {
      throw new DomainError('NOT_HOST', 'Only the host can perform this action', 403);
    }
  }

  async startGame(roomCode: string, hostPlayerId: string): Promise<Room> {
    const room = await this.requireRoom(roomCode);
    this.assertHost(room, hostPlayerId);

    if (room.status !== 'waiting') {
      throw new DomainError('INVALID_STATE', 'Room must be in waiting state to start', 409);
    }

    const playerCount = room.players.length;
    const validationError = validateGameStart(playerCount, room.winnerCount);
    if (validationError !== null) {
      throw new DomainError(validationError.code, validationError.message, 422);
    }

    // winnerCount is guaranteed non-null after validation
    const winnerCount = room.winnerCount as number;

    const seedSource = `${roomCode}-${randomUUID()}`;
    const ladder = generateLadder(seedSource, playerCount);
    const rawResults = computeResults(ladder, winnerCount);

    // Bind player IDs to result slots — every slot must map to a real player
    const results: ResultSlot[] = rawResults.map((slot) => {
      const player = room.players[slot.playerIndex];
      if (player === undefined) {
        throw new DomainError(
          'RESULT_PLAYER_MISMATCH',
          `Result slot playerIndex ${slot.playerIndex} has no corresponding player`,
          500
        );
      }
      return {
        ...slot,
        playerId: player.id,
      };
    });

    return this.repo.update(roomCode, {
      status: 'running',
      ladder,
      results,
      revealedCount: 0,
    });
  }

  async beginReveal(roomCode: string, hostPlayerId: string): Promise<Room> {
    const room = await this.requireRoom(roomCode);
    this.assertHost(room, hostPlayerId);

    if (room.status !== 'running') {
      throw new DomainError('INVALID_STATE', 'Room must be in running state to begin reveal', 409);
    }

    return this.repo.update(roomCode, { status: 'revealing' });
  }

  async revealNext(roomCode: string, hostPlayerId: string): Promise<{ result: ResultSlot; room: Room }> {
    const room = await this.requireRoom(roomCode);
    this.assertHost(room, hostPlayerId);

    if (room.status !== 'revealing') {
      throw new DomainError('INVALID_STATE', 'Room must be in revealing state', 409);
    }

    if (room.results === null) {
      throw new DomainError('NO_RESULTS', 'No results available', 500);
    }

    const newCount = await this.repo.incrementRevealedCount(roomCode);
    const index = newCount - 1;

    // Guard: if the atomic counter exceeded array bounds (e.g. concurrent calls),
    // treat it as out-of-bounds rather than returning undefined data.
    if (index < 0 || index >= room.results.length) {
      throw new DomainError('REVEAL_OUT_OF_BOUNDS', 'No more results to reveal', 422);
    }

    const result = room.results[index]!;

    const allRevealed = newCount >= room.results.length;
    // Only persist the status change — revealedCount is owned by the atomic counter,
    // not by the document update, to avoid a non-atomic read-modify-write race.
    const updatedRoom = await this.repo.update(roomCode, {
      revealedCount: newCount,
      ...(allRevealed ? { status: 'finished' } : {}),
    });

    return { result, room: updatedRoom };
  }

  async revealAll(roomCode: string, hostPlayerId: string): Promise<{ results: ResultSlot[]; room: Room }> {
    const room = await this.requireRoom(roomCode);
    this.assertHost(room, hostPlayerId);

    if (room.status !== 'revealing') {
      throw new DomainError('INVALID_STATE', 'Room must be in revealing state', 409);
    }

    if (room.results === null) {
      throw new DomainError('NO_RESULTS', 'No results available', 500);
    }

    const currentRevealed = await this.repo.getRevealedCount(roomCode);
    const remaining = Array.from(room.results).slice(currentRevealed);

    const updatedRoom = await this.repo.update(roomCode, {
      revealedCount: room.results.length,
      status: 'finished',
    });

    return { results: remaining, room: updatedRoom };
  }

  async resetRoom(roomCode: string, hostPlayerId: string): Promise<Room> {
    const room = await this.requireRoom(roomCode);
    this.assertHost(room, hostPlayerId);

    if (room.status !== 'finished') {
      throw new DomainError('INVALID_STATE', 'Room must be in finished state to reset', 409);
    }

    // Prune offline players, keep host always
    const onlinePlayers = room.players.filter((p) => p.isOnline || p.id === hostPlayerId);

    if (onlinePlayers.length < 2) {
      throw new DomainError(
        'INSUFFICIENT_ONLINE_PLAYERS',
        'At least 2 online players are required to reset',
        422
      );
    }

    await this.repo.clearKickedPlayers(roomCode);

    // Reset player results
    const resetPlayers = onlinePlayers.map((p) => ({ ...p, result: null }));

    // AC-H02-3: if the old winnerCount would be invalid for the new player count,
    // null it out so the host must re-configure before starting.
    const newPlayerCount = onlinePlayers.length;
    const adjustedWinnerCount =
      room.winnerCount !== null && room.winnerCount >= newPlayerCount ? null : room.winnerCount;

    return this.repo.update(roomCode, {
      status: 'waiting',
      ladder: null,
      results: null,
      revealedCount: 0,
      players: resetPlayers,
      winnerCount: adjustedWinnerCount,
    });
  }

  async kickPlayer(roomCode: string, hostPlayerId: string, targetPlayerId: string): Promise<Room> {
    const room = await this.requireRoom(roomCode);
    this.assertHost(room, hostPlayerId);

    if (room.status !== 'waiting') {
      throw new DomainError('INVALID_STATE', 'Can only kick players in waiting state', 409);
    }

    if (targetPlayerId === hostPlayerId) {
      throw new DomainError('CANNOT_KICK_SELF', 'Host cannot kick themselves', 422);
    }

    const targetExists = room.players.some((p) => p.id === targetPlayerId);
    if (!targetExists) {
      throw new DomainError('PLAYER_NOT_FOUND', `Player ${targetPlayerId} not found in room`, 404);
    }

    await this.repo.addKickedPlayer(roomCode, targetPlayerId);

    const remainingPlayers = room.players.filter((p) => p.id !== targetPlayerId);
    return this.repo.update(roomCode, { players: remainingPlayers });
  }
}
