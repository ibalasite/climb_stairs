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
  | 'CHAT_BROADCAST'
  | 'REVEAL_PLAYER'
  | 'REPLAY_AVAILABLE'
  | 'ERROR'
  | 'PONG';

// ─── WebSocket Message Types (Client → Server) ──────────────────────────────

export type WsMsgType =
  | 'START_GAME'
  | 'BEGIN_REVEAL'
  | 'REVEAL_NEXT'
  | 'REVEAL_ALL_TRIGGER'
  | 'SET_REVEAL_MODE'
  | 'RESET_ROOM'
  | 'KICK_PLAYER'
  | 'PING'
  | 'END_GAME'
  | 'PLAY_AGAIN'
  | 'CHAT_MESSAGE'
  | 'SET_WINNER_COUNT'
  | 'SET_AVATAR'
  | 'SET_PRIZE'
  | 'REVEAL_PLAYER_PICK';

// ─── Core Domain Interfaces ──────────────────────────────────────────────────

export interface Player {
  id: string;
  nickname: string;
  /** 0–49 */
  colorIndex: number;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: number;
  result?: string | null;
  /**
   * Avatar — one of:
   *   - emoji string (e.g. "🦊") for server-assigned defaults
   *   - data URI ("data:image/...") for user-uploaded images
   *   - undefined / empty for legacy rooms (fallback to colored initial)
   */
  avatar?: string;
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
  /** Free-text prize description shown to all players (≤ 120 chars). */
  prize?: string;
  /** PlayerIds revealed via REVEAL_PLAYER, in click order (host's pick order). */
  readonly revealedPlayerIds?: readonly string[];
  createdAt: number;
  updatedAt: number;
}

// ─── Replay (immutable snapshot stored after game finishes) ─────────────────

export interface Replay {
  id: string;
  roomCode: string;
  prize?: string;
  players: readonly Player[];
  ladder: LadderData;
  results: readonly ResultSlot[];
  /** Order in which results were revealed (by playerId). */
  revealedPlayerIds: readonly string[];
  finishedAt: number;
}

export interface ReplaySummary {
  id: string;
  roomCode: string;
  prize?: string;
  playerCount: number;
  finishedAt: number;
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
  onlineCount: number;
  maxPlayers: number;
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
  selfPlayerId: string;
}

export interface RevealIndexPayload {
  playerIndex: number;
  result: ResultSlot;
  revealedCount: number;
  totalCount: number;
}

export interface HostTransferredPayload {
  newHostId: string;
  reason: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ─── HTTP DTOs ───────────────────────────────────────────────────────────────

export interface CreateRoomRequest {
  hostNickname: string;
  winnerCount?: number;
}

export interface CreateRoomResponse {
  roomCode: string;
  playerId: string;
  token: string;
  room: Room;
}

export interface JoinRoomRequest {
  roomCode: string;
  nickname: string;
}

export interface JoinRoomResponse {
  playerId: string;
  token: string;
  room: Room;
}

// ─── Additional WebSocket Payload Types ──────────────────────────────────────

export interface SessionReplacedPayload {
  message: string;
}
