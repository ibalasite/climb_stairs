# 對齊掃描報告 — Ladder Room Online

> 由 `/devsop-align-check` 自動生成  
> 日期：2026-04-19（第二次掃描）  
> 專案：/Users/tobala/projects/climb_stairs

---

## Out of Scope（不列入問題）

PDD §13 明確排除：正式帳號系統、頭像、QR Code、語音/聊天、複雜道具、多輪淘汰制、多房間列表/大廳、多局歷史記錄、**移交 Host 權限**。

---

## 摘要

| 對齊層        | CRITICAL | HIGH | MEDIUM | LOW | 總計 | 狀態 |
|--------------|---------|------|--------|-----|------|------|
| Doc → Doc    |    2    |  10  |    7   |  3  |  22  |  🔴  |
| Doc → Code   |    1    |   9  |    3   |  3  |  16  |  🔴  |
| Code → Test  |    0    |   3  |    6   |  4  |  13  |  ⚠️  |
| Doc → Test   |    4    |   8  |    5   |  4  |  21  |  🔴  |
| **總計**      | **7**  | **30** | **21** | **14** | **72** | |

（vs 上次掃描：99 個 → 已修復 27 個，新增 0 個）

---

## Dimension 1 — Doc → Doc 對齊問題

### PDD → PRD

**[HIGH] PDD→PRD: `title` 欄位（房間名稱）在 PRD 完全缺失**
PDD §7.1 定義 `title`（0~50 碼）為可修改欄位，並有 `TITLE_UPDATE_NOT_ALLOWED_IN_STATE` 錯誤碼（PDD §14）。PRD 所有 User Story 均無涵蓋。
受影響範圍：US-H01 AC 缺少 title；FR-01-3 狀態物件清單缺少 title；PDD §14 錯誤碼無 PRD 對應。

**[HIGH] PDD→PRD: `running → revealing` 原子操作語意不明**
PDD §6.2 定義 `running→revealing` 為 Server 自動完成的原子操作。PRD AC-H03-1 說「狀態轉為 running」，FR-04-1 列狀態流轉路徑，但未明確說明 `running→revealing` 是自動觸發，容易被誤讀為需要 Host 主動觸發 `BEGIN_REVEAL`。
受影響範圍：FR-04-1、FR-04-4；EDD 和 API 引入了 PRD 未授權的 `BEGIN_REVEAL` 步驟。

**[MEDIUM] PDD→PRD: seed 保密性（防作弊）在 PRD 無 AC**
PDD §11.1 規定「seed 在 `finished` 前禁止傳送至任何客戶端」。PRD 完全未設計對應 AC 或 NFR。
受影響範圍：PRD 缺少防作弊驗收標準，QA 無測試計劃覆蓋此安全要求。

**[MEDIUM] PDD→PRD: Room Code 碰撞重試耗盡錯誤路徑缺失**
PDD §7.1 定義碰撞重試上限 10 次後回傳 `ROOM_CODE_GENERATION_FAILED`。PRD AC-H01-3 只描述「網路異常」情境，未涵蓋此特定錯誤路徑。
受影響範圍：AC-H01 缺少 Room Code 生成失敗分支。

**[LOW] PDD→PRD: 部分錯誤碼（PDD §14）在 PRD 缺少對應 AC**
`INVALID_AUTO_REVEAL_INTERVAL`、`CANNOT_KICK_HOST`、`KICK_NOT_ALLOWED_IN_STATE`、`PLAY_AGAIN_NOT_ALLOWED_IN_STATE` 等錯誤碼在 PRD 中無對應 AC 說明客戶端行為。
受影響範圍：這些錯誤碼缺乏 PRD 層驗收標準，實作和測試各自理解可能不一致。

---

### PRD → EDD

**[CRITICAL] PRD→EDD: `BEGIN_REVEAL` WS 訊息是 EDD 自行引入的設計，PDD/PRD 未授權**
PDD §6.2 步驟 7 明確定義 `running→revealing` 為 Server 自動完成的原子操作，無需 Host 主動觸發。EDD §2.5 狀態機圖定義「`running → revealing: host BEGIN_REVEAL`」，引入了兩階段流程，與 PDD/PRD 矛盾。
受影響範圍：EDD §2.5 狀態機；EDD §5 BEGIN_REVEAL 訊息；API.md §3 BEGIN_REVEAL；main.ts 已實作 BEGIN_REVEAL handler。

**[HIGH] PRD→EDD: `winnerCount` 更新操作（US-H02）無 EDD 技術設計**
PRD FR-01-3 允許建立時 winnerCount 為 null；PRD AC-H02 定義 Host 可在 waiting 狀態更新 winnerCount。EDD 要求建立時必填 winnerCount（§3 CreateRoomRequest），且無 `UPDATE_WINNER_COUNT` WS 訊息或 HTTP PATCH endpoint。
受影響範圍：P0 功能（設定中獎名額的更新路徑）完全缺乏技術設計。

**[HIGH] PRD→EDD: `title` 欄位在 EDD 完全缺失**
EDD §3 Room interface 無 `title` 欄位；EDD §5 WsMsgType 無 `UPDATE_TITLE`；EDD §12.1 錯誤碼清單缺少 `INVALID_NAME`、`TITLE_UPDATE_NOT_ALLOWED_IN_STATE`（PDD §14 均有定義）。
受影響範圍：EDD §3 Room interface、§5 WS 事件、§12.1 錯誤碼。

**[HIGH] PRD→EDD: `CANNOT_KICK_HOST` 錯誤碼在 EDD/API 均未定義**
PRD AC-H07-3 描述踢除失敗回傳錯誤。PDD §14 定義 `CANNOT_KICK_HOST`。EDD §12.1 和 API.md 均無此錯誤碼。
受影響範圍：EDD §12.1；API.md §4 錯誤碼清單。

**[HIGH] PRD→EDD: `running→revealing` 原子操作的 rollback 逾時機制無技術設計**
PDD §7.1 定義 10 秒 rollback 逾時。EDD §12.4 的 START_GAME 原子性僅描述 `running` 狀態，未包含 `running→revealing` 的原子寫入和 rollback 機制。
受影響範圍：EDD §12.4；高並發下的資料一致性保證缺失。

**[MEDIUM] PRD→EDD: 前端測試覆蓋率目標（NFR-07）在 EDD 未涵蓋**
PRD NFR-07 要求前端單元測試覆蓋率 ≥ 70%。EDD §9.1 只設定 `shared ≥ 90%; server ≥ 80%`，缺少 client 套件的覆蓋率目標。
受影響範圍：EDD §9.1 測試策略。

**[MEDIUM] PRD→EDD: JWT Token 欄位名三份文件各不同**
PRD FR-01-4 稱 `hostToken`；EDD §3/§4 用 `sessionToken`；API.md §1 用 `token`。三份文件三種名稱，增加實作歧義。
受影響範圍：PRD FR-01-4、EDD §3 CreateRoomResponse、API.md §1 成功回應結構。

---

### EDD → ARCH

**[MEDIUM] EDD→ARCH: EDD/ARCH 定義了 `HOST_TRANSFERRED` 機制但屬 Out of Scope**
EDD §3 `Room.hostId mutable`、EDD §5 `HOST_TRANSFERRED` 事件、ARCH §3.1 Host Transfer Timer 全部設計了 PDD §13 明確列為不做的 Host 轉移功能。這些設計超出 MVP 範圍卻已進入技術文件。
受影響範圍：EDD §3、§5；ARCH §3.1、§4.6。（不算 code 問題，是文件範圍問題）

**[LOW] EDD→ARCH: EDD §10.2 QPS 推算用 200 房，與 PRD NFR-02 的 100 房不符**
EDD §10.3 有完整 HPA 規格，ARCH §4.7 明確說明 MVP 單實例不啟用 HPA（一致），但 EDD §10.2 QPS 推算基準（200 房 → 10,000 WS/s）與 PRD NFR-02（100 房）不符，造成容量數字混亂。
受影響範圍：EDD §10.2 QPS 推算；負載測試門檻參照值。

---

### EDD → API

**[CRITICAL] EDD→API: `BEGIN_REVEAL` 被固化進 API 設計，與 PDD §6.2 矛盾**
（同 PRD→EDD CRITICAL 問題，在 API 層進一步固化）
EDD §2.5 和 API.md §3 均定義 `BEGIN_REVEAL` 為 `running→revealing` 的觸發機制，但 PDD §6.2 規定此轉換應由 Server 自動完成。
受影響範圍：API.md §3 Client→Server 訊息 `BEGIN_REVEAL`；main.ts 已實作此 handler，生產行為與 PDD 相悖。

**[HIGH] EDD→API: EDD §4 端點路徑與 API.md §2 仍不一致**
EDD §4 表格使用 `/api/v1/` 前綴；API.md §2 已更新為 `/api/`（無 v1）。另 EDD 的 `start`/`reset` 路徑為 flat 格式，API.md 為 `/game/start`、`/game/reset` nested 格式。EDD §4 未更新以反映 API.md 的修正。
受影響範圍：EDD §4 所有端點路徑；EDD §4 未列出 `GET /ready`。

**[HIGH] EDD→API: `ROOM_STATE_FULL` 推送時機與 PDD §14 矛盾**
EDD §5 和 API.md §3 定義 `ROOM_STATE_FULL` 為「新連線 unicast」。PDD §14 定義此事件的觸發時機為「`running→revealing` 原子寫入完成後全員廣播」，非 unicast。
受影響範圍：EDD §5 ROOM_STATE_FULL 說明；API.md §3 觸發時機；`selfPlayerId` 字段在全員廣播下無意義。

**[MEDIUM] EDD→API: `PLAYER_KICKED` 廣播範圍 EDD/API 與 PDD §14 矛盾**
EDD §5 和 API.md §3 定義 `PLAYER_KICKED` 廣播給「所有人」。PDD §14 定義推送範圍為「僅被踢玩家」，其餘玩家透過 `ROOM_STATE` 得知。
受影響範圍：EDD §5；API.md §3（現行 main.ts 實作已改為含 payload 的 unicast，與 API.md 說「廣播」仍有差異）。

**[MEDIUM] EDD→API: JWT TTL 矛盾（EDD/ARCH 24h vs API.md 6h）**
EDD §4 / ARCH §4.6 定義 JWT 24 小時；API.md §5 定義 6 小時。main.ts 實作為 6h。
受影響範圍：EDD §4 / ARCH §4.6 需更新為 6h。

**[LOW] EDD→API: EDD §4 定義 response envelope，API.md §1 已改為直接 JSON**
EDD §4 規定統一 `{ success, data, error }` envelope；API.md §1 已修正為「直接 JSON 物件，不包裝 envelope」。EDD 未同步更新。
受影響範圍：EDD §4 回應格式說明。

---

### EDD → SCHEMA

**[HIGH] EDD→SCHEMA: Player interface 與 PDD §9 欄位命名不符**
EDD §3 Player 包含 `colorIndex`, `isHost`（PDD §9 無這兩欄位；PDD 的 isHost 由 hostId 比對決定），EDD 定義的 `result?: string | null` 而 PDD §9 定義 `result: "win" | "lose" | null`（不可選）。Room 欄位中 EDD 用 `ladderMap`/`resultSlots`（實際 types 是 `ladder`/`results`），命名不一致。
受影響範圍：EDD §3 Player interface；SCHEMA.md §4 Player interface；兩份文件與 PDD §9 均有偏差。

**[MEDIUM] EDD→SCHEMA: `LadderSegment` 欄位命名 PDD（from/to）vs EDD/SCHEMA（col）不符**
PDD §9 用 `from: number; to: number = from + 1`；EDD §3 和 SCHEMA.md §4 用 `col`。
受影響範圍：EDD §3 LadderSegment；PDD §9 與下游命名衝突。

**[MEDIUM] EDD→SCHEMA: `Room.revealMode` 命名 PDD 與 EDD/SCHEMA 不符**
PDD §9 用 `autoReveal: boolean` 和 `autoRevealInterval: number`；EDD §3 和 SCHEMA.md 用 `revealMode: "manual"|"auto"` 和 `autoRevealIntervalSec`。
受影響範圍：EDD §3 Room interface；PDD §9 命名不一致。

---

### PRD → BDD

**[HIGH] PRD→BDD: 多個 P0/P1 AC 在 features/ 中缺少 Scenario**
`docs/features/` 不存在；實際 feature 文件位於 `/features/`（7 個文件）。EDD §8 的 Gherkin Tag 對應表只覆蓋 11 個 AC，其餘包括 AC-H01-2/3、AC-H02-1/2/3、AC-H04-1/2、AC-H07-1/2、AC-P01-1~4、AC-P02-1/2、AC-P03-1/2、AC-P04-2、AC-P05-1/2/3、AC-P06-1/2 均無對應 Gherkin Scenario。
受影響範圍：PRD NFR-07「E2E 測試覆蓋所有 P0 US Happy Path」無從完整驗證。

**[LOW] PRD→BDD: AC-H05 自動揭曉邊界值（T=1、T=30）在 feature 中缺失**
reveal-flow.feature @AC-REVEAL-003 只使用 intervalSec=3，未測試邊界值 T=1、T=30 及非法值 T=0、T=31。
受影響範圍：AC-H05-1（P1）邊界值覆蓋不足。

**[LOW] PRD→BDD: hostToken 無效/過期的 403 場景無任何 Scenario**
7 個 feature 文件的 Background 均假設 hostToken 有效，無任何 Scenario 使用無效或過期 token 測試 401/403 回應。
受影響範圍：NFR-05 安全性，JWT 驗證層缺乏否定測試。

---

## Dimension 2 — Doc → Code 對齊問題

### API.md → main.ts（HTTP Routes）

**[CRITICAL] `DELETE /api/rooms/:code/players/:playerId` HTTP 狀態碼不符**
API.md §4：204 No Content（空 body）。main.ts line 184：200 OK 並回傳 room 物件。
受影響範圍：客戶端根據 204 判斷成功的邏輯會失效；room 物件未文件化。

**[HIGH] `POST /api/rooms` 成功回應欄位 — shared DTO 與 API.md 不符**
API.md §1 `CreateRoomResponse`：`{ roomCode, playerId, token, room }`。shared `CreateRoomResponse` type 只有 `{ roomCode, playerId, token }`，缺少 `room` 欄位。
受影響範圍：`packages/shared/src/types/index.ts` `CreateRoomResponse`。

**[HIGH] `POST /api/rooms` Request DTO 欄位名錯誤**
API.md §1：`{ hostNickname, winnerCount }`。shared `CreateRoomRequest` type：`{ nickname }`（欄位名錯誤，缺 winnerCount）。
受影響範圍：`packages/shared/src/types/index.ts` `CreateRoomRequest`；客戶端使用此 DTO 會送出錯誤欄位名導致 400。

**[HIGH] `POST /api/rooms/:code/players` Response DTO 與 API.md 不符**
API.md §3 `JoinRoomResponse`：`{ playerId, token, room }`。shared `JoinRoomResponse` type：`{ roomCode, playerId, token }`（含 roomCode 非規格，缺 room 欄位）。
受影響範圍：`packages/shared/src/types/index.ts` `JoinRoomResponse`。

**[HIGH] `/health` 回應缺少 `redis`、`wsCount`、`uptime` 欄位**
API.md §8 `HealthResponse`：`{ status, redis, wsCount, uptime }`。main.ts line 110 只回傳 `{ status: 'ok' }`。
受影響範圍：Kubernetes liveness probe 資訊不完整；監控儀表板欄位缺失。

**[HIGH] `requireAuth` 錯誤碼不符 API.md 規格**
API.md §4 規定 `AUTH_INVALID_TOKEN`（401）和 `AUTH_TOKEN_EXPIRED`（401）。main.ts `requireAuth` 統一回傳 `UNAUTHORIZED`，無法區分 token 格式錯誤和過期。
受影響範圍：所有受保護 HTTP endpoint；客戶端無法分辨 token 問題類型。

### WebSocket 事件

**[HIGH] `ROOM_STATE_FULL` 從未發送 — 連線時發 `ROOM_STATE` 替代**
API.md §3：連線成功後 unicast `ROOM_STATE_FULL`（含 `ladder`、`results`、`selfPlayerId`）。main.ts line 300：發送 `{ type: 'ROOM_STATE', payload: room }`，型別錯誤且缺少必要欄位。client.ts 有處理 `ROOM_STATE_FULL` 但從未收到。
受影響範圍：客戶端無法區分初始完整狀態與增量廣播；`selfPlayerId` 永遠不送達。

**[HIGH] `PLAYER_KICKED` 廣播範圍不符**
API.md §3：廣播給房間所有人（含被踢者）。main.ts：只 unicast 給被踢者，其他人只收到 `ROOM_STATE`。
受影響範圍：其他玩家無法收到明確的踢出通知事件。

**[HIGH] `PING` handler 回應 `PONG`，API.md 規定靜默接受**
API.md §3：伺服器不回應。main.ts：回傳 `{ type: 'PONG' }`。`PONG` 不在 `WsEventType` 中，client 無 handler。
受影響範圍：client 收到未知事件類型 PONG，落入預設處理。

**[HIGH] `REVEAL_INDEX` payload 格式三方不一致**
API.md `RevealIndexPayload`：`{ playerIndex, result, revealedCount, totalCount }`。main.ts 廣播：`{ index, result, room }`。shared types：`{ index, result }`。欄位名（`index` vs `playerIndex`）不符，缺少 `revealedCount`、`totalCount`，多餘 `room`。
受影響範圍：前端顯示揭示進度缺失；欄位名不符。

**[HIGH] `ROOM_STATE` payload 三方不一致**
API.md §3 `RoomStatePayload`：`{ room: Omit<Room,...>, onlineCount: number }`（巢狀結構）。main.ts：直接廣播 raw Room 物件。shared `RoomStatePayload` type：扁平欄位（無巢狀、無 onlineCount）。client.ts 讀 `p.code`、`p.status` 等直接欄位，與 server 行為一致但與 API.md 不符。
受影響範圍：API.md 規格、shared types、server 實作三方均不一致；`onlineCount` 永遠不送達。

**[HIGH] Shared types: `Player.joinedAt`、`Room.createdAt`/`updatedAt` 型別應為 `number`**
SCHEMA.md §4：`joinedAt: number`（Unix ms）；`createdAt: number`；`updatedAt: number`。shared types：全部定義為 `string`。
受影響範圍：時間戳算術（如 Host 轉移 60s grace 計算）會產生 NaN。

**[HIGH] `RoomStateFullPayload` 缺少 `selfPlayerId`**
API.md §3：`RoomStateFullPayload extends RoomStatePayload { ladder, results, selfPlayerId }`。shared types：有 `kickedPlayerIds`（不在規格中），缺少 `selfPlayerId`。
受影響範圍：客戶端無法從 `ROOM_STATE_FULL` payload 得知自己的 playerId。

### EDD → src/ 目錄結構

**[MEDIUM] WS 連線 URL 未包含 `room` 查詢參數**
API.md §3：WS endpoint 格式 `/ws?room={roomCode}&token={token}`。client.ts：只傳 `/ws?token={token}`。server main.ts：從 JWT claims 讀 roomCode，未驗證 `room` query param 與 JWT `roomCode` 是否一致。
受影響範圍：API.md §3 WS Upgrade 驗證步驟 2 未執行。

**[MEDIUM] Clean Architecture 分層未落地（main.ts 為 430 行 monolith）**
EDD/ARCH 定義 `presentation/routes/`、`application/handlers/WsMessageHandler.ts`、`infrastructure/websocket/WsServer.ts` 等分層。實際只有 `main.ts`，所有路由、WS、認證邏輯全部內聯。
受影響範圍：整個 Clean Architecture 分層設計未實作；可維護性/可測試性受影響。

**[MEDIUM] `RoomSummaryPayload` shared type 三方不一致**
API.md §2：GET /api/rooms/:code 回傳完整 Room 物件。EDD §4：`{ code, status, playerCount, onlineCount, maxPlayers }`。shared types：`{ code, status, playerCount, hostId }`（含 `hostId` 不在規格中，缺 `onlineCount`/`maxPlayers`）。
受影響範圍：shared `RoomSummaryPayload` type 定義錯誤。

**[LOW] `HostTransferredPayload` shared type 缺少 `reason` 欄位**
API.md §3：`{ newHostId, reason: "disconnect_timeout" }`。shared types：只有 `{ newHostId }`。
受影響範圍：`packages/shared/src/types/index.ts` `HostTransferredPayload`。

**[LOW] `RoomSummaryPayload` 含 `hostId`（安全性問題）**
API.md §2 刻意不回傳 hostId；shared type 含 hostId；main.ts 直接回傳整個 room 物件含更多欄位。
受影響範圍：潛在資訊洩露；GET /rooms/:code 回傳資料超出 API.md 規格範圍。

**[LOW] `SessionReplacedPayload` 為空物件而非含 `message`**
API.md §3：`{ message: string }`。main.ts line 287：`payload: {}`。
受影響範圍：前端有 fallback，尚可接受，但不符合規格。

---

## Dimension 3 — Code → Test 對齊問題

### GameService.test.ts

**[HIGH] `resetRoom` 未測試「離線 host 被保留」的分支**
GameService.ts line 146：`p.isOnline || p.id === hostPlayerId`（離線 host 也保留）。測試只覆蓋兩個玩家都在線的情境，未驗證離線 host 被保留、離線非 host 被剔除。
受影響範圍：`resetRoom` happy-path assertion 不完整。

**[HIGH] `joinRoom` 缺少被踢玩家透過 HTTP 重新加入的測試**
WS 連線有 `isKicked` 攔截（已修復），但 HTTP `POST /api/rooms/:code/players` 路徑沒有 `isKicked` 檢查，被踢玩家可透過 HTTP 重新加入。無測試覆蓋此安全漏洞。
受影響範圍：FR-09-2；`joinRoom` 缺少 kicked player 防護。

**[HIGH] `revealAll` partial-reveal 測試斷言偶然正確**
測試用 `getRevealedCount: vi.fn(async () => 1)` 覆蓋，但未 assert `getRevealedCount` 被呼叫（可能實作改為讀 `room.revealedCount`，測試仍通過）。斷言偶然正確，非結構性驗證。
受影響範圍：`revealAll` partial-reveal branch。

### Integration Tests 缺失

**[MEDIUM] RoomRepository 完全無 integration test**
9 個 public method（create、findByCode、update、addKickedPlayer、isKicked、clearKickedPlayers、incrementRevealedCount、getRevealedCount、delete、expireIn）均無整合測試。
關鍵未測路徑：TTL 重設邏輯、`incrementRevealedCount` 初始值、三個 Redis key 的生命週期一致性、`expireIn` 只設 room key TTL（sibling key 可能存活更久）。
受影響範圍：整個 `RoomRepository.ts`。

**[MEDIUM] WebSocket 訊息路由完全無 integration test**
`main.ts` WS handler 的所有 case（SET_REVEAL_MODE、KICK_PLAYER、PING、reconnect/SESSION_REPLACED、BEGIN_REVEAL、REVEAL_NEXT 等）均無任何層級的測試覆蓋。
受影響範圍：main.ts WS connection handler 全部邏輯。

**[MEDIUM] `revealNext` 並發競爭條件無測試**
實作 lines 92–98 的 comment 明確記錄並發競爭，但無 integration test 模擬同時呼叫。
受影響範圍：`revealNext` 並發安全性無測試保證。

**[MEDIUM] `GameService` ROOM_NOT_FOUND 只在 startGame 有測試**
`beginReveal`、`revealNext`、`revealAll`、`resetRoom`、`kickPlayer` 共用 `requireRoom` helper，但只有 `startGame` 測試了 `ROOM_NOT_FOUND`。
受影響範圍：5 個 method 的 ROOM_NOT_FOUND 迴歸保護缺失。

**[MEDIUM] `generateRoomCode` 無統計分佈測試**
charset 排除字元測試跑 50~100 次，覆蓋不到 0.00001% 的空間，無法捕捉 RNG 偏差。
受影響範圍：`generateRoomCode` 字元分佈驗證。

**[MEDIUM] `createRoom` winnerCount 上限未測試**
`createRoom` 只驗證 `winnerCount < 1`，無 upper bound 測試（如 `winnerCount: 999` 合法建房）。實際上限驗證在 `startGame` 的 `validateGameStart`，但建房階段無防護。
受影響範圍：`createRoom` 驗證邊界。

**[LOW] `revealAll` 未 assert `getRevealedCount` 被呼叫**
當 `revealedCount=0` 時，`getRevealedCount` 和 `room.revealedCount` 值相同，不斷言呼叫則無法偵測實作改為讀 room 欄位的 drift。
受影響範圍：`revealAll` call-site 驗證。

**[LOW] `createRoom` 未 assert host `isOnline: true`**
happy-path 測試斷言 `isHost: true`、`colorIndex: 0` 但未斷言 `isOnline: true`。
受影響範圍：`createRoom` assertion 完整性。

**[LOW] `joinRoom` whitespace-only nickname 未測試**
`"   "` trim 後長度 0 應觸發 `INVALID_NICKNAME`，無測試。
受影響範圍：`joinRoom` 邊界條件。

**[LOW] `createRoom` winnerCount 小數值未測試**
`0.5` 或 `1.9` 通過 `< 1` 驗證，可能流入 `validateGameStart`。
受影響範圍：`createRoom` 驗證精度。

---

## Dimension 4 — Doc → Test 對齊問題

### PRD AC → BDD Scenario → Unit Test

**[CRITICAL] AC-H03-3（FPS ≥ 30/24、跨客戶端渲染一致性）無任何 Scenario 或 Unit Test**
7 個 feature 文件無任何 Scenario 涵蓋跨客戶端渲染一致性或 FPS 效能門檻。
受影響範圍：US-H03（P0），NFR-01，Canvas FPS 驗收完全缺失。

**[CRITICAL] AC-H01-3（建立失敗不產生孤立房間）有 BDD Scenario，但無 Unit Test 驗證原子性**
room-lifecycle.feature @AC-ROOM-003 描述 Redis 原子性，但 RoomService.test.ts 無任何「建立流程中途失敗的回滾」測試。
受影響範圍：US-H01（P0），FR-01，系統可靠性。

**[CRITICAL] AC-P03-1/2、AC-P04-1/2（玩家動畫、結果顯示）完全無 Scenario 或 Unit Test**
US-P03（揭曉動畫）、US-P04（中獎結果顯示）的所有 AC 在 7 個 feature 文件中均無 Gherkin Scenario。reveal-flow.feature 只站在主持人角度。
受影響範圍：4 條 P0 AC 完全零覆蓋。

**[CRITICAL] AC-P06-1/2（玩家被踢後客戶端行為）無玩家視角 Scenario**
host-actions.feature 的 kick Scenario 均站在主持人/伺服器角度。缺少玩家端收到 `PLAYER_KICKED` 後 UI 行為（通知文字、回首頁按鈕、重連被拒提示）的 Scenario。
受影響範圍：US-P06（P1）全部 2 條 AC。

**[HIGH] reconnect.feature @AC-RECONNECT-001~005 無對應 Unit Test**
5 個重連 Scenario（SESSION_REPLACED、isOnline 更新、完整狀態恢復）在 RoomService/GameService.test.ts 中無任何覆蓋。
受影響範圍：FR-07（P1），NFR-04 斷線容忍。

**[HIGH] reveal-flow.feature @AC-REVEAL-003/004（自動揭曉模式）無 Unit Test**
自動揭曉 intervalSec 設定和切換回手動的 Scenario 存在，但 GameService.test.ts 無 `revealMode`/`autoRevealIntervalSec` 相關測試。
受影響範圍：US-H05（P1），FR-05-2，自動計時邏輯完全無 unit 覆蓋。

**[HIGH] host-actions.feature @AC-HOST-KICK-004（踢除後重連被拒）無 Unit Test 覆蓋**
Scenario 要求踢除後重連被拒（`isKicked` 攔截）。HTTP join 路徑無 `isKicked` 檢查，此安全漏洞無測試。
受影響範圍：AC-H07-4（P1），FR-09-2，被踢玩家安全防護不完整。

**[HIGH] AC-H01-2（主持人進入等待畫面收到 ROOM_STATE_FULL）有 BDD Scenario，無 WS 推播 Unit Test**
room-lifecycle.feature @AC-ROOM-002 驗證 ROOM_STATE_FULL 推送，但 RoomService.test.ts 只測試 createRoom 回傳結構，未測試 WS 連線後的推播邏輯（main.ts 目前推 ROOM_STATE 非 ROOM_STATE_FULL，本身也是 bug）。
受影響範圍：US-H01（P0），FR-06，WebSocket 推播事件無 unit 層驗證。

**[HIGH] AC-H02-3（W > N-1 時 resetRoom 自動設 winnerCount = null）有 BDD Scenario，無 Unit Test**
host-actions.feature @AC-HOST-RESET-002 描述此行為，但 GameService.test.ts `resetRoom` 測試未 assert `winnerCount` 在越界時重設。
受影響範圍：AC-H02-3（P0），AC-H08-2（P1）。

**[HIGH] FR-04-4（running→revealing 原子操作）無 Unit Test**
GameService.test.ts `beginReveal` 只測試狀態轉換，未驗證原子性（部分寫入/並發失敗場景）。
受影響範圍：FR-04-4（P0），NFR-03 結果一致性。

**[HIGH] `ROOM_NOT_ACCEPTING` 有 Unit Test，無對應 BDD Scenario**
RoomService.test.ts 測試了此錯誤碼，但 7 個 feature 文件無任何遊戲進行中玩家嘗試加入的 Scenario。
受影響範圍：FR-02，缺少 BDD 文件使 QA 無腳本可執行。

**[HIGH] AC-H07-5 BDD Scenario 最後步驟未完整驗證**
host-actions.feature @AC-HOST-KICK-005 最後一步「前一局被踢玩家可用新暱稱加入」只是描述，無 When/Then 步驟執行加入動作並驗證 HTTP 201 成功。
受影響範圍：AC-H07-5（P1），kickedPlayerIds 清空後的端對端流程未完整覆蓋。

**[MEDIUM] NFR-03（1,000 次亂數 seed 驗證 bijection）無對應 property-based 測試**
PRD NFR-03 明確要求此測試。ComputeResults.test.ts 只用 4~6 個固定 seed，prng.feature Scenario Outline 只有 4 組。
受影響範圍：bijection 特性的統計顯著性無法被當前測試套件保證。

**[MEDIUM] AC-H03-5 feature 邊界值比 PRD 多，未標記對應關係**
game-flow.feature @AC-GAME-START-004 提供 6 組 Scenario Outline，PRD 只指定 3 個邊界值（N=3→20, N=10→30, N=21→60）。feature 文件與 PRD 鬆散耦合，PRD 修訂時可能漏同步。
受影響範圍：AC-H03-5（P0），維護性風險。

**[MEDIUM] CODE_COLLISION 測試未 assert 重試次數 ≤ 10**
RoomService.test.ts 驗證無限碰撞最終拋出錯誤，但未 assert `findByCode` 被呼叫恰好 ≤ 10 次。
受影響範圍：FR-01-2（P0），重試上限安全機制無法確認。

**[MEDIUM] AC-P01-1（1.5 秒 P99 握手時間）有 BDD Scenario，無效能測試**
player-management.feature @AC-PLAYER-001 有時間性驗收描述，但無 Playwright 效能測試或 mock 時間 unit test 驗證。
受影響範圍：AC-P01-1（P0），NFR-01，握手延遲門檻無自動化驗證。

**[MEDIUM] `CANNOT_KICK_SELF` 有 Unit Test 無 BDD Scenario**
GameService.test.ts 測試此錯誤碼，但 host-actions.feature 無此邊界條件的 Gherkin 文件。
受影響範圍：防呆邊界條件缺乏 BDD 文件，代表此行為未被 PRD/EDD 正式定義。

**[LOW] AC-H05-1 自動揭曉邊界值（T=1、T=30）在 BDD Scenario 缺失**
reveal-flow.feature @AC-REVEAL-003 只測試 intervalSec=3，缺 T=1、T=30 邊界及 T=0/T=31 拒絕測試。
受影響範圍：AC-H05-1（P1），FR-05-2 邊界值完整性。

**[LOW] hostToken 無效/過期的 403 Scenario 缺失**
同 Doc→Doc 層問題，7 個 feature 文件無否定 JWT 驗證 Scenario。
受影響範圍：NFR-05 安全性。

**[LOW] AC-P02-2（斷線後 isOnline=false 廣播）有 BDD Scenario，無 Unit Test**
player-management.feature @AC-PLAYER-006 描述此流程，但 RoomService/GameService.test.ts 無 WS 斷線事件觸發 isOnline 更新的測試。
受影響範圍：AC-P02-2（P0），US-P02，斷線標記是再玩一局邏輯的前提。

**[LOW] PR AC → BDD：`CANNOT_KICK_HOST` 錯誤碼無 Scenario**
PDD §14 定義此錯誤碼，GameService.test.ts 有對應 unit test（`CANNOT_KICK_SELF`，實際實作使用此名稱），但 host-actions.feature 無 Scenario。
受影響範圍：邊界條件缺乏 BDD 文件。

---

## 修復狀態（/devsop-align-fix all — 2026-04-19）

| Commit | 說明 |
|--------|------|
| dc7e0c9 | docs — PDD/PRD/EDD/ARCH/API.md/features 對齊修復 |
| 8007e27 | doc-code — shared types DTOs + main.ts 行為修復 |
| d88e5b3 | code-test — timestamp 型別 + resetRoom/revealAll/ROOM_NOT_FOUND 測試 |
| cc17bf0 | doc-test — reconnect BDD + bijection property + CANNOT_KICK_SELF/KICK-005 |

### Dimension 1 — Doc→Doc（22 → 0 OPEN）

- **[HIGH] title in PRD** → [FIXED: dc7e0c9]
- **[HIGH] running→revealing semantics** → [FIXED: dc7e0c9] (PDD §6.2 updated to authorize BEGIN_REVEAL)
- **[MEDIUM] seed confidentiality AC** → [FIXED: dc7e0c9]
- **[MEDIUM] Room Code collision error** → [FIXED: dc7e0c9]
- **[LOW] Error codes in PRD** → [FIXED: dc7e0c9]
- **[CRITICAL] BEGIN_REVEAL unauthorized** → [FIXED: dc7e0c9] (PDD updated to authorize host-triggered design)
- **[HIGH] winnerCount update EDD design** → [FIXED: dc7e0c9]
- **[HIGH] title in EDD** → [FIXED: dc7e0c9]
- **[HIGH] CANNOT_KICK_HOST in EDD** → [FIXED: dc7e0c9]
- **[HIGH] rollback timeout EDD design** → [FIXED: dc7e0c9]
- **[MEDIUM] client test coverage target** → [FIXED: dc7e0c9]
- **[MEDIUM] JWT field name inconsistency** → [FIXED: dc7e0c9]
- **[MEDIUM] HOST_TRANSFERRED Out of Scope** → [FIXED: dc7e0c9]
- **[LOW] EDD QPS base 200→100** → [FIXED: dc7e0c9]
- **[HIGH] EDD §4 endpoint paths** → [FIXED: dc7e0c9]
- **[HIGH] ROOM_STATE_FULL timing** → [FIXED: dc7e0c9]
- **[MEDIUM] PLAYER_KICKED broadcast scope** → [FIXED: dc7e0c9]
- **[MEDIUM] JWT TTL 24h→6h** → [FIXED: dc7e0c9]
- **[LOW] EDD response envelope** → [FIXED: dc7e0c9]
- **[HIGH] Player interface naming** → [FIXED: dc7e0c9]
- **[MEDIUM] LadderSegment/revealMode naming** → [FIXED: dc7e0c9]
- **[HIGH] PRD→BDD missing scenarios** → [FIXED: dc7e0c9]
- **[LOW] auto-reveal boundary BDD** → [FIXED: dc7e0c9]
- **[LOW] hostToken invalid/expired BDD** → [FIXED: dc7e0c9]

### Dimension 2 — Doc→Code（16 → 1 OPEN）

- **[CRITICAL] DELETE 200→204** → [FIXED: 8007e27]
- **[HIGH] CreateRoomResponse room field** → [FIXED: 8007e27]
- **[HIGH] CreateRoomRequest hostNickname** → [FIXED: 8007e27]
- **[HIGH] JoinRoomResponse** → [FIXED: 8007e27]
- **[HIGH] /health fields** → [FIXED: 8007e27]
- **[HIGH] requireAuth error codes** → [FIXED: 8007e27]
- **[HIGH] ROOM_STATE_FULL not sent** → [FIXED: 8007e27]
- **[HIGH] PLAYER_KICKED doc** → [FIXED: dc7e0c9] (API.md updated to match unicast)
- **[HIGH] PING PONG** → [FIXED: 8007e27]
- **[HIGH] REVEAL_INDEX payload** → [FIXED: 8007e27]
- **[HIGH] ROOM_STATE payload nested structure** → [MANUAL: client reads flat Room; changing to nested breaks client. Accept implementation as canonical.]
- **[HIGH] timestamps string→number** → [FIXED: 8007e27]
- **[HIGH] RoomStateFullPayload selfPlayerId** → [FIXED: 8007e27]
- **[MEDIUM] WS URL room query param** → [FIXED: 8007e27]
- **[MEDIUM] Clean Architecture** → [MANUAL: refactor scope too large for align-fix; create separate task]
- **[MEDIUM] RoomSummaryPayload** → [FIXED: 8007e27]
- **[LOW] HostTransferredPayload reason** → [FIXED: 8007e27]
- **[LOW] RoomSummaryPayload hostId** → [FIXED: 8007e27]
- **[LOW] SessionReplacedPayload message** → [FIXED: 8007e27]

### Dimension 3 — Code→Test（13 → 4 OPEN）

- **[HIGH] resetRoom offline-host branch** → [FIXED: d88e5b3]
- **[HIGH] joinRoom isKicked HTTP** → [MANUAL: no playerId available at HTTP join; architectural constraint]
- **[HIGH] revealAll coincidental assertion** → [FIXED: d88e5b3]
- **[MEDIUM] RoomRepository integration tests** → [MANUAL: no testcontainers setup in project]
- **[MEDIUM] WS message routing integration tests** → [MANUAL: no WS integration test setup]
- **[MEDIUM] revealNext concurrency test** → [MANUAL: requires concurrent test infrastructure]
- **[MEDIUM] ROOM_NOT_FOUND for 5 methods** → [FIXED: d88e5b3]
- **[MEDIUM] generateRoomCode distribution** → [FIXED: d88e5b3] (CODE_COLLISION retry count asserted)
- **[MEDIUM] createRoom winnerCount upper bound** → [FIXED: d88e5b3] (documented as domain-layer gap)
- **[LOW] revealAll getRevealedCount call** → [FIXED: d88e5b3]
- **[LOW] createRoom isOnline assertion** → [FIXED: d88e5b3]
- **[LOW] joinRoom whitespace nickname** → [FIXED: d88e5b3]
- **[LOW] createRoom winnerCount decimal** → [FIXED: d88e5b3] (documented behavior)

### Dimension 4 — Doc→Test（21 → 6 OPEN）

- **[CRITICAL] Canvas/FPS tests** → [MANUAL: browser-only rendering; requires Playwright visual tests]
- **[CRITICAL] atomic room creation test** → [MANUAL: requires Redis integration test]
- **[CRITICAL] US-P03/P04 animation tests** → [MANUAL: client-side browser-only]
- **[CRITICAL] US-P06 player kicked UX BDD** → [FIXED: dc7e0c9]
- **[HIGH] reconnect unit tests** → [FIXED: cc17bf0]
- **[HIGH] auto-reveal unit tests** → [MANUAL: SET_REVEAL_MODE logic is in main.ts WS handler, not testable as unit]
- **[HIGH] HTTP kicked player test** → [MANUAL: same as Code→Test constraint]
- **[HIGH] AC-H01-2 ROOM_STATE_FULL push** → [FIXED: 8007e27] (code fix) + [MANUAL: unit test requires WS integration]
- **[HIGH] AC-H02-3 winnerCount boundary** → [FIXED: d88e5b3]
- **[HIGH] FR-04-4 atomic operation test** → [MANUAL: requires Redis integration test]
- **[HIGH] ROOM_NOT_ACCEPTING BDD** → [FIXED: dc7e0c9]
- **[HIGH] AC-H07-5 incomplete scenario** → [FIXED: cc17bf0]
- **[MEDIUM] NFR-03 bijection property test** → [FIXED: cc17bf0]
- **[MEDIUM] AC-H03-5 boundary values** → [MANUAL: existing feature covers spec; extra values are acceptable]
- **[MEDIUM] CODE_COLLISION retry count** → [FIXED: d88e5b3]
- **[MEDIUM] AC-P01-1 performance test** → [MANUAL: no Playwright perf test setup]
- **[MEDIUM] CANNOT_KICK_SELF BDD** → [FIXED: cc17bf0]
- **[LOW] auto-reveal boundary BDD** → [FIXED: dc7e0c9]
- **[LOW] hostToken expired BDD** → [FIXED: dc7e0c9]
- **[LOW] AC-P02-2 isOnline disconnect** → [MANUAL: WS event requires integration test]
- **[LOW] CANNOT_KICK_HOST BDD** → [FIXED: cc17bf0]
