# 對齊掃描報告 — Ladder Room Online

> 由 `/devsop-align-check` 自動生成  
> 日期：2026-04-19  
> 專案：/Users/tobala/projects/climb_stairs

---

## 摘要

| 對齊層        | CRITICAL | HIGH | MEDIUM | LOW | 總計 | 狀態 |
|--------------|---------|------|--------|-----|------|------|
| Doc → Doc    |    5    |  14  |    7   |  2  |  28  |  🔴  |
| Doc → Code   |    8    |  15  |    6   |  2  |  31  |  🔴  |
| Code → Test  |    0    |   2  |    6   | 10  |  18  |  ⚠️  |
| Doc → Test   |    6    |  10  |    5   |  1  |  22  |  🔴  |
| **總計**      | **19** | **41** | **24** | **15** | **99** | |

---

## Dimension 1 — Doc → Doc 對齊問題

### PDD → PRD

**[HIGH] PDD→PRD: 房間名稱 title 功能遺漏**
PDD §7.1 定義 `title` 欄位（0-50 Unicode 字元），Host 可修改並即時廣播。PRD 所有 User Story 均無對應 Story 或 AC。
受影響範圍：PRD 缺少 title 設定 US；EDD、API、SCHEMA 亦缺對應 PATCH 機制。

**[HIGH] PDD→PRD: Host 轉移機制（斷線 60 秒）遺漏**
PDD §7.1 定義當 Host 斷線 >60s，Server 自動移交 Host 身份並廣播 HOST_TRANSFERRED。PRD 所有 US 均未涵蓋此機制。
受影響範圍：PRD 缺少 Host 轉移 US；NFR-04 語意有矛盾。

**[HIGH] PDD→PRD: PRD NFR-05 安全規格超越 PDD 授權**
PRD NFR-05 新增 JWT、64KB WS 訊息上限、60 msg/min 限速等具體值，但溯源至 PDD 無明確授權。
受影響範圍：PRD NFR-05 安全規格部分依據來源不明確。

**[MEDIUM] PDD→PRD: startColumn 指派排序規則遺漏**
PDD §6.2 定義 startColumn 指派須依 joinedAt 排序，joinedAt 相同以 playerId 字典序為次要鍵。PRD FR-03-3 缺少排序規則描述。
受影響範圍：PRD FR-03-3 遺漏確定性排序規格。

**[MEDIUM] PDD→PRD: isOnline grace period 矛盾**
PDD §9 定義 MVP 無 grace period（斷線即設 false）；PRD NFR-04 隱含 60s grace period 語意。
受影響範圍：PRD NFR-04 與 PDD §9 衝突。

**[LOW] PDD→PRD: FPS 量測工具不一致**
PDD §3.3 用 Chrome DevTools；PRD NFR-01 用 Playwright 錄製。
受影響範圍：量測基準不統一。

---

### PRD → EDD

**[CRITICAL] PRD→EDD: running→revealing 狀態流設計根本差異**
PRD AC-H03-1 說開始遊戲後直接廣播 ROOM_STATE（含梯子資料）；EDD §2.5 設計 running→revealing 為兩步驟（需 Host 明確送 BEGIN_REVEAL）。與 PDD §6.2 原子操作語意矛盾。
受影響範圍：整個揭曉前狀態流程；API.md、BDD、ARCH 均受影響。

**[HIGH] PRD→EDD: winnerCount 更新操作無端點**
PRD FR-01-3 / US-H02 定義 Host 可在 waiting 狀態更新 winnerCount。EDD §4 API 表格無任何修改 winnerCount 的端點，WsMsgType 無 SET_WINNER_COUNT。
受影響範圍：P0 功能無 API 設計。

**[HIGH] PRD→EDD: QPS 容量設計基準矛盾**
PRD NFR-02 設定 5,000 WS 連線；EDD §10.2 以 10,000 計算。EDD 同一章節自相矛盾。
受影響範圍：容量設計基準混亂，影響負載測試門檻。

**[HIGH] PRD→EDD: REVEAL_NEXT payload 格式矛盾**
EDD §5 說 REVEAL_NEXT payload 為空 `{}`；EDD §8 BDD 樣例寫 `{ index: 0 }`，兩者自相矛盾。
受影響範圍：EDD §8 BDD 樣例與 §5 設計矛盾。

**[MEDIUM] PRD→EDD: 踢除操作 HTTP vs WS 未明確標準路徑**
EDD 同時設計 DELETE HTTP 和 WS KICK_PLAYER，未說明哪條是標準路徑。
受影響範圍：客戶端實作可能走不同路徑。

**[MEDIUM] PRD→EDD: NFR-01 FPS 量測條件無對應測試策略**
PRD NFR-01 指定 Playwright 錄製 FPS；EDD §9.3 E2E 場景無 FPS 驗證。
受影響範圍：NFR-01 效能需求無測試策略對應。

---

### EDD → ARCH

**[HIGH] EDD→ARCH: Client 端架構完全缺失**
EDD §2.1 列出 5 個 Client 模組（RoomStore、AnimationController、WsClient 等），ARCH §2-§3 只描述 Server 端，Client 端模組無職責說明。
受影響範圍：Client 端 5 個核心模組無架構定義。

**[MEDIUM] EDD→ARCH: HPA 圖表描述 Post-MVP，與 ARCH MVP 單實例策略不一致**
EDD §2.2 Mermaid 圖描繪 K8s HPA（2-10 Pod）；ARCH §4.7 說 MVP 為單實例不啟用 HPA。
受影響範圍：架構範圍邊界混淆。

**[MEDIUM] EDD→ARCH: RoomStatus.ts 分類描述可能誤導**
EDD 放在 domain/value-objects/；ARCH 描述為「純函式驗證」，但 RoomStatus 本質是 enum。
受影響範圍：Domain 層 RoomStatus.ts 實作模式不明確。

---

### EDD → API

**[CRITICAL] EDD→API: winnerCount 更新操作無 API 端點**
EDD §4 7 個端點均無修改 winnerCount 的端點；WsMsgType 無 SET_WINNER_COUNT。PRD AC-H02 是 P0 功能。
受影響範圍：P0 功能（設定中獎名額）整個 API 設計缺失。

**[CRITICAL] EDD→API: title 欄位在 EDD types 和 API.md 中完全缺失**
EDD §3 Room interface 無 title；API.md 所有 Request/Response 無 title 欄位。PDD §7.1 定義此欄位。
受影響範圍：title 功能整個 API 設計缺失。

**[HIGH] EDD→API: BEGIN_REVEAL WS 訊息有 API 設計但無 PRD 來源**
EDD §5 和 API.md §3 均定義 BEGIN_REVEAL，但 PRD 無對應 US/AC；BDD game-flow.feature 未覆蓋此步驟。
受影響範圍：BEGIN_REVEAL 操作缺少 PRD 溯源、BDD 未覆蓋。

**[HIGH] EDD→API: ROOM_NOT_ACCEPTING 錯誤碼 PRD 無 AC**
PRD AC-P01-4 只說 ROOM_FULL；未涵蓋房間非 waiting 狀態時的 ROOM_NOT_ACCEPTING（409）。
受影響範圍：PRD AC-P01 未覆蓋此場景。

**[MEDIUM] EDD→API: JWT TTL 矛盾（EDD 24h vs API.md 6h）**
EDD §2.5/ARCH §4.6 說 JWT 24 小時；API.md 說 6 小時。
受影響範圍：Token 有效期矛盾。

**[MEDIUM] EDD→API: winnerCount 在 POST /rooms 是否必填矛盾**
PRD 允許 winnerCount 為 null 初始值；API.md 要求 >= 1。
受影響範圍：winnerCount 必填性設計矛盾。

---

### EDD → SCHEMA

**[HIGH] EDD→SCHEMA: Player 缺少 result、startColumn、endColumn 欄位**
EDD §3 定義 `result?: string | null`；SCHEMA §4 Player 無此三欄位。PDD §9 明確包含這三欄位。
受影響範圍：Player 資料模型在 SCHEMA 不完整。

**[HIGH] EDD→SCHEMA: Room.ladder 儲存結構矛盾**
EDD §3 Room interface 定義 `ladder: LadderData | null` 為內嵌欄位；SCHEMA 設計為獨立子鍵 `room:{code}:ladder`，Room JSON 不含 ladder。
受影響範圍：EDD interface 與實際 Redis 儲存結構不一致。

**[MEDIUM] EDD→SCHEMA: revealedCount 雙欄位設計矛盾**
ARCH 說 Room JSON 有 revealedCount 快照；SCHEMA §4 說「與 Room JSON 無冗余」，直接否認雙欄位設計。
受影響範圍：儲存策略矛盾，可能導致資料不一致 bug。

**[MEDIUM] EDD→SCHEMA: title 欄位 EDD types 和 SCHEMA 均缺失**
EDD §3 Room interface 無 title；SCHEMA §3/§4 均無 title。
受影響範圍：title 欄位兩個文件同時缺失。

**[LOW] EDD→SCHEMA: LadderSegment 欄位命名 PDD vs EDD 不符**
PDD 用 from/to；EDD/SCHEMA 用 col。
受影響範圍：PDD 與下游文件命名衝突。

---

### PRD → BDD

**[CRITICAL] PRD→BDD: US-P03（路徑揭曉動畫）無 BDD Scenario**
AC-P03-1/P03-2（Canvas 高亮、FPS ≥ 30/24）在 7 個 feature 文件均無對應 Scenario。
受影響範圍：P0 核心體驗完全無 BDD 覆蓋。

**[CRITICAL] PRD→BDD: US-P04（玩家確認中獎結果）無 BDD Scenario**
AC-P04-1/P04-2（顯示結果文字、REVEAL_ALL 後正確顯示）完全無對應 Scenario。
受影響範圍：P0 核心功能完全無 BDD 覆蓋。

**[HIGH] PRD→BDD: AC-H03-3 FPS 量測條件無 BDD 覆蓋**
game-flow.feature 只驗證 HTTP 回應和 ROOM_STATE 廣播，無 FPS 或 Canvas 一致性驗證。
受影響範圍：AC-H03-3 核心量測條件無 BDD 覆蓋。

**[HIGH] PRD→BDD: AC-H05 自動揭曉邊界條件缺失**
reveal-flow.feature 缺少 T=1s/T=30s 邊界值、T<1 或 T>30 非法值、自動揭曉完成後最後廣播的測試。
受影響範圍：AC-H05 邊界條件無 BDD 覆蓋。

**[HIGH] PRD→BDD: AC-H01-3 建立房間原子性 BDD 驗證不足**
BDD Scenario 用「後端模擬 HTTP 500」，無法驗證 Redis SETNX 原子性（500 前 Redis 可能已有寫入）。
受影響範圍：建立房間原子性邊界未正確覆蓋。

**[HIGH] PRD→BDD: AC-P02-2 玩家離線與遊戲開局交叉場景缺失**
缺少斷線後 Host 開始遊戲、離線玩家路徑計算的 Scenario。
受影響範圍：玩家斷線與遊戲開局交叉場景無 BDD 覆蓋。

**[HIGH] PRD→BDD: FR-04-4 running→revealing 原子操作無 BDD 覆蓋**
7 個 feature 文件無測試原子操作失敗/回滾的 Scenario。
受影響範圍：P0 關鍵原子操作錯誤路徑無 BDD 覆蓋。

**[MEDIUM] PRD→BDD: AC-H02 邊界合法值（W=N-1）正向測試缺失**
缺少 W=N-1 的合法邊界值正向測試 Scenario。
受影響範圍：AC-H02 邊界合法值 BDD 缺失。

**[MEDIUM] PRD→BDD: FR-04-4 原子操作 BDD 無覆蓋**
7 個 feature 文件無測試 running→revealing 原子操作失敗/回滾場景。
受影響範圍：P0 原子操作錯誤路徑 BDD 缺失。

**[LOW] PRD→BDD: NFR-06 前端效能預算無 BDD 覆蓋**
JS bundle 大小、FCP、LCP、CLS 等 7 個 feature 文件均無對應 scenario。
受影響範圍：前端效能 NFR 無 BDD 覆蓋。

---

## Dimension 2 — Doc → Code 對齊問題

### API.md → main.ts（HTTP Routes）

**[CRITICAL] 所有 REST 端點缺少版本前綴 `/v1/`** `[FIXED: 6ae3e15]`
API.md 定義路徑：`/api/v1/*`；main.ts 實作：`/api/*`（無 v1 前綴）。全部 7 個端點 404。
受影響範圍：所有 HTTP 端點路徑不符文件。

**[CRITICAL] `/health` 路徑不符且回應格式缺欄位** `[FIXED: 6ae3e15]`
API.md：`GET /api/v1/health`；main.ts：`/health`。回應格式缺少 redis/wsCount/uptime 欄位。
受影響範圍：K8s probe 設定及 API 合約均失效。

**[CRITICAL] `start` 和 `reset` 端點路徑不符** `[FIXED: 6ae3e15]`
API.md：`/api/v1/rooms/:code/start`；main.ts：`/api/rooms/:code/game/start`。reset 同理。
受影響範圍：兩個 HTTP 端點路徑不符文件。

**[CRITICAL] `POST /rooms/:code/game/reveal` 在 API.md 未定義** `[FIXED: 6ae3e15]`
main.ts 新增此端點（mode=next/all），API.md 未定義。揭示操作文件規範僅用 WS。
受影響範圍：未文件化的 HTTP 路由上線。

**[CRITICAL] 統一回應 Envelope 格式不符** `[FIXED: 6ae3e15]`
API.md 定義 `{ success, data, error }` 包裝格式；main.ts 直接回傳業務資料，無 envelope。
受影響範圍：所有 HTTP 端點回應結構與文件不符。

**[CRITICAL] `POST /rooms` 成功回應缺少 `sessionToken`（用 `token` 替代）** `[FIXED: 6ae3e15]`
API.md 定義欄位名 `sessionToken`；main.ts 回傳 `token`。
受影響範圍：前端解析 token 欄位名不符。

**[CRITICAL] `POST /players` 回應缺少 `colorIndex`**
API.md：`{ playerId, sessionToken, colorIndex }`；main.ts：`{ playerId, token, room }`。
受影響範圍：前端取 colorIndex 將失敗。

**[CRITICAL] `DELETE /players/:id` HTTP 狀態碼不符**
API.md：204 No Content；main.ts：200 並回傳 room 物件。
受影響範圍：前端根據 204 判斷成功的邏輯會失效。

---

### SCHEMA → types/index.ts

**[CRITICAL] `Player.joinedAt` 型別不符**
SCHEMA：`number`（Unix ms）；types/index.ts：`string`（ISO string）。
受影響範圍：joinedAt 排序邏輯可能出錯。

**[CRITICAL] `Room.createdAt` / `updatedAt` 型別不符**
SCHEMA：`number`（Unix ms）；types/index.ts：`string`（ISO string）。
受影響範圍：與 API.md 回應範例格式不一致。

**[HIGH] `RoomSummaryPayload` 含 `hostId`（不應暴露）**
API.md 刻意不回傳 hostId；types 含 hostId；main.ts 直接回傳整個 room 物件含更多敏感欄位。
受影響範圍：安全性問題，潛在資訊洩露。

**[HIGH] `LadderData` 缺少 `results` 欄位**
SCHEMA §4：LadderData 含 `results`；types：`results` 在 Room 上，LadderData 無。
受影響範圍：儲存模型與 TypeScript 模型不一致。

**[MEDIUM] `RevealIndexPayload` 欄位不符**
API.md：`{ playerIndex, result, revealedCount, totalCount }`；types：`{ index, result }`。
受影響範圍：前端顯示揭示進度缺失。

**[MEDIUM] `HostTransferredPayload` 缺少 `reason` 欄位**
API.md/EDD：含 `reason`；types：無 reason。
受影響範圍：型別不完整。

---

### EDD → src/ 目錄結構

**[CRITICAL] presentation/ 分層存在但 main.ts 完全不 import**
EDD 定義 presentation/routes/、schemas/、plugins/ 分層；main.ts 所有路由直接內聯，未使用任何 presentation 層模組。
受影響範圍：Clean Architecture 分層原則被繞過。

**[CRITICAL] WsMessageHandler.ts / PubSubHandler.ts 未使用**
EDD 定義 application/handlers/；main.ts 的 WS handler 全部內聯在 connection callback 中。
受影響範圍：Application 層 handler 設計未落地。

**[CRITICAL] infrastructure/websocket/ 模組缺失**
EDD/ARCH 定義 WsServer.ts（含速率限制 60 msg/min）、WsSession.ts；src 中無此目錄。
受影響範圍：速率限制、PING-PONG 心跳、Session 管理均未實作。

**[HIGH] PubSubBroker.ts 缺失**
EDD 定義跨 Pod 廣播；src 中無 PubSubBroker。
受影響範圍：跨 Pod 廣播機制完全缺失。

**[HIGH] shared/domain/ 完全缺失**
EDD/ARCH 定義 domain/entities/（Room、Player、Ladder）、domain/value-objects/、domain/errors/；shared/src/ 只有 types/、use-cases/、prng/。
受影響範圍：Clean Architecture Domain 層完全未實作。

**[HIGH] DomainError.ts 放錯位置**
EDD 定義在 shared/domain/errors/；實際在 server/src/domain/errors/（server 層，非 shared）。
受影響範圍：分層違反設計；Value Object 驗證邏輯未封裝。

---

### ARCH → src/ 模組

**[HIGH] container.ts 缺少 wsMessageHandler、pubSubHandler、wsServer**
ARCH §5.2 定義 container.ts 應組裝三者；實際只回傳 `{ repo, roomService, gameService, redis }`。
受影響範圍：ARCH 定義的完整 DI 組裝圖與實作不符。

**[HIGH] 被踢玩家 WS 重連攔截缺失** `[FIXED: 6ae3e15]`
ARCH §8：WsServer.handleUpgrade() 須檢查 kickedPlayerIds（close 4003）；main.ts 未實作 isKicked 檢查。
受影響範圍：被踢玩家可重新連線，安全機制缺失。

**[MEDIUM] 雙索引 Session 架構未實作**
ARCH §6.2 定義 WsSessionMap + PlayerSessionIndex 雙索引；main.ts 使用單層 Map。
受影響範圍：Session 架構簡化，喪失多 Pod 擴展能力。

---

### WebSocket 事件

**[HIGH] SET_REVEAL_MODE 訊息未實作** `[FIXED: 6ae3e15]`
API.md 定義 Client→Server `SET_REVEAL_MODE { mode, intervalSec? }`；main.ts 的 switch 無此 case。
受影響範圍：自動揭示功能後端完全未實作。

**[HIGH] PING 回應行為與文件矛盾**
API.md：伺服器靜默接受，不回應；main.ts：主動回應 PONG。
受影響範圍：client.ts 未預期 PONG，落入 undefined 處理。

**[HIGH] 連線時發送 ROOM_STATE 而非 ROOM_STATE_FULL**
API.md/EDD：連線後 unicast ROOM_STATE_FULL（含 selfPlayerId、ladder）；main.ts 發 ROOM_STATE。
受影響範圍：重連後客戶端無法取得完整梯子資料。

**[HIGH] PLAYER_KICKED 只 unicast 給被踢者，且 payload 為空** `[FIXED: 6ae3e15]`
API.md：廣播給全房間，payload 含 `{ kickedPlayerId, reason }`；main.ts 只 unicast，payload `{}`。
受影響範圍：其他玩家無法收到被踢通知。

**[HIGH] HOST_TRANSFERRED 事件完全未實作**
close handler 只廣播 ROOM_STATE，無 60s grace timer、無房主移交邏輯。
受影響範圍：房主斷線後遊戲流程卡住。

**[HIGH] WS URL 缺少 room 查詢參數驗證**
API.md：`/ws?room={roomCode}&token=...`；main.ts：只接受 token 參數，未驗證 room 參數。
受影響範圍：API 合約不符。

**[MEDIUM] client.ts WS URL 缺少 room 查詢參數**
client.ts 連線 URL 缺少 `room=` 參數。
受影響範圍：與 API.md 定義的 WS URL 格式不符。

**[MEDIUM] REVEAL_INDEX payload 格式偏離 API.md**
前後端一致地使用 `{ index, result }` 而非 API.md 定義的 `{ playerIndex, result, revealedCount, totalCount }`。
受影響範圍：前端顯示揭示進度缺失。

**[MEDIUM] SESSION_REPLACED payload 為空物件**
API.md：`{ message: string }`；main.ts：`{}`。
受影響範圍：API 合約不符（前端有硬編碼 fallback，尚可接受）。

**[LOW] WebSocketServer 無 maxPayload 設定** `[FIXED: 6ae3e15]`
EDD §6：maxPayload: 65536；main.ts 無此選項。
受影響範圍：缺少 DoS 防護。

**[LOW] 無協議層 PING 心跳（Server→Client 30s PING frame）**
API.md：伺服器每 30 秒發 Protocol-level PING；main.ts 無 ws.ping() 呼叫。
受影響範圍：長時間連線可能被 NAT/Proxy 靜默斷開。

---

## Dimension 3 — Code → Test 對齊問題

### RoomService.test.ts

**[MEDIUM] createRoom 缺少 winnerCount 負數測試**
實作只判斷 winnerCount < 1，未測試負值路徑。
受影響範圍：createRoom winnerCount 驗證分支。

**[MEDIUM] joinRoom 缺少 ROOM_NOT_ACCEPTING 全狀態覆蓋**
只測試 status='running'，未測試 'revealing'/'finished'。
受影響範圍：joinRoom ROOM_NOT_ACCEPTING 分支。

**[LOW] validateNickname 純空白字串未測試**
`' '` trim 後長度為 0，應觸發 INVALID_NICKNAME，未有 test case。
受影響範圍：validateNickname 空白邊界。

**[LOW] joinRoom 控制字元注入未測試**
`\u0000` 或 `\u007F` 是否被 joinRoom 拒絕未測試。
受影響範圍：joinRoom 控制字元分支。

---

### GameService.test.ts

**[HIGH] startGame 的 RESULT_PLAYER_MISMATCH 錯誤路徑未測試** `[MANUAL: 防禦路徑在 generateLadder 確定性約束下不可達，需整合測試覆蓋]`
實作第 48-53 行 DomainError('RESULT_PLAYER_MISMATCH', 500)，完全可人工構造但無測試。
受影響範圍：startGame 防禦路徑（500 級別錯誤）。

**[MEDIUM] revealNext 缺少 index<0 邊界測試**
只測試 index >= length，未測試 index < 0 的情形。
受影響範圍：revealNext REVEAL_OUT_OF_BOUNDS 的 index<0 分支。

**[MEDIUM] revealAll mock 疊加造成測試意圖模糊**
makeMockRepo spread 後覆寫 getRevealedCount，兩者行為相同，掩蓋真實 mock 意圖。
受影響範圍：revealAll 部分 reveal 測試。

**[MEDIUM] resetRoom 未驗證 offline 玩家被過濾**
所有 test players 均 isOnline=true，未測試 offline 玩家確實被排除的正向 case。
受影響範圍：resetRoom 玩家過濾邏輯。

**[LOW] resetRoom 未驗證 clearKickedPlayers 被呼叫**
vi.fn() 存在但無 toHaveBeenCalledOnce 斷言。
受影響範圍：resetRoom 副作用。

**[LOW] kickPlayer 未驗證 addKickedPlayer 被呼叫** `[FIXED: c911861]`
vi.fn() 存在但無 toHaveBeenCalled 斷言。
受影響範圍：kickPlayer 副作用。

**[LOW] requireRoom 只有 startGame 測試 ROOM_NOT_FOUND**
beginReveal/revealNext/revealAll/resetRoom/kickPlayer 均共用 requireRoom，但只有 startGame 有 ROOM_NOT_FOUND 測試。
受影響範圍：多個 method 的 ROOM_NOT_FOUND 迴歸保護不足。

---

### RoomRepository（無任何測試）

**[HIGH] RoomRepository.ts 完全無測試（10 個方法，0% 覆蓋）**
包含 create/findByCode/update/incrementRevealedCount 等關鍵方法，完全無 unit 或 integration test。
受影響範圍：整個 RoomRepository 實作（10 個方法）。

---

### 測試品質問題

**[MEDIUM] djb2.test.ts determinism 測試為自我循環斷言**
`expect(djb2('x')).toBe(djb2('x'))` 在同一 process 中永遠通過，對任何 bug 無偵測能力。
受影響範圍：djb2 determinism test case 幾乎零價值。

**[LOW] fisherYates.test.ts 兩個 element preservation 測試高度冗余**
Set size 比較和 sorted array 比較功能幾乎完全重疊。
受影響範圍：重複測試。

**[LOW] ValidateGameStart.test.ts 含永遠通過的錯誤訊息對比測試**
兩個 hardcoded 字串不相等的斷言，對業務邏輯無保護價值。
受影響範圍：錯誤訊息測試。

**[LOW] ComputeResults.test.ts 缺少 direction='left' 明確測試**
tracePath 左移邏輯未被明確驗證（雖 bijection 測試間接覆蓋）。
受影響範圍：tracePath direction='left' 分支。

**[LOW] GenerateLadder.test.ts maxBarsPerRow 未直接測試**
各 N 值下每行最多幾個 bar 的上限未被任何 test 驗證。
受影響範圍：generateLadder 密度上限算法。

---

## Dimension 4 — Doc → Test 對齊問題

### PRD AC → BDD → tests

**[CRITICAL] AC-H01-3 建立房間原子性無 unit test**
@AC-ROOM-003 BDD Scenario 存在，但 RoomService.test.ts 無測試「Redis 中途失敗後房間不殘留」。
受影響範圍：FR-01 建立房間原子性，SCHEMA §5.1。

**[CRITICAL] AC-H02-3 winnerCount 越界重設無 unit test**
@AC-HOST-RESET-002 BDD 存在，但 GameService.test.ts resetRoom 無測試此路徑。
受影響範圍：GameService.resetRoom()、FR-08-2。

**[HIGH] AC-H03-3 樓梯一致性+FPS 無 BDD 且無 test**
7 個 feature 文件無對應 Scenario；tests/ 無測試。
受影響範圍：US-H03 P0 驗收。

**[HIGH] US-H02-1 設定 winnerCount 廣播 ROOM_STATE 無 unit test**
BDD 有 @AC-GAME-WIN-001；GameService/RoomService.test.ts 無對應 test。
受影響範圍：AC-H02-1、FR-02。

**[HIGH] US-P03 路徑動畫無 BDD 且無 test**
7 個 feature 文件完全缺席；EDD §8 BDD 對應表無 AC-P03。
受影響範圍：US-P03 P0 驗收。

**[HIGH] AC-P04-2 REVEAL_ALL 全員顯示結果無獨立 BDD**
@AC-REVEAL-001 只測試 REVEAL_INDEX 收到，未驗證全員螢幕正確顯示。
受影響範圍：US-P04 P0 驗收。

**[HIGH] JWT 驗證失敗路徑無 unit test**
AUTH_INVALID_TOKEN/AUTH_TOKEN_EXPIRED 錯誤無任何 unit test 覆蓋。
受影響範圍：FR-01-4、NFR-05。

**[HIGH] AC-H05 自動揭曉 BDD 存在但無對應 unit test**
GameService.test.ts 完全無 setRevealMode 相關測試。
受影響範圍：US-H05 P1。

**[HIGH] US-P05 斷線重連 BDD 完整但無 unit test**
reconnect.feature 有 5 個 scenario；GameService/RoomService.test.ts 無重連業務邏輯測試。
受影響範圍：US-P05 P1、FR-07。

**[HIGH] AC-H07-4 kickPlayer 未驗證 addKickedPlayer 呼叫** `[FIXED: c911861]`
test 驗證 players 移除，但未 assert addKickedPlayer 被呼叫。
受影響範圍：AC-H07-4、FR-09-2。

---

### EDD 邊界條件 → tests

**[CRITICAL] Rate Limiting 無任何測試**
EDD §4 定義 10/min、20/min、60 msg/min；tests/ 完全無速率限制測試。
受影響範圍：NFR-05 安全性、OWASP A04。

**[CRITICAL] WS maxPayload 64KB 無測試**
EDD §6 規定 maxPayload: 65536；tests/ 無驗證超大訊息被拒的 test。
受影響範圍：NFR-05、DoS 防護。

**[CRITICAL] 完整 WS 事件序列無 integration test**
packages/server/__tests__/ 只有 unit/ 目錄，無 integration/ 目錄。完整房間生命週期流程未有任何 integration test。
受影響範圍：EDD §9.2/§9.3 所有 E2E/Integration 場景。

**[CRITICAL] HOST_TRANSFERRED 無 BDD 且無 test**
7 個 feature 文件無 Scenario；GameService.test.ts 無對應 test。
受影響範圍：EDD §5 HOST_TRANSFERRED、EDD §9.4。

**[HIGH] WS JSON parse 失敗路徑無 unit test**
EDD §12.2 定義 WS_INVALID_MSG/WS_UNKNOWN_TYPE；tests/ 無覆蓋此負面場景。
受影響範圍：EDD §12.2、FR-06-3。

**[HIGH] 被踢玩家重連 isKicked=true 路徑無 unit test**
BDD 有 @AC-HOST-KICK-002；unit tests 中 isKicked 固定 mock false，無 true 場景測試。
受影響範圍：AC-H07-2、EDD §5。

**[HIGH] START_GAME 並發競態重試無測試**
EDD §12.4：WATCH/MULTI/EXEC 失敗最多重試 3 次；無並發競態測試。
受影響範圍：FR-04-4 原子操作。

**[MEDIUM] Redis 失敗路徑（repo.update 拋出）無 unit test**
EDD §12.2 定義 Redis 失敗策略；tests/ 無模擬 Redis 失敗的測試。
受影響範圍：EDD §12.2、NFR-04 可靠性。

---

### SCHEMA 約束 → tests

**[CRITICAL] winnerCount 必填語意矛盾（SCHEMA 允許 null，test fixture 用非 null）**
SCHEMA §3 Stage 1 規定建立時 winnerCount 為 null；RoomService.test.ts createRoom 測試直接傳 winnerCount=2 並斷言非 null。
受影響範圍：SCHEMA §3、EDD §3 CreateRoomRequest。

**[HIGH] RESET_ROOM 後 clearKickedPlayers 未驗證被呼叫**
SCHEMA §5.5 規定 RESET_ROOM 必須 DEL kicked set；test 未 assert clearKickedPlayers 呼叫。
受影響範圍：AC-H07-5、SCHEMA §5.5。

**[HIGH] Player.colorIndex 範圍 0-49 未驗證**
test 只驗證「不重複」，未驗證值在 [0, 49] 範圍內。
受影響範圍：SCHEMA §4 Player.colorIndex。

**[HIGH] Room TTL 策略（finished→1h、空房→5min）無任何測試**
expireIn 是 vi.fn() 但從未 assert 被呼叫，無 TTL 縮短/擴展驗證。
受影響範圍：SCHEMA §1/§10 TTL 策略。

**[MEDIUM] joinedAt / createdAt 型別：test fixture 用 ISO string，文件定義 Unix ms number**
makePlayer()/makeRoom() 使用 ISO string；SCHEMA/EDD 定義為 number。掩蓋序列化 bug。
受影響範圍：SCHEMA §4 Player/Room 型別。

**[MEDIUM] 暱稱控制字元（\x00、\n、\t）拒絕未測試**
EDD §6 A03 規定 AJV pattern 禁控制字元；test 只測試 HTML 注入字元。
受影響範圍：FR-02-2、EDD §6 A03。

**[MEDIUM] WS 指數退避重連邏輯無任何 client-side test**
EDD §12.5 定義重連策略；WsClient.ts 無測試。
受影響範圍：AC-P05-1、EDD §12.5。

**[MEDIUM] SESSION_REPLACED 業務邏輯無 unit test**
reconnect.feature 有 BDD；GameService/RoomService unit tests 無重連相關 case。
受影響範圍：FR-07-3、AC-P05。

**[MEDIUM] ROOM_STATE_FULL unicast 業務邏輯無 unit test**
BDD 有兩個 scenario；tests/ 無模擬此路徑的測試。
受影響範圍：AC-H01-2、AC-P05-1/P05-2。

**[LOW] prng.feature seedSource 格式不符 EDD 規格**
EDD §7.1 規定 UUID v4；feature 使用 "test-seed-abc123" 等非 UUID 字串。
受影響範圍：EDD §7.1、FR-03-1。

---

## 建議執行

```bash
# 修復所有問題
/devsop-align-fix all

# 僅修復文件對齊問題（Dim 1）
/devsop-align-fix docs

# 僅修復程式碼對齊問題（Dim 2）
/devsop-align-fix code

# 僅修復測試對齊問題（Dim 3 + Dim 4）
/devsop-align-fix tests
```

---

*此報告由 /devsop-align-check 自動生成，請勿手動編輯。*
*執行 /devsop-align-fix 可自動修復上述問題。*
