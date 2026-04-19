# API Design Document — Ladder Room Online

*Version: v1.0 | 2026-04-19 | Based on EDD v1.1 + PRD v1.1*

---

## 1. 概覽

### Base URL 與版本策略

```
Production: https://api.ladder-room.online/api
Development: http://localhost:3000/api
WebSocket:   wss://api.ladder-room.online/ws
```

- 所有 HTTP REST 端點掛載於 `/api/`。
- WebSocket 不含版本路徑，由 query param `token` 的 JWT `iat` 隱含版本邊界。

### Content-Type

所有請求與回應均使用：

```
Content-Type: application/json; charset=utf-8
```

WebSocket 訊息以 UTF-8 JSON 字串傳輸，不使用 Binary frame。

### 認證

Host 專屬操作需在 `Authorization` Header 帶入 JWT：

```
Authorization: Bearer <token>
```

`token` 由 `POST /api/rooms`（建立房間）或 `POST /api/rooms/:code/players`（加入房間）取得。
一般查詢端點（`GET /api/rooms/:code`、`GET /health`）無需認證。

### 回應格式

所有 HTTP 回應均為**直接 JSON 物件**，不包裝 envelope。

**成功範例（POST /api/rooms）：**

```json
{ "roomCode": "AB3K7X", "playerId": "uuid-...", "token": "eyJ..." }
```

**失敗範例：**

```json
{
  "error": "ROOM_FULL",
  "message": "Room has reached the maximum of 50 players."
}
```

---

## 2. HTTP REST 端點

### 端點總覽

| # | Method | Path | 描述 | 需要 Auth |
|---|--------|------|------|-----------|
| 1 | `POST` | `/api/rooms` | 建立房間 | 否 |
| 2 | `GET` | `/api/rooms/:code` | 查詢房間摘要 | 否 |
| 3 | `POST` | `/api/rooms/:code/players` | 加入房間 | 否 |
| 4 | `DELETE` | `/api/rooms/:code/players/:playerId` | 踢出玩家 | 是（host） |
| 5 | `POST` | `/api/rooms/:code/game/start` | 開始遊戲 | 是（host） |
| 6 | `POST` | `/api/rooms/:code/game/reveal` | 揭示結果（next \| all） | 是（host） |
| 7 | `POST` | `/api/rooms/:code/game/reset` | 再玩一局 | 是（host） |
| 8 | `GET` | `/health` | 健康檢查（liveness） | 否 |
| 9 | `GET` | `/ready` | 就緒檢查（readiness） | 否 |

---

### 1. POST /api/rooms — 建立房間

建立新房間，創建者自動成為房主（host），並取得 host 身份的 `token`。

**Request Headers**

```
Content-Type: application/json
```

**Request Body Schema**

```typescript
interface CreateRoomRequest {
  hostNickname: string;  // 1-20 個字元，禁止 null/控制字元（pattern: /^[^\x00-\x1F\x7F]{1,20}$/）
  winnerCount: number;   // 整數 >= 1（上限在玩家加入後於 START_GAME 驗證 W <= N-1）
}
```

**Request Body 範例**

```json
{
  "hostNickname": "Alice",
  "winnerCount": 3
}
```

**Success Response — 201 Created**

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
  "room": { "code": "AB3K7X", "status": "waiting", "..." : "..." }
}
```

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INVALID_PRIZES_COUNT` | `winnerCount < 1` 或不為整數 |
| 429 | `RATE_LIMIT` | 超過 10 req/min/IP |

```json
{
  "error": "INVALID_PRIZES_COUNT",
  "message": "winnerCount must be an integer >= 1."
}
```

**Rate Limit:** 10 req/min/IP

---

### 2. GET /api/rooms/:code — 查詢房間摘要

查詢指定房間的公開摘要資訊。無需認證，回傳完整房間物件。

**Path Parameters**

| 參數 | 格式 | 說明 |
|------|------|------|
| `code` | `[A-HJ-NP-Z2-9]{6}` | 6 碼房間代碼 |

**Request Headers**

無（unauthenticated）

**Success Response — 200 OK**

回傳房間物件（直接 JSON，無 envelope）：

```json
{
  "code": "AB3K7X",
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

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 404 | `ROOM_NOT_FOUND` | 房間不存在或 TTL 過期 |

**Rate Limit:** 100 req/min/IP

---

### 3. POST /api/rooms/:code/players — 加入房間

以暱稱加入指定房間，取得玩家 JWT。

**Path Parameters**

| 參數 | 格式 | 說明 |
|------|------|------|
| `code` | `[A-HJ-NP-Z2-9]{6}` | 6 碼房間代碼 |

**Request Headers**

```
Content-Type: application/json
```

**Request Body Schema**

```typescript
interface JoinRoomRequest {
  nickname: string;  // 1-20 個 Unicode 字元（pattern: /^[^\x00-\x1F\x7F]{1,20}$/）
}
```

**Request Body 範例**

```json
{
  "nickname": "Bob"
}
```

**Success Response — 201 Created**

```typescript
interface JoinRoomResponse {
  playerId: string;  // UUID v4
  token: string;     // JWT HS256，role: "player"，TTL 6 小時
  room: Room;        // 完整房間物件
}
```

```json
{
  "playerId": "a3bb189e-8bf9-3888-9912-ace4e6543002",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "room": { "code": "AB3K7X", "status": "waiting", "..." : "..." }
}
```

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 404 | `ROOM_NOT_FOUND` | 房間不存在 |
| 409 | `ROOM_FULL` | 已達 50 人上限 |
| 409 | `NICKNAME_TAKEN` | 暱稱在此房間已被使用 |
| 409 | `ROOM_NOT_ACCEPTING` | 房間狀態非 `waiting`（進行中或已結束） |

**Rate Limit:** 20 req/min/IP

---

### 4. DELETE /api/rooms/:code/players/:playerId — 踢出玩家

房主將指定玩家從房間移除。僅在 `waiting` 狀態有效。

**Path Parameters**

| 參數 | 格式 | 說明 |
|------|------|------|
| `code` | `[A-HJ-NP-Z2-9]{6}` | 6 碼房間代碼 |
| `playerId` | UUID v4 | 目標玩家的 `playerId` |

**Request Headers**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:** 無（空 body）

**Success Response — 204 No Content**

回應 body 為空。

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 401 | `AUTH_INVALID_TOKEN` | JWT 無效或格式錯誤 |
| 401 | `AUTH_TOKEN_EXPIRED` | JWT 已過期 |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 404 | `PLAYER_NOT_FOUND` | 目標玩家不存在此房間 |
| 409 | `INVALID_STATE` | 房間狀態非 `waiting`（無法在遊戲進行中踢人） |

```json
{
  "error": "PLAYER_NOT_HOST",
  "message": "Only the host can kick players."
}
```

**Rate Limit:** 100 req/min/IP

---

### 5. POST /api/rooms/:code/game/start — 開始遊戲

房主觸發遊戲開始，後端執行梯子生成並回傳完整房間物件（含 `LadderData`）。

**Path Parameters**

| 參數 | 格式 | 說明 |
|------|------|------|
| `code` | `[A-HJ-NP-Z2-9]{6}` | 6 碼房間代碼 |

**Request Headers**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:** `{}` 或空（winnerCount 於建立房間時已設定）

**Success Response — 200 OK**

回傳完整房間物件（直接 JSON，含 ladder 欄位）：

```json
{
  "code": "AB3K7X",
  "status": "running",
  "hostId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "players": [],
  "winnerCount": 1,
  "ladder": {
    "seed": 1879452061,
    "seedSource": "550e8400-e29b-41d4-a716-446655440000",
    "rowCount": 20,
    "colCount": 3,
    "segments": [
      { "row": 0, "col": 1 },
      { "row": 2, "col": 0 },
      { "row": 5, "col": 1 }
    ]
  },
  "revealedCount": 0,
  "revealMode": "manual",
  "autoRevealIntervalSec": null,
  "createdAt": 1745049600000,
  "updatedAt": 1745050000000
}
```

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INSUFFICIENT_PLAYERS` | 玩家數 N < 2 |
| 400 | `PRIZES_NOT_SET` | `winnerCount` 尚未設定（null） |
| 400 | `INVALID_PRIZES_COUNT` | `winnerCount >= N`（需 1 <= W <= N-1） |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `waiting` |

**Rate Limit:** 100 req/min/IP

---

### 6. POST /api/rooms/:code/game/reveal — 揭示結果

房主觸發結果揭示。`mode: "next"` 逐一揭示下一位玩家；`mode: "all"` 一次揭示全部剩餘。

**Path Parameters**

| 參數 | 格式 | 說明 |
|------|------|------|
| `code` | `[A-HJ-NP-Z2-9]{6}` | 6 碼房間代碼 |

**Request Headers**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body Schema**

```typescript
interface RevealRequest {
  mode: "next" | "all";
}
```

**Request Body 範例**

```json
{ "mode": "next" }
```

**Success Response — 200 OK**

回傳更新後的房間物件（直接 JSON）。

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `revealing` |

**Rate Limit:** 100 req/min/IP

---

### 7. POST /api/rooms/:code/game/reset — 再玩一局

房主在遊戲結束後重置房間進行下一局。等同 WS `RESET_ROOM` 訊息。僅限 `finished` 狀態。離線玩家被移除，`kickedPlayerIds` 清空，`winnerCount` 若 >= 新玩家數則重置為 null。

**Path Parameters**

| 參數 | 格式 | 說明 |
|------|------|------|
| `code` | `[A-HJ-NP-Z2-9]{6}` | 6 碼房間代碼 |

**Request Headers**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:** `{}` 或空

**Success Response — 200 OK**

回傳重置後的房間物件（直接 JSON）：

```json
{
  "code": "AB3K7X",
  "status": "waiting",
  "hostId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "players": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "nickname": "Alice",
      "colorIndex": 0,
      "isHost": true,
      "isOnline": true,
      "joinedAt": 1745049600000,
      "result": null
    }
  ],
  "winnerCount": null,
  "revealedCount": 0,
  "revealMode": "manual",
  "autoRevealIntervalSec": null,
  "createdAt": 1745049600000,
  "updatedAt": 1745049900000
}
```

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INSUFFICIENT_ONLINE_PLAYERS` | 在線玩家數 < 2，無法開始新局 |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `finished` |

**Rate Limit:** 100 req/min/IP

---

### 8. GET /health 與 GET /ready — 健康 / 就緒檢查

回報後端服務、Redis 連線與 WebSocket 連線數狀態。供 Kubernetes liveness（`/health`）與 readiness（`/ready`）probe 使用。

**Request Headers:** 無

**Success Response — 200 OK**

```typescript
interface HealthResponse {
  status: "ok";
  redis: "ok" | "error";
  wsCount: number;   // 當前 active WebSocket 連線數
  uptime: number;    // process.uptime()，單位秒
}
```

```json
{
  "status": "ok",
  "redis": "ok",
  "wsCount": 312,
  "uptime": 86423.7
}
```

**Rate Limit:** 100 req/min/IP

---

## 3. WebSocket API

### 連線端點

```
WSS /ws?room={roomCode}&token={token}
```

| Query Param | 格式 | 說明 |
|-------------|------|------|
| `room` | `[A-HJ-NP-Z2-9]{6}` | 目標房間代碼 |
| `token` | JWT HS256 字串 | 玩家或房主的 `token` |

### Upgrade 驗證流程

1. 驗證 `token` 的 JWT 簽名與 `exp`（允許 30 秒 clock skew）
2. 比對 JWT payload 中 `roomCode` 與 query param `room` 是否一致
3. 查詢 Redis `kickedPlayerIds`：若 `playerId` 在列表中，發送 `PLAYER_KICKED` JSON frame 後以 close code **4003** 關閉連線
4. 驗證通過後回應 HTTP 101，建立 WebSocket 連線

### 訊息 Envelope 格式

**Server → Client（ServerEnvelope）**

```typescript
interface ServerEnvelope<T = unknown> {
  type: WsEventType;
  ts: number;       // Unix milliseconds
  payload: T;
}
```

**Client → Server（ClientEnvelope）**

```typescript
interface ClientEnvelope<T = unknown> {
  type: WsMsgType;
  ts: number;       // Unix milliseconds（客戶端時間戳，用於延遲量測）
  payload: T;
}
```

### Heartbeat

伺服器每 **30 秒**發送 WebSocket Protocol-level `PING` frame，客戶端需回應 `PONG`。
30 秒未收到 `PONG` → 伺服器主動關閉連線（close code 1001）。

客戶端亦可發送 `{ type: "PING", ts, payload: {} }` 應用層心跳，伺服器不回應（靜默接受）。

---

### Server → Client 事件

#### ROOM_STATE

任何房間狀態變更（玩家加入/離線/踢出/`winnerCount` 變更/狀態轉換）時廣播給房間所有連線。

```typescript
type WsEventType = "ROOM_STATE";

interface RoomStatePayload {
  room: Omit<Room, "ladder" | "results" | "kickedPlayerIds">;
  onlineCount: number;
}
```

```json
{
  "type": "ROOM_STATE",
  "ts": 1745049650000,
  "payload": {
    "room": {
      "code": "AB3K7X",
      "status": "waiting",
      "hostId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "players": [
        { "id": "f47ac10b-...", "nickname": "Alice", "colorIndex": 0, "isHost": true, "isOnline": true, "joinedAt": 1745049600000, "result": null },
        { "id": "a3bb189e-...", "nickname": "Bob",   "colorIndex": 1, "isHost": false, "isOnline": true, "joinedAt": 1745049630000, "result": null }
      ],
      "winnerCount": 1,
      "revealedCount": 0,
      "revealMode": "manual",
      "autoRevealIntervalSec": null,
      "createdAt": 1745049600000,
      "updatedAt": 1745049650000
    },
    "onlineCount": 2
  }
}
```

**觸發時機：** 玩家加入/斷線/重連/被踢、`winnerCount` 設定、遊戲狀態轉換、`RESET_ROOM`

---

#### ROOM_STATE_FULL

玩家 WebSocket 連線建立或重連時，**unicast** 給該連線（僅對該 session 發送）。包含完整 `ladder` 與 `results`，讓客戶端重建完整畫面。

```typescript
type WsEventType = "ROOM_STATE_FULL";

interface RoomStateFullPayload extends RoomStatePayload {
  ladder: LadderData | null;
  results: readonly ResultSlot[] | null;
  selfPlayerId: string;   // 對應此 session 的玩家 ID
}
```

```json
{
  "type": "ROOM_STATE_FULL",
  "ts": 1745049655000,
  "payload": {
    "room": { "...": "（同 ROOM_STATE）" },
    "onlineCount": 2,
    "ladder": null,
    "results": null,
    "selfPlayerId": "a3bb189e-8bf9-3888-9912-ace4e6543002"
  }
}
```

**觸發時機：** WS 連線成功後立即 unicast 給連線玩家（含 `selfPlayerId`）；新連線與重連均觸發

---

#### REVEAL_INDEX

手動或自動揭示模式下，逐一揭示單一玩家的梯子路徑與結果。

```typescript
type WsEventType = "REVEAL_INDEX";

interface RevealIndexPayload {
  playerIndex: number;    // Canvas 列索引（0-based）
  result: {
    playerIndex: number;
    playerId: string;
    startCol: number;
    endCol: number;
    isWinner: boolean;    // 僅 win/lose，無命名獎項
    path: Array<{
      row: number;
      col: number;
      direction: "down" | "left" | "right";
    }>;
  };
  revealedCount: number;  // 已揭示數量（含本次）
  totalCount: number;     // 總玩家數
}
```

```json
{
  "type": "REVEAL_INDEX",
  "ts": 1745050200000,
  "payload": {
    "playerIndex": 0,
    "result": {
      "playerIndex": 0,
      "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "startCol": 0,
      "endCol": 2,
      "isWinner": true,
      "path": [
        { "row": 0, "col": 0, "direction": "down" },
        { "row": 1, "col": 0, "direction": "right" },
        { "row": 1, "col": 1, "direction": "down" }
      ]
    },
    "revealedCount": 1,
    "totalCount": 3
  }
}
```

**觸發時機：** `REVEAL_NEXT` 訊息處理後 / 自動揭示 timer 觸發

---

#### REVEAL_ALL

所有玩家路徑揭示完畢，或房主使用「一鍵全揭」時廣播。包含全部剩餘未揭示的路徑。

```typescript
type WsEventType = "REVEAL_ALL";

interface RevealAllPayload {
  results: readonly ResultSlot[];   // 全部玩家結果（含已揭示與本次揭示）
}
```

```json
{
  "type": "REVEAL_ALL",
  "ts": 1745050300000,
  "payload": {
    "results": [
      { "playerIndex": 0, "playerId": "f47ac10b-...", "startCol": 0, "endCol": 2, "isWinner": true, "path": [] },
      { "playerIndex": 1, "playerId": "a3bb189e-...", "startCol": 1, "endCol": 0, "isWinner": false, "path": [] }
    ]
  }
}
```

**觸發時機：** 最後一次 `REVEAL_INDEX` 後 / `REVEAL_ALL_TRIGGER` 訊息 / 一鍵全揭

---

#### PLAYER_KICKED

房主踢出玩家時，**unicast 給被踢玩家**（若仍在線）；房間其他玩家透過後續 `ROOM_STATE` 廣播得知名單變更。

```typescript
type WsEventType = "PLAYER_KICKED";

interface PlayerKickedPayload {
  kickedPlayerId: string;
  reason: string;           // e.g. "Kicked by host"
}
```

```json
{
  "type": "PLAYER_KICKED",
  "ts": 1745049700000,
  "payload": {
    "kickedPlayerId": "a3bb189e-8bf9-3888-9912-ace4e6543002",
    "reason": "Kicked by host"
  }
}
```

**觸發時機：** `DELETE /api/rooms/:code/players/:playerId` 或 `KICK_PLAYER` WS 訊息成功執行後；unicast 給被踢玩家，其他玩家收到 `ROOM_STATE` 廣播

---

#### SESSION_REPLACED

同一 `playerId` 從新裝置/瀏覽器重新連線時，**unicast** 給舊連線。收到後客戶端應跳回首頁。

```typescript
type WsEventType = "SESSION_REPLACED";

interface SessionReplacedPayload {
  message: string;
}
```

```json
{
  "type": "SESSION_REPLACED",
  "ts": 1745049800000,
  "payload": {
    "message": "Your session has been replaced by a new connection."
  }
}
```

**觸發時機：** 相同 `playerId` 的新 WS 連線建立時，舊連線收到此事件後被強制關閉

---

#### HOST_TRANSFERRED

房主斷線超過 **60 秒** 未重連，系統自動將房主身份轉移給下一位在線玩家（按 `joinedAt` 排序）。

```typescript
type WsEventType = "HOST_TRANSFERRED";

interface HostTransferredPayload {
  newHostId: string;
  reason: "disconnect_timeout";
}
```

```json
{
  "type": "HOST_TRANSFERRED",
  "ts": 1745049860000,
  "payload": {
    "newHostId": "b2c1d3e4-f5a6-7890-bcde-f12345678901",
    "reason": "disconnect_timeout"
  }
}
```

**觸發時機：** 房主斷線 60 秒 grace period 結束，且無在線玩家接管前自動移交

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

**觸發時機：** 任何 Client→Server 訊息操作失敗（權限不足、狀態不符、驗證失敗等）

---

### Client → Server 訊息

#### START_GAME

觸發遊戲開始。僅 host、`waiting` 狀態有效。

```typescript
type WsMsgType = "START_GAME";
// payload: {}（空物件）
```

```json
{ "type": "START_GAME", "ts": 1745050000000, "payload": {} }
```

**驗證：** JWT `role === "host"` + Redis `room.hostId` 比對；狀態必須為 `waiting`；N >= 2；1 <= W <= N-1

**成功後：** 廣播 `ROOM_STATE`（`status: "running"`）；亦可透過 `POST /api/rooms/:code/game/start` 取得完整 `LadderData`

---

#### BEGIN_REVEAL

開始揭示階段。房主在 `running` 狀態發送，房間轉移至 `revealing`。

```typescript
type WsMsgType = "BEGIN_REVEAL";
// payload: {}
```

```json
{ "type": "BEGIN_REVEAL", "ts": 1745050100000, "payload": {} }
```

**驗證：** host only；狀態必須為 `running`

**成功後：** 廣播 `ROOM_STATE`（`status: "revealing"`）

---

#### REVEAL_NEXT

手動模式逐一揭示下一位玩家。伺服器以 `revealedCount` 決定下一個揭示索引，payload 不含 index。

```typescript
type WsMsgType = "REVEAL_NEXT";
// payload: {}
```

```json
{ "type": "REVEAL_NEXT", "ts": 1745050200000, "payload": {} }
```

**驗證：** host only；狀態必須為 `revealing`；`revealedCount < totalCount`（否則回傳 ERROR `INVALID_STATE`）

**成功後：** 廣播 `REVEAL_INDEX`；若 `revealedCount === totalCount` 接著廣播 `REVEAL_ALL` 並轉 `finished`

---

#### REVEAL_ALL_TRIGGER

一鍵揭示所有剩餘玩家路徑。

```typescript
type WsMsgType = "REVEAL_ALL_TRIGGER";
// payload: {}
```

```json
{ "type": "REVEAL_ALL_TRIGGER", "ts": 1745050250000, "payload": {} }
```

**驗證：** host only；狀態必須為 `revealing`

**成功後：** 廣播 `REVEAL_ALL`（含全部剩餘路徑）；房間轉 `finished`；Redis TTL 延長至 1 小時

---

#### SET_REVEAL_MODE

切換手動/自動揭示模式。揭示進行中可隨時切換。

```typescript
type WsMsgType = "SET_REVEAL_MODE";

interface SetRevealModePayload {
  mode: "manual" | "auto";
  intervalSec?: number;   // mode === "auto" 時必填，範圍 1-30（整數秒）
}
```

```json
{ "type": "SET_REVEAL_MODE", "ts": 1745050150000, "payload": { "mode": "auto", "intervalSec": 2 } }
```

**驗證：** host only；狀態必須為 `revealing`；`mode === "auto"` 時 `intervalSec` 必填且 1-30

**成功後：** 廣播 `ROOM_STATE`（含更新的 `revealMode`、`autoRevealIntervalSec`）

---

#### RESET_ROOM

遊戲結束後重置房間。等同呼叫 `POST /api/rooms/:code/game/reset`（WS 版本，方便前端統一使用 WS）。

```typescript
type WsMsgType = "RESET_ROOM";
// payload: {}
```

```json
{ "type": "RESET_ROOM", "ts": 1745050400000, "payload": {} }
```

**驗證：** host only；狀態必須為 `finished`；在線玩家 >= 2

---

#### KICK_PLAYER

踢出指定玩家。等同呼叫 `DELETE /api/rooms/:code/players/:playerId`。

```typescript
type WsMsgType = "KICK_PLAYER";

interface KickPlayerPayload {
  targetPlayerId: string;   // UUID v4
}
```

```json
{ "type": "KICK_PLAYER", "ts": 1745049700000, "payload": { "targetPlayerId": "a3bb189e-8bf9-3888-9912-ace4e6543002" } }
```

**驗證：** host only；狀態必須為 `waiting`；不可踢自己（房主）

---

#### PING

應用層心跳。伺服器靜默接受，不回應。

```typescript
type WsMsgType = "PING";
// payload: {}
```

```json
{ "type": "PING", "ts": 1745049600000, "payload": {} }
```

---

## 4. 錯誤碼完整參照

| 錯誤碼 | HTTP 狀態 | WS close code | 說明 | 重試建議 |
|--------|-----------|---------------|------|---------|
| `ROOM_NOT_FOUND` | 404 | — | 房間不存在或 TTL 過期 | 不重試，引導用戶重新確認代碼 |
| `ROOM_FULL` | 409 | — | 已達 50 人上限 | 不重試 |
| `ROOM_NOT_ACCEPTING` | 409 | — | 房間非 `waiting` 狀態，不再接受玩家加入 | 等待房間重置後重試 |
| `NICKNAME_TAKEN` | 409 | — | 暱稱在此房間已被使用 | 換暱稱後重試 |
| `PLAYER_NOT_FOUND` | 404 | — | 目標玩家不存在此房間 | 不重試 |
| `PLAYER_NOT_HOST` | 403 | — | 操作需要房主權限 | 不重試，檢查身份 |
| `AUTH_INVALID_TOKEN` | 401 | 4001 | JWT 無效（格式錯誤或簽名不符） | 重新加入房間取得新 token |
| `AUTH_TOKEN_EXPIRED` | 401 | — | JWT 已過期（TTL 6 小時） | 重新加入房間取得新 token |
| `PLAYER_KICKED` | — | 4003 | 玩家已被踢出，WS Upgrade 階段拒絕 | 不重試（被踢出狀態持續至房間 reset） |
| `SESSION_REPLACED` | — | 4002 | 同一 playerId 從新連線登入，舊連線被強制關閉 | 不重試，引導用戶重新加入 |
| `INSUFFICIENT_PLAYERS` | 400 | — | 玩家數 N < 2，無法開始遊戲 | 等待更多玩家加入後重試 |
| `INSUFFICIENT_ONLINE_PLAYERS` | 400 | — | 再玩一局時在線玩家 < 2 | 等待玩家上線後重試 |
| `PRIZES_NOT_SET` | 400 | — | `winnerCount` 尚未設定 | 設定中獎名額後重試 |
| `INVALID_PRIZES_COUNT` | 400 | — | `winnerCount < 1` 或 `>= N`（需 1 <= W <= N-1） | 修正數值後重試 |
| `INVALID_STATE` | 409 | — | 操作不符合當前房間狀態 | 確認目前狀態後重試 |
| `SYS_INTERNAL_ERROR` | 500 | — | 非預期的伺服器內部錯誤 | 可帶 `requestId` 重試一次；持續失敗請聯繫支援 |
| `RATE_LIMIT` | 429 | 4029 | 超過速率限制（WS: 60 msg/min/conn） | 等待 `Retry-After` 秒數後重試 |

> **WS 訊息層錯誤（不關閉連線）：**
> - `WS_INVALID_MSG`：JSON parse 失敗
> - `WS_UNKNOWN_TYPE`：未知的 `type` 欄位
> - `AUTH_NOT_HOST`：非 host 發送 host-only 訊息

---

## 5. JWT 規格

### 算法與密鑰

| 屬性 | 規格 |
|------|------|
| 算法 | HS256（HMAC-SHA256，RFC 7519） |
| 密鑰來源 | 環境變數 `JWT_SECRET`，最少 256-bit（32 bytes）隨機字串 |
| 庫 | `jose`（Node.js）— 不使用 `jsonwebtoken` 以符合 Edge Runtime 相容性 |

### Payload 結構

```typescript
interface JwtPayload {
  playerId: string;              // UUID v4
  roomCode: string;              // 6 碼房間代碼
  role: "host" | "player";      // 身份角色
  exp: number;                   // Unix seconds（簽發時間 + 21600）
  iat: number;                   // 簽發時間 Unix seconds
}
```

**範例 Payload（decoded）：**

```json
{
  "playerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "roomCode": "AB3K7X",
  "role": "host",
  "iat": 1745049600,
  "exp": 1745071200
}
```

### TTL 與 Clock Skew

| 屬性 | 值 |
|------|-----|
| TTL | 6 小時（21600 秒） |
| Clock Skew 容忍 | 30 秒（驗證時允許 `exp` 提前 30 秒過期） |

### 雙重驗證策略

JWT 驗證通過後，host 操作仍需比對 Redis `room.hostId === playerId`，防止 JWT 竊取後的越權攻擊。

---

## 6. 請求範例（curl）

### 1. 建立房間

```bash
curl -X POST https://api.ladder-room.online/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "hostNickname": "Alice",
    "winnerCount": 1
  }'
```

### 2. 查詢房間摘要

```bash
curl https://api.ladder-room.online/api/rooms/AB3K7X
```

### 3. 加入房間

```bash
curl -X POST https://api.ladder-room.online/api/rooms/AB3K7X/players \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "Bob"
  }'
```

### 4. 踢出玩家（房主操作）

```bash
curl -X DELETE \
  https://api.ladder-room.online/api/rooms/AB3K7X/players/a3bb189e-8bf9-3888-9912-ace4e6543002 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 5. 開始遊戲（房主操作）

```bash
curl -X POST https://api.ladder-room.online/api/rooms/AB3K7X/game/start \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 6. 揭示結果（房主操作）

```bash
curl -X POST https://api.ladder-room.online/api/rooms/AB3K7X/game/reveal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"mode":"next"}'
```

### 7. 再玩一局（房主操作）

```bash
curl -X POST https://api.ladder-room.online/api/rooms/AB3K7X/game/reset \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 8. 健康檢查

```bash
curl https://api.ladder-room.online/health
```

### WebSocket 連線範例（wscat）

```bash
# 建立 WS 連線（需先取得 token）
wscat -c "wss://api.ladder-room.online/ws?room=AB3K7X&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 連線後發送 START_GAME
> {"type":"START_GAME","ts":1745050000000,"payload":{}}

# 發送 BEGIN_REVEAL
> {"type":"BEGIN_REVEAL","ts":1745050100000,"payload":{}}

# 逐一揭示
> {"type":"REVEAL_NEXT","ts":1745050200000,"payload":{}}

# 切換自動揭示（每 2 秒）
> {"type":"SET_REVEAL_MODE","ts":1745050210000,"payload":{"mode":"auto","intervalSec":2}}

# 一鍵全揭
> {"type":"REVEAL_ALL_TRIGGER","ts":1745050250000,"payload":{}}

# 再玩一局
> {"type":"RESET_ROOM","ts":1745050400000,"payload":{}}
```

---

*API.md 版本：v1.0*
*生成時間：2026-04-19*
*基於 EDD v1.1 + PRD v1.1（Ladder Room Online）*
