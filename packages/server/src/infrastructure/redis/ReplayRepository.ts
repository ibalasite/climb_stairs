import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { Replay, ReplaySummary } from '@ladder-room/shared';

const REPLAY_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const LIST_KEY = 'replays:list';
const LIST_MAX = 500;

export class ReplayRepository {
  constructor(private readonly redis: Redis) {}

  private key(id: string): string {
    return `replay:${id}`;
  }

  async save(payload: Omit<Replay, 'id'>): Promise<Replay> {
    const id = randomUUID().replace(/-/g, '').slice(0, 16);
    const replay: Replay = { id, ...payload };
    const key = this.key(id);
    await this.redis.set(key, JSON.stringify(replay), 'EX', REPLAY_TTL_SEC);
    await this.redis.zadd(LIST_KEY, payload.finishedAt, id);
    // Cap list size
    await this.redis.zremrangebyrank(LIST_KEY, 0, -(LIST_MAX + 1));
    return replay;
  }

  async findById(id: string): Promise<Replay | null> {
    const raw = await this.redis.get(this.key(id));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as Replay;
    } catch {
      return null;
    }
  }

  /** Most recent first. */
  async list(limit = 20): Promise<ReplaySummary[]> {
    const ids = await this.redis.zrevrange(LIST_KEY, 0, limit - 1);
    if (ids.length === 0) return [];
    const keys = ids.map(id => this.key(id));
    const raws = await this.redis.mget(...keys);
    const out: ReplaySummary[] = [];
    for (let i = 0; i < raws.length; i++) {
      const raw = raws[i];
      const idAtIndex = ids[i];
      if (raw === null || raw === undefined) {
        if (idAtIndex !== undefined) await this.redis.zrem(LIST_KEY, idAtIndex);
        continue;
      }
      try {
        const r = JSON.parse(raw) as Replay;
        out.push({
          id: r.id,
          roomCode: r.roomCode,
          ...(r.prize !== undefined ? { prize: r.prize } : {}),
          playerCount: r.players.length,
          finishedAt: r.finishedAt,
        });
      } catch { /* ignore corrupt */ }
    }
    return out;
  }
}
