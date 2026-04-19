import type { Room } from '@ladder-room/shared';

export interface IRoomRepository {
  create(room: Room): Promise<void>;
  findByCode(code: string): Promise<Room | null>;
  update(code: string, partial: Partial<Room>): Promise<Room>;
  addKickedPlayer(code: string, playerId: string): Promise<void>;
  isKicked(code: string, playerId: string): Promise<boolean>;
  clearKickedPlayers(code: string): Promise<void>;
  incrementRevealedCount(code: string): Promise<number>;
  resetRevealedCount(code: string): Promise<void>;
  getRevealedCount(code: string): Promise<number>;
  delete(code: string): Promise<void>;
  expireIn(code: string, seconds: number): Promise<void>;
}
