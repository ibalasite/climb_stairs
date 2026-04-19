import { randomInt, randomUUID } from 'node:crypto';
import type { Room, Player } from '@ladder-room/shared';
import type { IRoomRepository } from '../../infrastructure/redis/IRoomRepository.js';
import { DomainError } from '../../domain/errors/DomainError.js';

// Charset excludes ambiguous chars: 0, 1, I, O
const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const MAX_PLAYERS = 50;
const MAX_CODE_ATTEMPTS = 10;
const NICKNAME_MIN = 1;
const NICKNAME_MAX = 20;
const COLOR_INDICES = 50;

export class RoomService {
  constructor(private readonly repo: IRoomRepository) {}

  generateRoomCode(): string {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      const idx = randomInt(0, ROOM_CODE_CHARSET.length);
      code += ROOM_CODE_CHARSET[idx];
    }
    return code;
  }

  private validateNickname(nickname: string): void {
    const trimmed = nickname.trim();
    if (trimmed.length < NICKNAME_MIN || trimmed.length > NICKNAME_MAX) {
      throw new DomainError(
        'INVALID_NICKNAME',
        `Nickname must be between ${NICKNAME_MIN} and ${NICKNAME_MAX} characters`,
        422
      );
    }
  }

  async createRoom(hostNickname: string, winnerCount: number): Promise<{ room: Room; hostId: string }> {
    this.validateNickname(hostNickname);

    if (winnerCount < 1) {
      throw new DomainError('INVALID_WINNER_COUNT', 'Winner count must be at least 1', 422);
    }

    const now = new Date().toISOString();
    const hostId = randomUUID().replace(/-/g, '');

    const hostPlayer: Player = {
      id: hostId,
      nickname: hostNickname.trim(),
      colorIndex: 0,
      isHost: true,
      isOnline: true,
      joinedAt: now,
      result: null,
    };

    let attempts = 0;
    while (attempts < MAX_CODE_ATTEMPTS) {
      const code = this.generateRoomCode();
      const existing = await this.repo.findByCode(code);
      if (existing !== null) {
        attempts++;
        continue;
      }

      const room: Room = {
        code,
        status: 'waiting',
        hostId,
        players: [hostPlayer],
        winnerCount,
        ladder: null,
        results: null,
        revealedCount: 0,
        revealMode: 'manual',
        autoRevealIntervalSec: null,
        kickedPlayerIds: [],
        createdAt: now,
        updatedAt: now,
      };

      await this.repo.create(room);
      return { room, hostId };
    }

    throw new DomainError('CODE_COLLISION', 'Failed to generate a unique room code', 503);
  }

  async joinRoom(code: string, nickname: string): Promise<{ room: Room; playerId: string }> {
    this.validateNickname(nickname);

    const room = await this.repo.findByCode(code);
    if (room === null) {
      throw new DomainError('ROOM_NOT_FOUND', `Room ${code} not found`, 404);
    }

    if (room.status !== 'waiting') {
      throw new DomainError('ROOM_NOT_ACCEPTING', 'Room is not accepting new players', 409);
    }

    if (room.players.length >= MAX_PLAYERS) {
      throw new DomainError('ROOM_FULL', 'Room has reached the maximum player capacity', 409);
    }

    const trimmedNickname = nickname.trim();
    const nicknameAlreadyTaken = room.players.some(
      (p) => p.nickname.toLowerCase() === trimmedNickname.toLowerCase()
    );
    if (nicknameAlreadyTaken) {
      throw new DomainError('NICKNAME_TAKEN', 'This nickname is already taken in the room', 409);
    }

    // Assign first unused colorIndex
    const usedIndices = new Set(room.players.map((p) => p.colorIndex));
    let colorIndex = 0;
    for (let i = 0; i < COLOR_INDICES; i++) {
      if (!usedIndices.has(i)) {
        colorIndex = i;
        break;
      }
    }

    const now = new Date().toISOString();
    const playerId = randomUUID().replace(/-/g, '');

    const newPlayer: Player = {
      id: playerId,
      nickname: trimmedNickname,
      colorIndex,
      isHost: false,
      isOnline: true,
      joinedAt: now,
      result: null,
    };

    const updatedRoom = await this.repo.update(code, {
      players: [...room.players, newPlayer],
    });

    return { room: updatedRoom, playerId };
  }
}
