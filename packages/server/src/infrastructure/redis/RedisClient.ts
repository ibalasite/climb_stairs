import { Redis } from 'ioredis';

export const redis = new Redis({
  host: process.env['REDIS_HOST'] ?? 'localhost',
  port: Number(process.env['REDIS_PORT'] ?? 6379),
  db: Number(process.env['REDIS_DB'] ?? 0),
  password: process.env['REDIS_PASSWORD'] || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});
