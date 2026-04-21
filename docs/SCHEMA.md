# SCHEMA.md — Ladder Room Online Redis Schema Design

> Version: v2.1
> Date: 2026-04-21
> Based on: EDD v2.0, PRD v1.4, legacy-SCHEMA v1.1
> Redis is the sole persistence layer. There is no SQL database. All state lives in Redis key-value structures with explicit TTLs.

---

## §1 Redis Data Structures

### §1.1 Key Schema

| Key 模式 | Redis Type | Value | TTL | 用途 |
|---------|-----------|-------|-----|------|
| `room:{code}` | String (JSON) | 序列化的 Room 物件（含 players 陣列） | 24h（每次狀態變更重設） | 房間主狀態 |
| `room:{code}:ladder` | String (JSON) | LadderData JSON（seed、segments、results） | 與主鍵同步 | 梯子結構與結果（BEGIN_REVEAL 時才創建） |
| `room:{code}:revealedCount` | String (counter) | 整數字串，如 `"0"` 到 `"N"` | 與主鍵同步 | 揭示進度原子計數器（INCR） |
| `room:{code}:kicked` | Set | `{ playerId1, playerId2, ... }` | 與主鍵同步 | 踢除玩家 ID 集合，用於重連 WS Upgrade 檢查 |
| `room:{code}:sessions` | Hash | `{ playerId: sessionId }` | 與主鍵同步 | 追蹤活躍 WebSocket Session |

**範例鍵（房間代碼 ALPHA1）：**

```
room:ALPHA1
room:ALPHA1:ladder
room:ALPHA1:revealedCount
room:ALPHA1:kicked
room:ALPHA1:sessions
```

### §1.2 TTL 策略

| 房間狀態 | TTL | 觸發條件 |
|---------|-----|---------|
| `waiting` / `running` / `revealing` | 24h（86400s） | 建立或任何狀態變更時重設 |
| `finished` | 1h（3600s） | 轉換至 `finished` 狀態時（END_GAME EXEC 後） |
| 所有玩家離線 | 5min（300s） | 最後一個 WS 連線關閉時 EXPIRE |
| Pod 重啟 | 維持現有 TTL | Redis 鍵 TTL 在 Pod 重啟後仍有效，只有玩家重連時才重設 |

所有 `room:{code}:*` 子鍵與主鍵使用相同的 TTL，並在主鍵更新時透過 MULTI/EXEC 批次重設 EXPIRE。

### §1.3 序列化策略

| 資料類型 | 儲存方式 |
|---------|---------|
| Room（複雜物件） | JSON 字串，儲存在 Redis String 鍵 |
| LadderData（含 seed、seedSource、segments） | JSON 字串，儲存在 Redis String 鍵 |
| revealedCount | Redis 原生計數器（INCR），整數字串如 `"3"` |
| kickedPlayerIds | Redis Set，成員為 playerId 字串 |
| sessions | Redis Hash，field 為 playerId，value 為 sessionId |

### §1.4 seed 公開時機（安全邊界）

| 房間狀態 | seed 存在於 Redis | seed 傳給客戶端 | ladder 傳給客戶端 |
|---------|-----------------|----------------|-----------------|
| `waiting` | 不存在（尚未生成） | 否 | 否（`null`） |
| `running` | 不存在（START_GAME 不生成梯子） | 否 | 否（`null`） |
| `revealing` | 存在（BEGIN_REVEAL 時生成） | 否 | LadderDataPublic（省略 seed/seedSource） |
| `finished` | 存在 | 是（首次公開，含於 ROOM_STATE 廣播） | LadderData（完整） |

---

## §2 TypeScript Types

以下型別均來自 `packages/shared/src/types/index.ts`，供前後端共用。

### §2.1 RoomStatus

```typescript
export type RoomStatus = 'waiting' | 'running' | 'revealing' | 'finished';
```

### §2.2 Player

```typescript
export interface Player {
  id: string;          // UUID v4，玩家身份識別
  nickname: string;    // 1-20 字元暱稱
  colorIndex: number;  // 0-49，對應客戶端顏色調色板
  isHost: boolean;     // 是否為房主
  isOnline: boolean;   // WebSocket 連線狀態
  joinedAt: number;    // Unix milliseconds
  result?: string | null;  // 遊戲結果（選填）
}
```

### §2.3 LadderData

```typescript
export interface LadderSegment {
  row: number;   // 行索引（0-based）
  col: number;   // 左側欄索引（0-based）；橫槓連接 col 與 col+1
}

export interface LadderData {
  seed: number;         // Mulberry32 seed = djb2(seedSource) >>> 0 (uint32)
  seedSource: string;   // UUID v4，START_GAME 時生成，status=finished 前不對外公開
  rowCount: number;     // clamp(N*3, 20, 60)
  colCount: number;     // = N（所有玩家數，含 isOnline=false）
  segments: readonly LadderSegment[];  // 梯子橫槓位置陣列
}

// 在 revealing 狀態傳給客戶端（省略 seed/seedSource）
// 注意：LadderDataPublic 為伺服器層概念型別，不從 packages/shared 匯出；
// RoomStateFullPayload.ladder 實際型別為 LadderData | null，
// 伺服器在廣播前自行移除 seed/seedSource 欄位。
// LadderDataPublic 僅作為文件參考，不對應 shared 中任何匯出型別。
type LadderDataPublic = Omit<LadderData, 'seed' | 'seedSource'>;
```

### §2.4 PathStep

```typescript
export type PathDirection = 'down' | 'left' | 'right';

export interface PathStep {
  row: number;
  col: number;
  direction: PathDirection;
}
```

### §2.5 ResultSlot

```typescript
export interface ResultSlot {
  playerIndex: number;   // 玩家位置索引（0-based），對應 Canvas 列
  playerId: string;      // UUID v4，穩定身份識別
  startCol: number;      // 起始欄位（0-based）
  endCol: number;        // 終止欄位（0-based）
  isWinner: boolean;     // 是否獲獎（僅 win/lose，無命名獎項）
  path: readonly PathStep[];  // 長度 = rowCount；每步記錄 row, col, direction
}

// REVEAL_ALL payload 專用（省略 path，符合 64KB 限制）
// N=50, rowCount=60 時完整 path 約 150KB，超過 WebSocket maxPayload
// 注意：ResultSlotPublic 為伺服器層概念型別，不從 packages/shared 匯出。
type ResultSlotPublic = Omit<ResultSlot, 'path'>;
```

### §2.6 Room

```typescript
export interface Room {
  code: string;                          // 6 碼房間代碼，字元集 A-HJ-NP-Z2-9
  status: RoomStatus;
  hostId: string;                        // UUID v4，房主 playerId；host transfer 時可變更
  readonly players: readonly Player[];
  winnerCount: number | null;            // null 直到房主設定；PLAY_AGAIN 後若 W >= 新 N 則重設為 null
  ladder: LadderData | null;             // null 直到 BEGIN_REVEAL；Redis 中含完整資料
  results: readonly ResultSlot[] | null; // null 直到 BEGIN_REVEAL
  revealedCount: number;                 // Room JSON 內快照值；原子真相來源為 room:{code}:revealedCount
  revealMode: 'manual' | 'auto';
  autoRevealIntervalSec: number | null;  // 1-30s；manual 時為 null
  readonly kickedPlayerIds: readonly string[];  // 被踢玩家 UUID；冗余鏡像（正本為 Redis Set）
  createdAt: number;                     // Unix milliseconds
  updatedAt: number;                     // Unix milliseconds
}
```

### §2.7 WebSocket Envelopes

```typescript
export interface ServerEnvelope<T> {
  type: WsEventType;
  ts: number;    // Unix milliseconds
  payload: T;
}

export interface ClientEnvelope<T> {
  type: WsMsgType;
  ts: number;    // Unix milliseconds（客戶端時間戳，用於延遲量測）
  payload: T;
}
```

### §2.8 HTTP DTOs

```typescript
export interface CreateRoomRequest {
  hostNickname: string;   // 1-20 字元
  winnerCount?: number;   // 整數 >= 1
}

export interface CreateRoomResponse {
  roomCode: string;   // 6 碼房間代碼
  playerId: string;   // UUID v4
  token: string;      // JWT HS256，role: "host"，TTL 6h
  room: Room;
}

export interface JoinRoomRequest {
  roomCode: string;
  nickname: string;   // 1-20 字元
}

export interface JoinRoomResponse {
  playerId: string;   // UUID v4
  token: string;      // JWT HS256，role: "player"，TTL 6h
  room: Room;
}
```

---

## §3 WebSocket Message Types

### §3.1 WsEventType（Server → Client）

```typescript
export type WsEventType =
  | 'ROOM_STATE'          // 任何房間狀態變更廣播（broadcast）
  | 'ROOM_STATE_FULL'     // WS 連線/重連時完整狀態（unicast）
  | 'REVEAL_INDEX'        // 逐一揭示單一玩家路徑（broadcast）
  | 'REVEAL_ALL'          // 一鍵全揭所有剩餘路徑（broadcast）
  | 'PLAYER_KICKED'       // 通知被踢玩家（unicast）
  | 'SESSION_REPLACED'    // 同一 playerId 新連線，舊連線被替換（unicast）
  | 'HOST_TRANSFERRED'    // 房主斷線 60s 後自動移交（broadcast）
  | 'ERROR';              // 操作失敗通知（unicast）
```

### §3.2 WsMsgType（Client → Server）

```typescript
export type WsMsgType =
  | 'START_GAME'          // Host only，waiting 狀態；生成 seedSource，不生成梯子
  | 'BEGIN_REVEAL'        // Host only，running 狀態；原子生成梯子 + 轉 revealing
  | 'REVEAL_NEXT'         // Host only，revealing 狀態；逐一揭示
  | 'REVEAL_ALL_TRIGGER'  // Host only，revealing 狀態；一鍵全揭
  | 'SET_REVEAL_MODE'     // Host only，revealing 狀態；切換 manual/auto 揭示
  | 'RESET_ROOM'          // 已棄用（由 PLAY_AGAIN 取代）
  | 'KICK_PLAYER'         // Host only，waiting 狀態；踢出指定玩家
  | 'PING';               // 應用層心跳（傳輸層心跳由 ws 內建 30s ping/pong 處理）
```

### §3.3 完整 Server→Client Payload Union

以下型別均從 `packages/shared/src/types/index.ts` 匯出（`export interface`），供前後端共用。

```typescript
// ROOM_STATE（broadcast）
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

// ROOM_STATE_FULL（unicast，含完整 ladder/results）
// ladder 型別為 LadderData | null；伺服器在 revealing 狀態廣播前
// 自行移除 seed/seedSource 欄位，但 TypeScript 型別保持完整 LadderData。
export interface RoomStateFullPayload extends RoomStatePayload {
  ladder: LadderData | null;
  results: readonly ResultSlot[] | null;
  selfPlayerId: string;
}

// REVEAL_INDEX（broadcast）
export interface RevealIndexPayload {
  playerIndex: number;
  result: ResultSlot;      // 含完整 path（單一玩家，安全在 64KB 內）
  revealedCount: number;
  totalCount: number;
}

// REVEAL_ALL（broadcast）
// RevealAllPayload 為伺服器層型別，不從 packages/shared 匯出；
// 伺服器實作時使用 Omit<ResultSlot, 'path'>[] 構造，省略 path 以符合 64KB 限制。
interface RevealAllPayload {
  results: readonly Omit<ResultSlot, 'path'>[];   // 省略 path，符合 64KB 限制
}

// PLAYER_KICKED（unicast）
// PlayerKickedPayload 為伺服器層型別，不從 packages/shared 匯出。
interface PlayerKickedPayload {
  kickedPlayerId: string;
  reason: string;
}

// SESSION_REPLACED（unicast）
export interface SessionReplacedPayload {
  message: string;
}

// HOST_TRANSFERRED（broadcast）
export interface HostTransferredPayload {
  newHostId: string;
  reason: string;  // 實作值為 'disconnect_timeout'，型別為寬鬆 string
}

// ERROR（unicast）
export interface ErrorPayload {
  code: string;
  message: string;
  // requestId 不在 shared 型別中；如需追蹤請求，由伺服器層自行擴展
}
```

#### 額外匯出型別（packages/shared 存在但 §3 未列出）

```typescript
// 房間摘要（用於大廳列表等場景）
export interface RoomSummaryPayload {
  code: string;
  status: RoomStatus;
  playerCount: number;
  onlineCount: number;
  maxPlayers: number;
}
```

---

## §4 Validation Rules

### §4.1 nickname（暱稱）

| 規則 | 值 |
|------|-----|
| 最小長度 | 1 字元 |
| 最大長度 | 20 字元 |
| 字元限制 | 禁止 null 字元與控制字元（`\x00-\x1F\x7F`） |
| AJV pattern | `^[^\x00-\x1F\x7F]{1,20}$` |
| 唯一性 | 同一房間內暱稱必須唯一（API 回傳 `NICKNAME_TAKEN`） |

### §4.2 roomCode（房間代碼）

| 規則 | 值 |
|------|-----|
| 長度 | 固定 6 字元 |
| 字元集 | `A-HJ-NP-Z2-9`（排除易混淆字元 `I`、`O`、`0`、`1`，共 32 字元） |
| AJV pattern | `^[A-HJ-NP-Z2-9]{6}$` |
| 唯一性 | Redis `SET NX`；衝突時重試最多 10 次 |

### §4.3 winnerCount（中獎名額）

| 規則 | 值 |
|------|-----|
| 類型 | 正整數 |
| 最小值 | 1 |
| 最大值 | N - 1（N = 全部玩家數，含 isOnline=false） |
| 設定時機 | 建立房間時（POST /rooms）或 waiting 狀態時由房主調整 |
| PLAY_AGAIN 後 | 若 W >= 新玩家數，自動重設為 null |

### §4.4 autoRevealIntervalSec（自動揭示間隔）

| 規則 | 值 |
|------|-----|
| 類型 | 正整數 |
| 最小值 | 1（秒） |
| 最大值 | 30（秒） |
| 僅在 mode=auto 時有效 | mode=manual 時值為 null |

### §4.5 玩家數限制

| 規則 | 值 |
|------|-----|
| 最小玩家數（開始遊戲） | 2 |
| 最大玩家數 | 50 |
| START_GAME 時 N | players 陣列全部長度（含 isOnline=false 的斷線玩家） |

### §4.6 JWT Token

| 屬性 | 值 |
|------|-----|
| 算法 | HS256（HMAC-SHA256） |
| TTL | 6 小時（21600 秒） |
| Clock Skew | 30 秒容忍（WS Upgrade 驗證時） |
| Payload | `{ playerId, roomCode, role: "host" | "player", exp, iat }` |
| 密鑰來源 | 環境變數 `JWT_SECRET`，最少 256-bit（32 bytes） |
| 已知安全取捨 | JWT exp 僅在 WS Upgrade 時驗證；連線建立後不重驗 exp（MVP 接受） |

### §4.7 WebSocket 訊息

| 規則 | 值 |
|------|-----|
| maxPayload | 65536 bytes（64KB） |
| 速率限制 | 60 msg/min/connection |
| 超限行為 | close 4029 |
| 格式 | UTF-8 JSON 字串（非 Binary frame） |

---

*SCHEMA 版本：v2.1*
*生成時間：2026-04-21（devsop-autodev STEP-09）*
*修訂時間：2026-04-21（devsop-autodev STEP-12 Schema Review Round 2）*
*基於 EDD v2.0 + PRD v1.4 + legacy-SCHEMA v1.1 + packages/shared/src/types/index.ts*
