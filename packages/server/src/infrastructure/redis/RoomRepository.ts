import type { Redis } from 'ioredis';
import type { Room } from '@ladder-room/shared';
import type { IRoomRepository } from './IRoomRepository.js';

const ROOM_TTL_SECONDS = Number(process.env['ROOM_TTL_SECONDS'] ?? 86400);

function roomKey(code: string): string {
  return `room:${code}`;
}

function kickedKey(code: string): string {
  return `room:${code}:kicked`;
}

function revealedCountKey(code: string): string {
  return `room:${code}:revealedCount`;
}

export class RoomRepository implements IRoomRepository {
  constructor(private readonly redis: Redis) {}

  async create(room: Room): Promise<void> {
    await this.redis.set(roomKey(room.code), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS);
  }

  async findByCode(code: string): Promise<Room | null> {
    const raw = await this.redis.get(roomKey(code));
    if (raw === null) return null;
    return JSON.parse(raw) as Room;
  }

  async update(code: string, partial: Partial<Room>): Promise<Room> {
    const raw = await this.redis.get(roomKey(code));
    if (raw === null) {
      throw new Error(`Room ${code} not found`);
    }
    const existing = JSON.parse(raw) as Room;
    const updated: Room = { ...existing, ...partial, updatedAt: Date.now() };

    // Get remaining TTL to preserve it; fall back to default if -1 (no TTL) or -2 (missing)
    const ttl = await this.redis.ttl(roomKey(code));
    const effectiveTtl = ttl > 0 ? ttl : ROOM_TTL_SECONDS;

    await this.redis.set(roomKey(code), JSON.stringify(updated), 'EX', effectiveTtl);
    return updated;
  }

  async addKickedPlayer(code: string, playerId: string): Promise<void> {
    await this.redis.sadd(kickedKey(code), playerId);
  }

  async isKicked(code: string, playerId: string): Promise<boolean> {
    const result = await this.redis.sismember(kickedKey(code), playerId);
    return result === 1;
  }

  async clearKickedPlayers(code: string): Promise<void> {
    await this.redis.del(kickedKey(code));
  }

  async incrementRevealedCount(code: string): Promise<number> {
    return this.redis.incr(revealedCountKey(code));
  }

  async getRevealedCount(code: string): Promise<number> {
    const raw = await this.redis.get(revealedCountKey(code));
    if (raw === null) return 0;
    return Number(raw);
  }

  async delete(code: string): Promise<void> {
    await this.redis.del(roomKey(code), kickedKey(code), revealedCountKey(code));
  }

  async expireIn(code: string, seconds: number): Promise<void> {
    await this.redis.expire(roomKey(code), seconds);
  }
}
