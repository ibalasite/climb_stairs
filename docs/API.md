# API — Ladder Room Online API Design Document

> Version: v2.0
> Date: 2026-04-21
> Based on: EDD v2.0, PRD v1.4, legacy-API v1.2

---

## §1 API Overview

### Base URL 與版本策略

```
Production:  https://api.ladder-room.online/api
Development: http://localhost:3000/api
WebSocket:   wss://api.ladder-room.online/ws
```

- 所有 HTTP REST 端點掛載於 `/api/`
- WebSocket 不含版本路徑，由 query param `token` 的 JWT `iat` 隱含版本邊界

### Protocol

| 協定 | 用途 | Content-Type |
|------|------|-------------|
| REST HTTP | 房間 CRUD、玩家管理、遊戲控制 | `application/json; charset=utf-8` |
| WebSocket | 即時狀態同步、遊戲事件廣播 | UTF-8 JSON 字串（非 Binary frame） |

### Auth

MVP 無強制認證。Host 專屬操作需在 `Authorization` Header 帶入 JWT：

```
Authorization: Bearer <token>
```

`token` 由 `POST /api/rooms`（建立房間）或 `POST /api/rooms/:code/players`（加入房間）取得。
一般查詢端點（`GET /api/rooms/:code`、`GET /health`）無需認證。

### 回應格式

所有 HTTP 回應均為**直接 JSON 物件**，不包裝 envelope。

成功範例（POST /api/rooms）：

```json
{ "roomCode": "AB3K7X", "playerId": "uuid-...", "token": "eyJ..." }
```

失敗範例：

```json
{
  "error": "ROOM_FULL",
  "message": "Room has reached the maximum of 50 players."
}
```

---

## §1.5 TypeScript 共用型別定義

以下型別定義位於 `packages/shared/src/types.ts`，前後端共用（`packages/client` 與 `packages/server` 均可 import）。

```typescript
// ──── 基礎型別 ────

type RoomStatus = "waiting" | "running" | "revealing" | "finished";

interface Player {
  id: string;              // UUID v4
  nickname: string;        // 1-20 chars
  colorIndex: number;      // 0-49，依加入順序指派
  isHost: boolean;         // 派生：id === room.hostId
  isOnline: boolean;
  joinedAt: number;        // Unix ms
  result?: string | null;  // null 直到揭曉；"winner" | "loser"
}

interface Room {
  code: string;                                    // 6-char，字元集 A-HJ-NP-Z2-9
  title: string | null;                            // 0-50 Unicode 字元；null 為未命名
  status: RoomStatus;
  hostId: string;                                  // Host 的 playerId
  readonly players: readonly Player[];             // 最多 50 人，含離線玩家
  winnerCount: number | null;                      // W（1 <= W <= N-1）；null 直到 Host 設定
  ladder: LadderData | null;                       // null 直到 BEGIN_REVEAL
  results: readonly ResultSlot[] | null;
  revealedCount: number;
  revealMode: "manual" | "auto";
  autoRevealIntervalSec: number | null;            // 1-300 整數秒；null 為手動模式
  readonly kickedPlayerIds: readonly string[];     // 本局被踢玩家 playerId
  createdAt: number;                               // Unix ms
  updatedAt: number;                               // Unix ms
}

// ──── 梯子型別 ────

interface LadderSegment {
  row: number;   // 0-based 列索引
  col: number;   // 橫槓左端的欄索引（0-based）
}

/** 完整梯子資料（含 seed），僅在 finished 後對客戶端公開 */
interface LadderData {
  seed: number;          // Mulberry32 PRNG seed（uint32），BEGIN_REVEAL 時由 seedSource 計算
  seedSource: string;    // UUID v4，生成於 START_GAME
  rowCount: number;      // clamp(N*3, 20, 60)
  colCount: number;      // N（玩家數）
  segments: readonly LadderSegment[];
}

/** 公開梯子資料（省略 seed/seedSource），用於 revealing 狀態的廣播 */
type LadderDataPublic = Omit<LadderData, "seed" | "seedSource">;

// ──── 結果型別 ────

interface ResultSlot {
  playerIndex: number;   // 0-based，對應玩家在 players[] 的索引
  playerId: string;      // UUID v4
  startCol: number;      // 起始欄（0-based）
  endCol: number;        // 終止欄（0-based）
  isWinner: boolean;
  path?: readonly LadderSegment[];  // 玩家走過的路徑；REVEAL_INDEX 時包含；REVEAL_ALL 時省略
}

/** 省略 path 欄位的精簡結果（用於 REVEAL_ALL 廣播，符合 64KB 限制） */
type ResultSlotPublic = Omit<ResultSlot, "path">;

// ──── WS 事件型別聯合 ────

/** Server → Client 事件類型 */
type WsEventType =
  | "ROOM_STATE"
  | "ROOM_STATE_FULL"
  | "REVEAL_INDEX"
  | "REVEAL_ALL"
  | "PLAYER_KICKED"
  | "SESSION_REPLACED"
  | "HOST_TRANSFERRED"
  | "ERROR"
  | "PONG";

/** Client → Server 訊息類型 */
type WsMsgType =
  | "START_GAME"
  | "BEGIN_REVEAL"
  | "REVEAL_NEXT"
  | "REVEAL_ALL_TRIGGER"
  | "END_GAME"
  | "PLAY_AGAIN"
  | "RESET_ROOM"
  | "SET_REVEAL_MODE"
  | "KICK_PLAYER"
  | "PING";

// ──── WS Envelope ────

interface ServerEnvelope<T = unknown> {
  readonly type: WsEventType;
  readonly ts: number;    // Unix milliseconds（伺服器時間）
  readonly payload: T;
}

interface ClientEnvelope<T = unknown> {
  readonly type: WsMsgType;
  readonly ts: number;    // Unix milliseconds（客戶端時間，用於延遲量測）
  readonly payload: T;
}
```

---

## §2 REST API

### §2.1 端點總覽

| # | Method | Path | 描述 | 需要 Auth |
|---|--------|------|------|-----------|
| 1 | `POST` | `/api/rooms` | 建立房間 | 否 |
| 2 | `GET` | `/api/rooms/:code` | 查詢房間 | 否 |
| 3 | `POST` | `/api/rooms/:code/players` | 加入房間 | 否 |
| 4 | `DELETE` | `/api/rooms/:code/players/:playerId` | 踢出玩家 | 是（host） |
| 5 | `POST` | `/api/rooms/:code/game/start` | 開始遊戲 | 是（host） |
| 6 | `POST` | `/api/rooms/:code/game/reveal` | 揭示結果 | 是（host） |
| 7 | `POST` | `/api/rooms/:code/game/reset` | 重置房間回 waiting | 是（host） |
| 8 | `POST` | `/api/rooms/:code/game/end` | 結束本局 | 是（host） |
| 9 | `POST` | `/api/rooms/:code/game/play-again` | 再玩一局 | 是（host） |
| 10 | `GET` | `/health` | 健康檢查（Liveness） | 否 |
| 11 | `GET` | `/ready` | 就緒檢查（Readiness） | 否 |

---

### §2.2 POST /api/rooms — 建立房間

建立新房間，創建者自動成為房主（host），取得 host 身份的 `token`。

**Request Body：**

```typescript
interface CreateRoomRequest {
  hostNickname: string;   // 1-20 個字元，禁止 null/控制字元（pattern: /^[^\x00-\x1F\x7F]{1,20}$/）
  winnerCount: number;    // 整數 >= 1（上限在 START_GAME 時驗證 W <= N-1）
  title?: string | null;  // 選填，0-50 個 Unicode 字元，null 表示未命名
}
```

**Success Response — 201 Created：**

```typescript
interface CreateRoomResponse {
  roomCode: string;  // 6 個字元，字元集 A-HJ-NP-Z2-9（排除易混淆字元 I/O/0/1）
  playerId: string;  // UUID v4，房主身份識別
  token: string;     // JWT HS256，role: "host"，TTL 6 小時
  room: Room;        // 完整房間物件
}
```

```json
{
  "roomCode": "AB3K7X",
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "room": {
    "code": "AB3K7X",
    "title": null,
    "status": "waiting",
    "hostId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "players": [
      { "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "nickname": "Alice", "colorIndex": 0, "isHost": true, "isOnline": true, "joinedAt": 1745049600000, "result": null }
    ],
    "winnerCount": 3,
    "ladder": null,
    "results": null,
    "revealedCount": 0,
    "revealMode": "manual",
    "autoRevealIntervalSec": null,
    "kickedPlayerIds": [],
    "createdAt": 1745049600000,
    "updatedAt": 1745049600000
  }
}
```

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INVALID_NICKNAME` | `hostNickname` 格式不合法 |
| 400 | `INVALID_PRIZES_COUNT` | `winnerCount < 1` 或不為整數 |
| 500 | `ROOM_CODE_GENERATION_FAILED` | Room Code 碰撞重試超過 10 次，無法生成唯一碼 |
| 429 | `RATE_LIMIT` | 超過 10 req/min/IP |

**Rate Limit:** 10 req/min/IP

---

### §2.3 GET /api/rooms/:code — 查詢房間

查詢指定房間的公開資訊。無需認證，回傳完整房間物件。

**Path Parameters：**

| 參數 | 格式 | 說明 |
|------|------|------|
| `code` | `[A-HJ-NP-Z2-9]{6}` | 6 碼房間代碼 |

**Success Response — 200 OK：**

```json
{
  "code": "AB3K7X",
  "title": null,
  "status": "waiting",
  "hostId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "players": [],
  "winnerCount": 1,
  "revealedCount": 0,
  "revealMode": "manual",
  "autoRevealIntervalSec": null,
  "createdAt": 1745049600000,
  "updatedAt": 1745049600000
}
```

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 404 | `ROOM_NOT_FOUND` | 房間不存在或 TTL 過期 |

**Rate Limit:** 100 req/min/IP

---

### §2.4 POST /api/rooms/:code/players — 加入房間

以暱稱加入指定房間，取得玩家 JWT。

**Request Body：**

```typescript
interface JoinRoomRequest {
  nickname: string;  // 1-20 個 Unicode 字元（pattern: /^[^\x00-\x1F\x7F]{1,20}$/）
}
```

**Success Response — 201 Created：**

```typescript
interface JoinRoomResponse {
  playerId: string;  // UUID v4
  token: string;     // JWT HS256，role: "player"，TTL 6 小時
  room: Room;        // 完整房間物件
}
```

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 404 | `ROOM_NOT_FOUND` | 房間不存在 |
| 409 | `ROOM_FULL` | 已達 50 人上限 |
| 409 | `NICKNAME_TAKEN` | 暱稱在此房間已被使用 |
| 409 | `ROOM_NOT_ACCEPTING` | 房間狀態非 `waiting` |

**Rate Limit:** 20 req/min/IP

---

### §2.5 DELETE /api/rooms/:code/players/:playerId — 踢出玩家

房主將指定玩家從房間移除。僅在 `waiting` 狀態有效。

**Request Headers：** `Authorization: Bearer <token>`

**Success Response — 204 No Content**

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 401 | `AUTH_INVALID_TOKEN` | JWT 無效 |
| 401 | `AUTH_TOKEN_EXPIRED` | JWT 已過期 |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 404 | `PLAYER_NOT_FOUND` | 目標玩家不存在 |
| 409 | `INVALID_STATE` | 房間狀態非 `waiting` |

**Rate Limit:** 100 req/min/IP

---

### §2.6 POST /api/rooms/:code/game/start — 開始遊戲

房主觸發遊戲開始。後端生成 `seedSource`（UUID v4）並計算 `rowCount`，**不生成梯子結構**（梯子延遲至 BEGIN_REVEAL 時生成）。

**Request Headers：** `Authorization: Bearer <token>`

**Request Body：** `{}` 或空

**Success Response — 200 OK：**

```json
{
  "code": "AB3K7X",
  "status": "running",
  "hostId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "players": [],
  "winnerCount": 1,
  "ladder": null,
  "revealedCount": 0,
  "revealMode": "manual",
  "autoRevealIntervalSec": null,
  "createdAt": 1745049600000,
  "updatedAt": 1745050000000
}
```

> **注意**：`seed` 與 `seedSource` 在 `status=finished` 之前均不對客戶端公開。`rowCount` 公式為 `clamp(N*3, 20, 60)`。

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INSUFFICIENT_PLAYERS` | 玩家數 N < 2 |
| 400 | `PRIZES_NOT_SET` | `winnerCount` 尚未設定 |
| 400 | `INVALID_PRIZES_COUNT` | `winnerCount >= N` |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `waiting` |

**Rate Limit:** 100 req/min/IP

---

### §2.7 POST /api/rooms/:code/game/reveal — 揭示結果

房主觸發結果揭示。`mode: "next"` 逐一揭示；`mode: "all"` 一次揭示全部剩餘。

**Request Body：**

```typescript
interface RevealRequest {
  mode: "next" | "all";
}
```

**Success Response — 200 OK：**

```json
{
  "code": "AB3K7X",
  "status": "revealing",
  "ladder": {
    "rowCount": 20,
    "colCount": 3,
    "segments": [{ "row": 0, "col": 1 }]
  },
  "revealedCount": 1,
  "revealMode": "manual",
  "autoRevealIntervalSec": null,
  "createdAt": 1745049600000,
  "updatedAt": 1745050200000
}
```

> `ladder` 在 `revealing` 狀態為 `LadderDataPublic`（省略 `seed`）。

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INVALID_REVEAL_MODE` | `mode` 欄位不合法 |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `revealing` |

**Rate Limit:** 100 req/min/IP

---

### §2.8 POST /api/rooms/:code/game/end — 結束本局

房主在所有路徑揭示完畢後，手動觸發本局結束。房間從 `revealing` 轉為 `finished`，廣播包含 `seed` 的 `ROOM_STATE`。

**Request Headers：** `Authorization: Bearer <token>`

**Request Body：** `{}` 或空

**Success Response — 200 OK：**（含 `seed` 與完整 `results`）

```json
{
  "code": "AB3K7X",
  "status": "finished",
  "ladder": {
    "seed": 1879452061,
    "seedSource": "550e8400-e29b-41d4-a716-446655440000",
    "rowCount": 20,
    "colCount": 3,
    "segments": []
  },
  "revealedCount": 3,
  "createdAt": 1745049600000,
  "updatedAt": 1745051000000
}
```

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `revealing` |
| 409 | `END_GAME_REQUIRES_ALL_REVEALED` | 尚有未揭曉路徑（`revealedCount < totalCount`） |

**Rate Limit:** 100 req/min/IP

---

### §2.9 POST /api/rooms/:code/game/reset — 重置房間

房主在**任意狀態**下重置房間回 `waiting`，清空所有遊戲結果、`kickedPlayerIds` 與 `ladder`。與 `play-again` 不同：`reset` 可從任意狀態觸發，且**不剔除離線玩家**。

**Request Headers：** `Authorization: Bearer <token>`

**Request Body：** `{}` 或空

**Success Response — 200 OK：**（重置後 `waiting` 狀態的完整房間物件）

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 401 | `AUTH_INVALID_TOKEN` | JWT 無效 |
| 401 | `AUTH_TOKEN_EXPIRED` | JWT 已過期 |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |

**Rate Limit:** 100 req/min/IP

---

### §2.10 POST /api/rooms/:code/game/play-again — 再玩一局

房主在遊戲結束後重置房間。僅限 `finished` 狀態。離線玩家被移除，`kickedPlayerIds` 清空，`winnerCount` 若 >= 新玩家數則重置為 null。

**Request Headers：** `Authorization: Bearer <token>`

**Request Body：** `{}` 或空

**Success Response — 200 OK：**（重置後 `waiting` 狀態）

**Error Responses：**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INSUFFICIENT_ONLINE_PLAYERS` | 在線玩家數 < 2 |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `finished` |

**Rate Limit:** 100 req/min/IP

---

### §2.11 GET /health — 健康檢查（Liveness）

供 Kubernetes liveness probe 使用。

**Success Response — 200 OK：**

```typescript
interface HealthResponse {
  status: "ok";
  redis: "ok" | "error";
  wsCount: number;   // 當前 active WebSocket 連線數
  uptime: number;    // process.uptime()，單位秒
}
```

```json
{ "status": "ok", "redis": "ok", "wsCount": 312, "uptime": 86423.7 }
```

**Rate Limit:** 100 req/min/IP

---

### §2.12 GET /ready — 就緒檢查（Readiness）

供 Kubernetes readiness probe 使用。Redis 未就緒時回傳 503。

**Success Response — 200 OK：**

```json
{ "status": "ok", "redis": "ok" }
```

**Error Response — 503 Service Unavailable：**

```json
{ "status": "not_ready", "redis": "error" }
```

---

## §3 WebSocket API

### §3.1 連線端點

```
WSS /ws?room={roomCode}&token={token}
```

| Query Param | 格式 | 說明 |
|-------------|------|------|
| `room` | `[A-HJ-NP-Z2-9]{6}` | 目標房間代碼 |
| `token` | JWT HS256 字串 | 玩家或房主的 `token` |

### §3.2 Upgrade 驗證流程

1. 驗證 HTTP `Origin` 是否符合 `CORS_ORIGIN` 白名單（防 CSRF-over-WebSocket）
2. 驗證 `token` 的 JWT 簽名與 `exp`（允許 30 秒 clock skew）
3. 比對 JWT payload 中 `roomCode` 與 query param `room` 是否一致
4. 查詢 Redis `kickedPlayerIds`：若 `playerId` 在列表中，發送 `PLAYER_KICKED` 後以 close code **4003** 關閉
5. 驗證通過後回應 HTTP 101，建立 WebSocket 連線

### §3.3 訊息 Envelope 格式

**Server → Client（ServerEnvelope）：**

```typescript
interface ServerEnvelope<T = unknown> {
  type: WsEventType;
  ts: number;    // Unix milliseconds
  payload: T;
}
```

**Client → Server（ClientEnvelope）：**

```typescript
interface ClientEnvelope<T = unknown> {
  type: WsMsgType;
  ts: number;    // Unix milliseconds（客戶端時間戳，用於延遲量測）
  payload: T;
}
```

### §3.4 Heartbeat

伺服器每 **30 秒**發送 WebSocket Protocol-level `PING` frame，客戶端需回應 `PONG`。
30 秒未收到 `PONG` → 伺服器主動關閉連線（close code 1001）。

客戶端亦可發送應用層 `{ type: "PING", ts, payload: {} }` 心跳，伺服器回應 `PONG { ts: echo }` 供 RTT 量測。

---

### §3.5 Server → Client 事件（WsEventType）

#### ROOM_STATE

任何房間狀態變更時廣播給房間所有連線。

```typescript
type WsEventType = "ROOM_STATE";

interface RoomStatePayload {
  code: string;
  title: string | null;
  status: RoomStatus;
  hostId: string;
  players: readonly Player[];
  winnerCount: number | null;
  revealedCount: number;
  revealMode: "manual" | "auto";
  autoRevealIntervalSec: number | null;
}
```

**觸發時機：** 玩家加入/斷線/重連/被踢、`winnerCount` 設定、遊戲狀態轉換、PLAY_AGAIN

---

#### ROOM_STATE_FULL

玩家 WebSocket 連線建立或重連時，**unicast** 給該連線。包含完整 `ladder` 與 `results`。

```typescript
type WsEventType = "ROOM_STATE_FULL";

interface RoomStateFullPayload extends RoomStatePayload {
  ladder: LadderDataPublic | LadderData | null;
  // waiting/running: null; revealing: LadderDataPublic (省略 seed); finished: LadderData (完整)
  results: readonly ResultSlot[] | null;
  selfPlayerId: string;   // 對應此 session 的玩家 ID
}
```

```json
{
  "type": "ROOM_STATE_FULL",
  "ts": 1745049655000,
  "payload": {
    "code": "AB3K7X",
    "title": null,
    "status": "waiting",
    "hostId": "f47ac10b-...",
    "players": [],
    "winnerCount": 3,
    "revealedCount": 0,
    "revealMode": "manual",
    "autoRevealIntervalSec": null,
    "ladder": null,
    "results": null,
    "selfPlayerId": "a3bb189e-8bf9-3888-9912-ace4e6543002"
  }
}
```

**觸發時機：** WS 連線成功後立即 unicast 給連線玩家；新連線與重連均觸發

---

#### REVEAL_INDEX

手動或自動揭示模式下，逐一揭示單一玩家的梯子路徑與結果。

```typescript
type WsEventType = "REVEAL_INDEX";

interface RevealIndexPayload {
  playerIndex: number;    // Canvas 列索引（0-based）
  result: ResultSlot;     // 含完整 path（單一玩家，安全在 64KB 內）
  revealedCount: number;  // 已揭示數量（含本次）
  totalCount: number;     // 總玩家數
}
```

**觸發時機：** REVEAL_NEXT 訊息處理後 / 自動揭示 timer 觸發

---

#### REVEAL_ALL

房主使用「一鍵全揭」（REVEAL_ALL_TRIGGER）時廣播，包含全部剩餘未揭示的路徑結果。
payload 使用 `ResultSlotPublic`（省略 `path` 欄位），符合 WebSocket maxPayload 64KB 限制。

```typescript
type WsEventType = "REVEAL_ALL";

type ResultSlotPublic = Omit<ResultSlot, "path">;

interface RevealAllPayload {
  results: readonly ResultSlotPublic[];   // 所有剩餘未揭示玩家結果（不含 path）
}
```

```json
{
  "type": "REVEAL_ALL",
  "ts": 1745050300000,
  "payload": {
    "results": [
      { "playerIndex": 0, "playerId": "f47ac10b-...", "startCol": 0, "endCol": 2, "isWinner": true },
      { "playerIndex": 1, "playerId": "a3bb189e-...", "startCol": 1, "endCol": 0, "isWinner": false }
    ]
  }
}
```

**觸發時機：** REVEAL_ALL_TRIGGER WS 訊息（一鍵全揭）
**注意：** REVEAL_ALL 後房間仍維持 `revealing` 狀態，等待 Host 另行發送 END_GAME 才轉 `finished`

---

#### PLAYER_KICKED

房主踢出玩家時，**unicast 給被踢玩家**；其他玩家透過後續 ROOM_STATE 廣播得知。

```typescript
type WsEventType = "PLAYER_KICKED";

interface PlayerKickedPayload {
  kickedPlayerId: string;
  reason: string;   // e.g. "Kicked by host"
}
```

---

#### SESSION_REPLACED

同一 `playerId` 從新裝置/瀏覽器重新連線時，**unicast** 給舊連線。

```typescript
type WsEventType = "SESSION_REPLACED";

interface SessionReplacedPayload {
  message: string;
}
```

---

#### HOST_TRANSFERRED

房主斷線超過 60 秒未重連，系統自動將房主身份轉移給下一位在線玩家（按 `joinedAt` 排序）。

```typescript
type WsEventType = "HOST_TRANSFERRED";

interface HostTransferredPayload {
  newHostId: string;
  reason: "disconnect_timeout";
}
```

---

#### ERROR

操作失敗時 **unicast** 給觸發操作的連線。連線保持開啟。

```typescript
type WsEventType = "ERROR";

interface ErrorPayload {
  code: string;
  message: string;
  requestId?: string;   // 選填，用於追蹤
}
```

---

#### PONG

伺服器回應應用層 `PING` 心跳（Client→Server），回傳客戶端原始 `ts` 供 RTT 量測。

```typescript
type WsEventType = "PONG";

interface PongPayload {
  ts: number;   // 回傳客戶端發送的 PING ts（echo）
}
```

```json
{ "type": "PONG", "ts": 1745049605000, "payload": { "ts": 1745049600000 } }
```

> **注意**：此為應用層 PONG，對應 `PING` WS 訊息（§3.6）。與 WebSocket Protocol-level PING/PONG frame（§3.4）不同。

---

### §3.6 Client → Server 訊息（WsMsgType）

> **注意**：遊戲控制操作同時支援 WS 訊息（即時）和 HTTP REST（向後相容）。前端主要使用 WS 路徑。

#### START_GAME

觸發遊戲開始。僅 host、`waiting` 狀態有效。後端生成 `seedSource` 但**不生成梯子**。

```typescript
type WsMsgType = "START_GAME";
// payload: {}

// Example
{ "type": "START_GAME", "ts": 1745050000000, "payload": {} }
```

**驗證：** JWT `role === "host"` + Redis `room.hostId` 比對；status 必須為 `waiting`；N >= 2；1 <= W <= N-1

**成功後：** 廣播 `ROOM_STATE`（`status: "running"`, `rowCount`）；`seed`/`ladder` 不廣播

---

#### BEGIN_REVEAL

開始揭示階段。Host 在 `running` 狀態發送，後端在此時原子生成梯子（GenerateLadder + ComputeResults）。

```typescript
type WsMsgType = "BEGIN_REVEAL";
// payload: {}

// Example
{ "type": "BEGIN_REVEAL", "ts": 1745050100000, "payload": {} }
```

**驗證：** host only；status 必須為 `running`

**成功後：** 廣播 `ROOM_STATE`（`status: "revealing"`）；ladder 在 Redis 已生成但 `seed` 不對客戶端公開

---

#### REVEAL_NEXT

手動模式逐一揭示下一位玩家。

```typescript
type WsMsgType = "REVEAL_NEXT";
// payload: {}

// Example
{ "type": "REVEAL_NEXT", "ts": 1745050200000, "payload": {} }
```

**驗證：** host only；status 必須為 `revealing`；`revealedCount < totalCount`

**成功後：** 廣播 `REVEAL_INDEX`；**不自動轉入 `finished`**（需另行 END_GAME）

---

#### REVEAL_ALL_TRIGGER

一鍵揭示所有剩餘玩家路徑。

```typescript
type WsMsgType = "REVEAL_ALL_TRIGGER";
// payload: {}

// Example
{ "type": "REVEAL_ALL_TRIGGER", "ts": 1745050250000, "payload": {} }
```

**驗證：** host only；status 必須為 `revealing`

**成功後：** 廣播 `REVEAL_ALL`（使用 `ResultSlotPublic` 省略 path）；房間**仍維持 `revealing` 狀態**

---

#### END_GAME

Host 在所有路徑揭示完畢後手動觸發本局結束。`seed` 在此時首次對客戶端公開。

```typescript
type WsMsgType = "END_GAME";
// payload: {}

// Example
{ "type": "END_GAME", "ts": 1745050350000, "payload": {} }
```

**驗證：** host only；status 必須為 `revealing`；`revealedCount === totalCount`

**成功後：** 廣播 `ROOM_STATE`（`status: "finished"`，含 `seed`、完整 `results[]`）；Redis TTL 降至 1h

---

#### PLAY_AGAIN

遊戲結束後重置房間。僅限 `finished` 狀態。離線玩家自動剔除；`kickedPlayerIds` 清空；`winnerCount` 若 >= 新玩家數則重置為 null。

```typescript
type WsMsgType = "PLAY_AGAIN";
// payload: {}

// Example
{ "type": "PLAY_AGAIN", "ts": 1745050400000, "payload": {} }
```

**驗證：** host only；status 必須為 `finished`；在線玩家 >= 2

**成功後：** 廣播 `ROOM_STATE`（`status: "waiting"`）；`kickedPlayerIds` 清空

---

#### RESET_ROOM

強制重置房間回 `waiting`，可在**任意狀態**觸發。清空 `ladder`、`results`、`kickedPlayerIds`；**不剔除離線玩家**（與 PLAY_AGAIN 差異）。

```typescript
type WsMsgType = "RESET_ROOM";
// payload: {}

// Example
{ "type": "RESET_ROOM", "ts": 1745050450000, "payload": {} }
```

**驗證：** host only；任意狀態均可

**成功後：** 廣播 `ROOM_STATE`（`status: "waiting"`，清空 results/ladder/kickedPlayerIds）

---

#### SET_REVEAL_MODE

切換手動/自動揭示模式。揭示進行中可隨時切換。

```typescript
type WsMsgType = "SET_REVEAL_MODE";

interface SetRevealModePayload {
  mode: "manual" | "auto";
  intervalSec?: number;   // mode === "auto" 時必填，範圍 1-300（整數秒）
}

// Example
{ "type": "SET_REVEAL_MODE", "ts": 1745050150000, "payload": { "mode": "auto", "intervalSec": 2 } }
```

**驗證：** host only；status 必須為 `revealing`；`mode === "auto"` 時 `intervalSec` 必填且 1-300

---

#### KICK_PLAYER

踢出指定玩家。等同呼叫 `DELETE /api/rooms/:code/players/:playerId`。

```typescript
type WsMsgType = "KICK_PLAYER";

interface KickPlayerPayload {
  targetPlayerId: string;   // UUID v4
}

// Example
{ "type": "KICK_PLAYER", "ts": 1745049700000, "payload": { "targetPlayerId": "a3bb189e-..." } }
```

**驗證：** host only；status 必須為 `waiting`；不可踢自己

---

#### PING

應用層心跳，伺服器回應 `PONG { ts: echo }` 供 RTT 量測。

```typescript
type WsMsgType = "PING";
// payload: {}

// Example
{ "type": "PING", "ts": 1745049600000, "payload": {} }
```

---

## §4 Error Handling

### §4.1 HTTP Error Codes

| 錯誤碼 | HTTP 狀態 | WS close code | 說明 |
|--------|-----------|---------------|------|
| `ROOM_NOT_FOUND` | 404 | — | 房間不存在或 TTL 過期 |
| `ROOM_FULL` | 409 | — | 已達 50 人上限 |
| `ROOM_NOT_ACCEPTING` | 409 | — | 房間非 `waiting` 狀態 |
| `NICKNAME_TAKEN` | 409 | — | 暱稱在此房間已被使用 |
| `PLAYER_NOT_FOUND` | 404 | — | 目標玩家不存在 |
| `PLAYER_NOT_HOST` | 403 | — | 操作需要房主權限 |
| `AUTH_INVALID_TOKEN` | 401 | 4001 | JWT 無效（格式錯誤或簽名不符） |
| `AUTH_TOKEN_EXPIRED` | 401 | 4001 | JWT 已過期（TTL 6 小時） |
| `PLAYER_KICKED` | — | 4003 | 玩家已被踢出，WS Upgrade 階段拒絕 |
| `SESSION_REPLACED` | — | 4002 | 同一 playerId 從新連線登入，舊連線被強制關閉 |
| `INSUFFICIENT_PLAYERS` | 400 | — | 玩家數 N < 2 |
| `INSUFFICIENT_ONLINE_PLAYERS` | 400 | — | 再玩一局時在線玩家 < 2 |
| `PRIZES_NOT_SET` | 400 | — | `winnerCount` 尚未設定 |
| `INVALID_PRIZES_COUNT` | 400 | — | `winnerCount < 1` 或 `>= N` |
| `INVALID_STATE` | 409 | — | 操作不符合當前房間狀態 |
| `CANNOT_KICK_HOST` | 400 | — | 踢除操作目標為 Host 本身 |
| `INVALID_NICKNAME` | 400 | — | 暱稱格式不合法 |
| `INVALID_INTERVAL` | 400 | — | SET_REVEAL_MODE intervalSec 不合法（非整數或超出 1-300 範圍） |
| `INVALID_REVEAL_MODE` | 400 | — | POST /game/reveal 的 `mode` 欄位不合法 |
| `ROOM_CODE_GENERATION_FAILED` | 500 | — | Room Code 碰撞重試超過 10 次，無法生成唯一碼 |
| `TITLE_UPDATE_NOT_ALLOWED_IN_STATE` | 409 | — | 在非 `waiting` 狀態嘗試更新 `title` |
| `END_GAME_REQUIRES_ALL_REVEALED` | 409 | — | END_GAME 觸發時尚有未揭曉路徑（revealedCount < totalCount） |
| `SYS_INTERNAL_ERROR` | 500 | — | 非預期的伺服器內部錯誤 |
| `RATE_LIMIT` | 429 | 4029 | 超過速率限制（WS: 60 msg/min/conn） |

### §4.2 WebSocket Error Format

```typescript
interface ErrorPayload {
  code: string;
  message: string;
  requestId?: string;
}
```

```json
{
  "type": "ERROR",
  "ts": 1745049750000,
  "payload": {
    "code": "INSUFFICIENT_PLAYERS",
    "message": "At least 2 players are required to start the game."
  }
}
```

WS 訊息層錯誤（不關閉連線）：
- `WS_INVALID_MSG`：JSON parse 失敗
- `WS_UNKNOWN_TYPE`：未知的 `type` 欄位
- `PLAYER_NOT_HOST`：非 host 發送 host-only 訊息（對應 HTTP 403 `PLAYER_NOT_HOST`）

---

## §5 Rate Limiting

| 端點 | 限制 |
|------|------|
| `POST /api/rooms` | 10 req/min/IP |
| `POST /api/rooms/:code/players` | 20 req/min/IP |
| `DELETE /api/rooms/:code/players/:playerId` | 100 req/min/IP |
| `POST /api/rooms/:code/game/*` | 100 req/min/IP |
| `GET /api/rooms/:code` | 100 req/min/IP |
| `GET /health`, `GET /ready` | 100 req/min/IP |
| WebSocket 訊息 | 60 msg/min/connection（超限 close 4029） |

---

<!-- TODO[REVIEW-DEFERRED]:
  Finding: PRD §4 FR-03-2 列出 `UPDATE_WINNER_COUNT`（WS 訊息）及 FR-01-5 要求 `title` 可在 waiting 狀態更新並廣播，
           但 EDD §6.1 WS 訊息表中未列出對應 WS 訊息（`SET_WINNER_COUNT` / `SET_TITLE`），REST 端點表中也無 PATCH 路由。
  Severity: MEDIUM
  Cannot-fix reason: PRD/EDD 上游衝突，需在 EDD 或 PRD 其中一方補充定義後才能確定 API 契約。
           winnerCount 目前可在 POST /api/rooms 建立時設定，但 waiting 狀態的動態更新路徑未明確。
  Source: devsop-api-review, STEP 11, Round 1, 2026-04-21
  Suggested resolution: 在 STEP 12 EDD/PRD 對齊時：
    Option A（推薦）：新增 PATCH /api/rooms/:code 端點，允許 waiting 狀態更新 winnerCount 和 title；
    Option B：新增 WS 訊息 SET_PRIZES_COUNT 和 SET_TITLE，在 EDD §6.1 WS 表補充。
-->

*API 版本：v2.1*
*生成時間：2026-04-21（devsop-autodev STEP-11）*
*基於 EDD v2.0 + PRD v1.4 + legacy-API v1.2*
