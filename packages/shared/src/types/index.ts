// ─── Room Status ───────────────────────────────────────────────────────────────

export type RoomStatus = 'waiting' | 'running' | 'revealing' | 'finished';

// ─── WebSocket Event Types (Server → Client) ────────────────────────────────

export type WsEventType =
  | 'ROOM_STATE'
  | 'ROOM_STATE_FULL'
  | 'REVEAL_INDEX'
  | 'REVEAL_ALL'
  | 'PLAYER_KICKED'
  | 'SESSION_REPLACED'
  | 'HOST_TRANSFERRED'
  | 'ERROR';

// ─── WebSocket Message Types (Client → Server) ──────────────────────────────

export type WsMsgType =
  | 'START_GAME'
  | 'BEGIN_REVEAL'
  | 'REVEAL_NEXT'
  | 'REVEAL_ALL_TRIGGER'
  | 'SET_REVEAL_MODE'
  | 'RESET_ROOM'
  | 'KICK_PLAYER'
  | 'PING';

// ─── Core Domain Interfaces ──────────────────────────────────────────────────

export interface Player {
  id: string;
  nickname: string;
  /** 0–49 */
  colorIndex: number;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: string;
  result?: string | null;
}

export interface LadderSegment {
  row: number;
  col: number;
}

export interface LadderData {
  seed: number;
  seedSource: string;
  rowCount: number;
  colCount: number;
  segments: readonly LadderSegment[];
}

export type PathDirection = 'down' | 'left' | 'right';

export interface PathStep {
  row: number;
  col: number;
  direction: PathDirection;
}

export interface ResultSlot {
  playerIndex: number;
  playerId: string;
  startCol: number;
  endCol: number;
  isWinner: boolean;
  path: readonly PathStep[];
}

export interface Room {
  code: string;
  status: RoomStatus;
  hostId: string;
  readonly players: readonly Player[];
  winnerCount: number | null;
  ladder: LadderData | null;
  results: readonly ResultSlot[] | null;
  revealedCount: number;
  revealMode: 'manual' | 'auto';
  autoRevealIntervalSec: number | null;
  readonly kickedPlayerIds: readonly string[];
  createdAt: string;
  updatedAt: string;
}

// ─── WebSocket Envelopes ─────────────────────────────────────────────────────

export interface ServerEnvelope<T> {
  type: WsEventType;
  ts: number;
  payload: T;
}

export interface ClientEnvelope<T> {
  type: WsMsgType;
  ts: number;
  payload: T;
}

// ─── Server → Client Payload Types ──────────────────────────────────────────

export interface RoomSummaryPayload {
  code: string;
  status: RoomStatus;
  playerCount: number;
  hostId: string;
}

export interface RoomStatePayload {
  code: string;
  status: RoomStatus;
  hostId: string;
  players: readonly Player[];
  winnerCount: number | null;
  revealedCount: number;
  revealMode: 'manual' | 'auto';
  autoRevealIntervalSec: number | null;
}

export interface RoomStateFullPayload extends RoomStatePayload {
  ladder: LadderData | null;
  results: readonly ResultSlot[] | null;
  kickedPlayerIds: readonly string[];
}

export interface RevealIndexPayload {
  index: number;
  result: ResultSlot;
}

export interface HostTransferredPayload {
  newHostId: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ─── HTTP DTOs ───────────────────────────────────────────────────────────────

export interface CreateRoomRequest {
  nickname: string;
}

export interface CreateRoomResponse {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface JoinRoomRequest {
  roomCode: string;
  nickname: string;
}

export interface JoinRoomResponse {
  roomCode: string;
  playerId: string;
  token: string;
}
