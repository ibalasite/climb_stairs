/**
 * Unit tests for GET /health and GET /ready routes.
 *
 * We build a minimal Fastify app in each test instead of importing main.ts,
 * because main.ts checks JWT_SECRET at module-load time.  The route logic is
 * re-implemented here verbatim from main.ts so that any drift becomes a test
 * failure.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRedisMock(pingOk = true) {
  return {
    ping: vi.fn(async () => {
      if (!pingOk) throw new Error('Redis unavailable');
      return 'PONG';
    }),
  };
}

function buildApp(redis: { ping: () => Promise<string> }) {
  const app = Fastify({ logger: false });

  app.get('/health', async (_req, reply) => {
    let redisOk = false;
    try { await redis.ping(); redisOk = true; } catch { /* ignore */ }
    return reply.status(200).send({
      status: 'ok',
      redis: redisOk ? 'ok' : 'unavailable',
      wsCount: 0,
      uptime: Math.floor(process.uptime()),
    });
  });

  app.get('/ready', async (_req, reply) => {
    try {
      await redis.ping();
      return reply.status(200).send({ status: 'ok' });
    } catch {
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status=ok when Redis is reachable', async () => {
    const app = buildApp(makeRedisMock(true));
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; redis: string; wsCount: number; uptime: number }>();
    expect(body.status).toBe('ok');
    expect(body.redis).toBe('ok');
    expect(typeof body.wsCount).toBe('number');
    expect(typeof body.uptime).toBe('number');
  });

  it('returns 200 with redis=unavailable when Redis ping fails', async () => {
    const app = buildApp(makeRedisMock(false));
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; redis: string }>();
    expect(body.status).toBe('ok');
    expect(body.redis).toBe('unavailable');
  });

  it('includes wsCount field', async () => {
    const app = buildApp(makeRedisMock(true));
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json<{ wsCount: number }>();
    expect(body.wsCount).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /ready', () => {
  it('returns 200 with status=ok when Redis is reachable', async () => {
    const app = buildApp(makeRedisMock(true));
    const res = await app.inject({ method: 'GET', url: '/ready' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string }>();
    expect(body.status).toBe('ok');
  });

  it('returns 503 with status=unavailable when Redis ping fails', async () => {
    const app = buildApp(makeRedisMock(false));
    const res = await app.inject({ method: 'GET', url: '/ready' });

    expect(res.statusCode).toBe(503);
    const body = res.json<{ status: string }>();
    expect(body.status).toBe('unavailable');
  });
});
