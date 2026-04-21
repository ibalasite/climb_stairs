# API Design Document — Ladder Room Online

*Version: v1.1 | 2026-04-19 | Based on EDD v1.3 + PRD v1.3*

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
| 7 | `POST` | `/api/rooms/:code/game/end` | 結束本局 | 是（host） |
| 8 | `POST` | `/api/rooms/:code/game/play-again` | 再玩一局 | 是（host） |
| 9 | `GET` | `/health` | 健康檢查（liveness） | 否 |
| 10 | `GET` | `/ready` | 就緒檢查（readiness） | 否 |

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

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INVALID_NICKNAME` | `hostNickname` 格式不合法（長度超限或含禁止字元） |
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

房主觸發遊戲開始。後端生成 `seedSource`（UUID v4）並計算 `rowCount`，**不生成梯子結構**（梯子延遲至 BEGIN_REVEAL 時生成）。回傳房間物件（不含 `ladder`）。

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

回傳房間物件（直接 JSON；`ladder` 欄位為 `null`，梯子尚未生成）：

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

> **注意**：`seed` 與 `seedSource` 在 `status=finished` 之前均不對客戶端公開（PRD AC-H03-1, NFR-05）。`rowCount` 透過 WS `ROOM_STATE` 廣播傳遞（含於 room 物件），但 `seed` 不公開。梯子結構（`LadderData`）在 BEGIN_REVEAL 時才生成並寫入 Redis。

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
房間必須在 `revealing` 狀態。揭示完畢後需由房主另行發送 END_GAME 訊息（WS 或 HTTP）才轉入 `finished`。

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

回傳更新後的房間物件（直接 JSON）。`ladder` 在 `revealing` 狀態為 `LadderDataPublic`（省略 `seed`）：

```json
{
  "code": "AB3K7X",
  "status": "revealing",
  "hostId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "players": [],
  "winnerCount": 1,
  "ladder": {
    "rowCount": 20,
    "colCount": 3,
    "segments": [{ "row": 0, "col": 1 }, { "row": 3, "col": 0 }]
  },
  "revealedCount": 1,
  "revealMode": "manual",
  "autoRevealIntervalSec": null,
  "createdAt": 1745049600000,
  "updatedAt": 1745050200000
}
```

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 400 | `INVALID_REVEAL_MODE` | `mode` 欄位不合法（非 `"next"` / `"all"`） |
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `revealing` |

**Rate Limit:** 100 req/min/IP

---

### 7. POST /api/rooms/:code/game/end — 結束本局

房主在所有路徑揭示完畢後，手動觸發本局結束。房間從 `revealing` 轉為 `finished`，並廣播包含 `seed` 的 `ROOM_STATE`。

**重要**：`REVEAL_ALL_TRIGGER` 或最後一次 `REVEAL_NEXT` 本身不自動轉入 `finished`；必須由 Host 另外發送 END_GAME（WS 或此 HTTP 端點）才能完成狀態轉換（PRD AC-H04-4, AC-H06-2）。

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

回傳已結束的房間物件（直接 JSON，含 `seed` 與完整 `results`）：

```json
{
  "code": "AB3K7X",
  "status": "finished",
  "hostId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "players": [],
  "winnerCount": 1,
  "ladder": {
    "seed": 1879452061,
    "seedSource": "550e8400-e29b-41d4-a716-446655440000",
    "rowCount": 20,
    "colCount": 3,
    "segments": []
  },
  "revealedCount": 3,
  "revealMode": "manual",
  "autoRevealIntervalSec": null,
  "createdAt": 1745049600000,
  "updatedAt": 1745051000000
}
```

**Error Responses**

| HTTP | 錯誤碼 | 說明 |
|------|--------|------|
| 403 | `PLAYER_NOT_HOST` | 操作者不是房主 |
| 409 | `INVALID_STATE` | 房間狀態非 `revealing` 或尚未所有路徑揭示完畢（`revealedCount < totalCount`） |

**Rate Limit:** 100 req/min/IP

---

### 8. POST /api/rooms/:code/game/play-again — 再玩一局

房主在遊戲結束後重置房間進行下一局（取代舊版 `RESET_ROOM`）。僅限 `finished` 狀態。離線玩家被移除，`kickedPlayerIds` 清空，`winnerCount` 若 >= 新玩家數則重置為 null。

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

### 9. GET /health — 健康檢查（Liveness）

回報後端服務與 Redis 連線狀態。供 Kubernetes liveness probe 使用。

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

### 10. GET /ready — 就緒檢查（Readiness）

回報後端是否已準備好接收流量（Redis 連線正常且無正在進行的啟動作業）。供 Kubernetes readiness probe 使用。

**Request Headers:** 無

**Success Response — 200 OK**

```typescript
interface ReadyResponse {
  status: "ok" | "not_ready";
  redis: "ok" | "error";
}
```

```json
{
  "status": "ok",
  "redis": "ok"
}
```

**Error Response — 503 Service Unavailable**（Redis 未就緒）

```json
{
  "status": "not_ready",
  "redis": "error"
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

### 共用資料型別

以下型別在 HTTP 回應與 WS payload 中均有使用，統一於此定義：

```typescript
/** 房間玩家物件 */
interface Player {
  id: string;           // UUID v4
  nickname: string;     // 1-20 字元暱稱
  colorIndex: number;   // 0-based 顏色索引（前端調色板對應）
  isHost: boolean;
  isOnline: boolean;
  joinedAt: number;     // Unix milliseconds
  result: ResultSlot | null;  // null = 尚未揭示
}

/** 完整房間物件（HTTP 端點與 ROOM_STATE_FULL 使用） */
interface Room {
  code: string;                        // 6 碼房間代碼
  title: string | null;                // 可選房間名稱（UPDATE_TITLE 設定）
  status: "waiting" | "running" | "revealing" | "finished";
  hostId: string;                      // UUID v4，房主 playerId
  players: readonly Player[];
  winnerCount: number | null;          // null = 尚未設定
  ladder: LadderDataPublic | LadderData | null;  // null = 未生成；LadderDataPublic = revealing；LadderData = finished
  results: readonly ResultSlot[] | null;
  revealedCount: number;
  revealMode: "manual" | "auto";
  autoRevealIntervalSec: number | null;          // null = 手動模式
  kickedPlayerIds: readonly string[];            // 被踢玩家 UUID 列表（不對外廣播）
  createdAt: number;                   // Unix milliseconds
  updatedAt: number;                   // Unix milliseconds
}
```

> **注意**：`ROOM_STATE` 廣播使用 `Omit<Room, "ladder" | "results" | "kickedPlayerIds">`，即省略梯子資料、結果與踢出名單；完整資料僅在 `ROOM_STATE_FULL`（unicast）中發送。`seed` 欄位在 `status=finished` 前不含於任何對外傳輸中。

---

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

客戶端亦可發送應用層 `{ type: "PING", ts, payload: {} }` 心跳，伺服器回應 `PONG { ts: echo }` 供 RTT 量測使用（非傳輸層心跳主路徑）。

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
      "title": null,
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

**觸發時機：** 玩家加入/斷線/重連/被踢、`winnerCount` 設定、遊戲狀態轉換、`PLAY_AGAIN`

---

#### ROOM_STATE_FULL

玩家 WebSocket 連線建立或重連時，**unicast** 給該連線（僅對該 session 發送）。包含完整 `ladder` 與 `results`，讓客戶端重建完整畫面。

`ladder` 欄位依房間狀態而異：
- `waiting` / `running`：`null`（梯子尚未生成）
- `revealing`：`LadderDataPublic`（省略 `seed` 與 `seedSource`，PRD AC-H03-1, NFR-05）
- `finished`：`LadderData`（含完整 `seed` + `seedSource` 供可審計性）

```typescript
type WsEventType = "ROOM_STATE_FULL";

/**
 * LadderSegment — 梯子橫向連線節點（表示某列某兩欄之間的橫槓）。
 */
interface LadderSegment {
  row: number;    // 行索引（0-based）
  col: number;    // 左側欄索引（0-based）；橫槓連接 col 與 col+1
}

/**
 * LadderDataPublic — 在 revealing 狀態發送給客戶端（省略 seed/seedSource）。
 * 前端利用此資料自行計算路徑動畫（PRD NFR-05, MVP Option A）。
 */
interface LadderDataPublic {
  rowCount: number;
  colCount: number;
  segments: readonly LadderSegment[];
  // seed 與 seedSource 刻意省略 — status=finished 前不對客戶端公開
}

/**
 * LadderData — 完整梯子資料，在 status=finished 時發送（含 seed 與 seedSource 供可審計性）。
 */
interface LadderData extends LadderDataPublic {
  seed: number;         // 32-bit 整數，由 seedSource UUID 衍生（Murmur3 hash）
  seedSource: string;   // UUID v4，START_GAME 時生成，status=finished 前不對外公開
}

interface RoomStateFullPayload extends RoomStatePayload {
  ladder: LadderDataPublic | LadderData | null;
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
  result: ResultSlot;     // 含完整 path（單一玩家，資料量小，安全在 64KB 內）
  revealedCount: number;  // 已揭示數量（含本次）
  totalCount: number;     // 總玩家數
}

interface ResultSlot {
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

房主使用「一鍵全揭」（`REVEAL_ALL_TRIGGER`）時廣播，包含全部剩餘未揭示的路徑結果。

**重要**：REVEAL_ALL payload 使用 `ResultSlotPublic`（省略 `path` 欄位），以符合 WebSocket maxPayload 64KB 限制（N=50, rowCount=60 時完整 path 約 150KB，超出限制）。前端利用已收到的 `LadderDataPublic` 自行計算動畫路徑（PRD NFR-05, MVP Option A）。

```typescript
type WsEventType = "REVEAL_ALL";

/** ResultSlotPublic — REVEAL_ALL payload 專用；省略 path 以符合 64KB 限制 */
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

**觸發時機：** `REVEAL_ALL_TRIGGER` WS 訊息 / 一鍵全揭
**注意：** REVEAL_ALL 後房間仍維持 `revealing` 狀態，等待 Host 另行發送 `END_GAME` 才轉 `finished`

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

#### PONG

回應客戶端應用層 PING 訊息，用於 RTT 量測。

```typescript
type WsEventType = "PONG";

interface PongPayload {
  ts: number;   // echo of client's PING ts，供計算往返延遲
}
```

```json
{
  "type": "PONG",
  "ts": 1745049900000,
  "payload": {
    "ts": 1745049899950
  }
}
```

**觸發時機：** 收到客戶端應用層 `PING` 訊息後立即 unicast 回傳

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

> **注意**：遊戲控制操作（START_GAME、BEGIN_REVEAL、END_GAME、PLAY_AGAIN）同時支援 WS 訊息（即時）和 HTTP REST（向後相容）。前端主要使用 WS 路徑；HTTP 路徑供 CLI/工具使用或 WS 不可用時降級。

#### START_GAME

觸發遊戲開始。僅 host、`waiting` 狀態有效。後端生成 `seedSource` 並計算 `rowCount`，但**不生成梯子**（延遲至 BEGIN_REVEAL）。

```typescript
type WsMsgType = "START_GAME";
// payload: {}（空物件）
```

```json
{ "type": "START_GAME", "ts": 1745050000000, "payload": {} }
```

**驗證：** JWT `role === "host"` + Redis `room.hostId` 比對；狀態必須為 `waiting`；N >= 2；1 <= W <= N-1

**成功後：** 廣播 `ROOM_STATE`（`status: "running"`, `rowCount`）；`seed`/`ladder` 不廣播

---

#### BEGIN_REVEAL

開始揭示階段。房主在 `running` 狀態發送，後端在此時原子生成梯子（`GenerateLadder` + `ComputeResults`），房間轉移至 `revealing`。

```typescript
type WsMsgType = "BEGIN_REVEAL";
// payload: {}
```

```json
{ "type": "BEGIN_REVEAL", "ts": 1745050100000, "payload": {} }
```

**驗證：** host only；狀態必須為 `running`

**成功後：** 廣播 `ROOM_STATE`（`status: "revealing"`）；ladder 在 Redis 已生成但 `seed` 不對客戶端公開

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

**成功後：** 廣播 `REVEAL_INDEX`；**不自動轉入 `finished`**（需另行 END_GAME）

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

**成功後：** 廣播 `REVEAL_ALL`（含所有剩餘路徑，使用 `ResultSlotPublic` 省略 path）；房間**仍維持 `revealing` 狀態**，等待 Host 另行發送 END_GAME

---

#### END_GAME

Host 在所有路徑揭示完畢後手動觸發本局結束。房間從 `revealing` 轉為 `finished`。`seed` 在此時首次對客戶端公開。

```typescript
type WsMsgType = "END_GAME";
// payload: {}
```

```json
{ "type": "END_GAME", "ts": 1745050350000, "payload": {} }
```

**驗證：** host only；狀態必須為 `revealing`；`revealedCount === totalCount`（否則 `INVALID_STATE`）

**成功後：** 廣播 `ROOM_STATE`（`status: "finished"`，含 `seed`、完整 `results[]`）；Redis TTL 延長至 1 小時

---

#### PLAY_AGAIN

遊戲結束後重置房間。取代舊版 `RESET_ROOM`。離線玩家被移除，`kickedPlayerIds` 清空，`winnerCount` 若 >= 新玩家數則重置為 null。

```typescript
type WsMsgType = "PLAY_AGAIN";
// payload: {}
```

```json
{ "type": "PLAY_AGAIN", "ts": 1745050400000, "payload": {} }
```

**驗證：** host only；狀態必須為 `finished`；在線玩家 >= 2

**成功後：** 廣播 `ROOM_STATE`（`status: "waiting"`）；`kickedPlayerIds` 清空（被踢者可用新 playerId 重新加入）

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

應用層心跳，伺服器回應 `PONG { ts: echo }` 供 RTT 量測（傳輸層心跳由 ws 內建 30s ping/pong 處理）。

```typescript
type WsMsgType = "PING";
// payload: {}
```

```json
{ "type": "PING", "ts": 1745049600000, "payload": {} }
```

---

#### UPDATE_WINNER_COUNT

更新中獎名額。Host only，`waiting` 狀態限定。

```typescript
type WsMsgType = "UPDATE_WINNER_COUNT";

interface UpdateWinnerCountPayload {
  winnerCount: number;  // 1 <= winnerCount <= playerCount-1
}
```

```json
{ "type": "UPDATE_WINNER_COUNT", "ts": 1745049620000, "payload": { "winnerCount": 2 } }
```

**驗證：** host only；`waiting` 狀態；1 <= winnerCount <= playerCount-1
**成功後：** 廣播 `ROOM_STATE`（含更新後 winnerCount）

---

#### UPDATE_TITLE

更新房間名稱。Host only，`waiting` 狀態限定。

```typescript
type WsMsgType = "UPDATE_TITLE";

interface UpdateTitlePayload {
  title: string;  // 0-50 字元（空字串代表清除）
}
```

```json
{ "type": "UPDATE_TITLE", "ts": 1745049625000, "payload": { "title": "Alice 的遊戲" } }
```

**驗證：** host only；`waiting` 狀態；0-50 字元
**成功後：** 廣播 `ROOM_STATE`（含更新後 title）

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
| `AUTH_TOKEN_EXPIRED` | 401 | 4001 | JWT 已過期（TTL 6 小時）；WS Upgrade 階段以 4001 拒絕 | 重新加入房間取得新 token |
| `PLAYER_KICKED` | — | 4003 | 玩家已被踢出，WS Upgrade 階段拒絕 | 不重試（被踢出狀態持續至房間 reset） |
| `SESSION_REPLACED` | — | 4002 | 同一 playerId 從新連線登入，舊連線被強制關閉 | 不重試，引導用戶重新加入 |
| `INSUFFICIENT_PLAYERS` | 400 | — | 玩家數 N < 2，無法開始遊戲 | 等待更多玩家加入後重試 |
| `INSUFFICIENT_ONLINE_PLAYERS` | 400 | — | 再玩一局時在線玩家 < 2 | 等待玩家上線後重試 |
| `PRIZES_NOT_SET` | 400 | — | `winnerCount` 尚未設定 | 設定中獎名額後重試 |
| `INVALID_PRIZES_COUNT` | 400 | — | `winnerCount < 1` 或 `>= N`（需 1 <= W <= N-1） | 修正數值後重試 |
| `INVALID_STATE` | 409 | — | 操作不符合當前房間狀態 | 確認目前狀態後重試 |
| `CANNOT_KICK_HOST` | 400 | — | 踢除操作目標為 Host 本身 | 不重試 |
| `INVALID_NICKNAME` | 400 | — | 暱稱格式不合法（長度超限、含禁止字元） | 修正暱稱後重試 |
| `INVALID_AUTO_REVEAL_INTERVAL` | 400 | — | SET_REVEAL_MODE intervalSec 不合法（非 1-30 整數） | 修正值後重試 |
| `INVALID_REVEAL_MODE` | 400 | — | POST /game/reveal 的 `mode` 欄位不合法（非 `"next"` / `"all"`） | 修正值後重試 |
| `SYS_INTERNAL_ERROR` | 500 | — | 非預期的伺服器內部錯誤 | 可帶 `requestId` 重試一次；持續失敗請聯繫支援 |
| `RATE_LIMIT` | 429 | 4029 | 超過速率限制（WS: 60 msg/min/conn） | 等待 `Retry-After` 秒數後重試 |

> **WS 訊息層錯誤（不關閉連線）：**
> - `WS_INVALID_MSG`：JSON parse 失敗
> - `WS_UNKNOWN_TYPE`：未知的 `type` 欄位
> - `AUTH_NOT_HOST`：非 host 發送 host-only 訊息
> - `KICK_NOT_ALLOWED_IN_STATE`：在非 waiting 狀態嘗試踢人（`KICK_PLAYER` 限 waiting）

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

### 7. 結束本局（房主操作）

```bash
curl -X POST https://api.ladder-room.online/api/rooms/AB3K7X/game/end \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 8. 再玩一局（房主操作）

```bash
curl -X POST https://api.ladder-room.online/api/rooms/AB3K7X/game/play-again \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 9. 健康檢查

```bash
curl https://api.ladder-room.online/health
```

### WebSocket 連線範例（wscat）

```bash
# 建立 WS 連線（需先取得 token）
wscat -c "wss://api.ladder-room.online/ws?room=AB3K7X&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 連線後發送 START_GAME
> {"type":"START_GAME","ts":1745050000000,"payload":{}}

# 發送 BEGIN_REVEAL（此時後端才生成梯子）
> {"type":"BEGIN_REVEAL","ts":1745050100000,"payload":{}}

# 逐一揭示
> {"type":"REVEAL_NEXT","ts":1745050200000,"payload":{}}

# 切換自動揭示（每 2 秒）
> {"type":"SET_REVEAL_MODE","ts":1745050210000,"payload":{"mode":"auto","intervalSec":2}}

# 一鍵全揭（房間仍維持 revealing，需再發 END_GAME）
> {"type":"REVEAL_ALL_TRIGGER","ts":1745050250000,"payload":{}}

# 結束本局（所有路徑揭曉後，seed 此時公開）
> {"type":"END_GAME","ts":1745050350000,"payload":{}}

# 再玩一局
> {"type":"PLAY_AGAIN","ts":1745050400000,"payload":{}}
```

---

*API.md 版本：v1.2*
*生成時間：2026-04-19*
*修訂時間：2026-04-19（STEP-07 devsop-autodev 與 EDD v1.3 對齊）*
*修訂重點（v1.1 vs v1.0）：*
*1. 新增 POST /game/end 端點（END_GAME）、更名 /game/reset → /game/play-again*
*2. START_GAME 回應修正：ladder=null（梯子延遲至 BEGIN_REVEAL 生成）*
*3. REVEAL_ALL payload 改用 ResultSlotPublic（省略 path，符合 64KB 限制）*
*4. ROOM_STATE_FULL 新增 LadderDataPublic 說明（revealing 時省略 seed/seedSource）*
*5. WS RESET_ROOM 替換為 END_GAME + PLAY_AGAIN；新增 UPDATE_WINNER_COUNT / UPDATE_TITLE*
*6. PING 說明修正：伺服器回應 PONG（RTT 量測）；新增 PONG 事件文件*
*7. REVEAL_NEXT / REVEAL_ALL_TRIGGER 說明：不自動轉 finished，需另行 END_GAME*
*基於 EDD v1.3 + PRD v1.3（Ladder Room Online）*
*修訂重點（v1.2 — STEP-09 API Review Round 1）：*
*1. POST /game/reveal 成功回應新增完整 JSON 範例，補充 400 INVALID_REVEAL_MODE 錯誤碼*
*2. GET /ready 從 GET /health 合併區塊拆分，新增獨立 ReadyResponse schema 與 503 錯誤回應*
*3. ROOM_STATE_FULL 新增 LadderSegment 介面定義，正式定義 LadderData（含 seed/seedSource）*
*4. AUTH_TOKEN_EXPIRED 補充 WS close code 4001（WS Upgrade 階段過期 token 以 4001 拒絕）*
*5. Section 4 錯誤碼表新增 INVALID_REVEAL_MODE 條目*
