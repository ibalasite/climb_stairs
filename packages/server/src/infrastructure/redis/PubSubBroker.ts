import type { Redis } from 'ioredis';

interface BroadcastEnvelope {
  payload: unknown;
  excludePlayerId?: string;
}

export type FanoutHandler = (roomCode: string, payload: unknown, excludePlayerId?: string) => void;

const CHANNEL_PATTERN = 'room:*:events';
const channelRe = /^room:([^:]+):events$/;

export class PubSubBroker {
  private subClient: Redis;

  constructor(private pubClient: Redis) {
    this.subClient = pubClient.duplicate();
  }

  async start(onMessage: FanoutHandler): Promise<void> {
    await this.subClient.psubscribe(CHANNEL_PATTERN);
    this.subClient.on('pmessage', (_pattern, channel, message) => {
      const m = channelRe.exec(channel);
      if (!m) return;
      const roomCode = m[1]!;
      let env: BroadcastEnvelope;
      try {
        env = JSON.parse(message) as BroadcastEnvelope;
      } catch {
        return;
      }
      onMessage(roomCode, env.payload, env.excludePlayerId);
    });
  }

  async publish(roomCode: string, payload: unknown, excludePlayerId?: string): Promise<void> {
    const env: BroadcastEnvelope = excludePlayerId === undefined
      ? { payload }
      : { payload, excludePlayerId };
    await this.pubClient.publish(`room:${roomCode}:events`, JSON.stringify(env));
  }

  async stop(): Promise<void> {
    try { await this.subClient.quit(); } catch { /* ignore */ }
  }
}
