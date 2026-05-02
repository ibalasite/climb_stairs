import { redis } from './infrastructure/redis/RedisClient.js';
import { RoomRepository } from './infrastructure/redis/RoomRepository.js';
import { ReplayRepository } from './infrastructure/redis/ReplayRepository.js';
import { RoomService } from './application/services/RoomService.js';
import { GameService } from './application/services/GameService.js';

export function createContainer() {
  const repo = new RoomRepository(redis);
  const replayRepo = new ReplayRepository(redis);
  const roomService = new RoomService(repo);
  const gameService = new GameService(repo);
  return { repo, replayRepo, roomService, gameService, redis };
}
