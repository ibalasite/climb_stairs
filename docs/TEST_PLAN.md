# Test Plan — Ladder Room Online

> Version: v1.0
> Date: 2026-04-21
> Based on: PRD v1.0, EDD v2.0, API v2.1
> Author: AI QA Agent（devsop-autodev STEP-14）

---

## §1 Test Strategy Overview

### §1.1 測試目標

確保 Ladder Room Online 在上線前達到以下品質閘門：

- P0 User Story Happy Path E2E 全數通過
- 後端單元測試覆蓋率 ≥ 80%（Vitest coverage）
- 前端單元測試覆蓋率 ≥ 70%
- shared 套件覆蓋率 ≥ 90%
- 1,000 次 seed 自動化驗證 100% bijection 通過
- k6 壓測：100 房間 × 50 人 WebSocket 並發成功率 ≥ 99.5%
- Lighthouse CI：FCP < 1.5s，LCP < 2.5s，CLS < 0.1
- 現有 171 個 Vitest 通過測試在遷移後全數維持通過

### §1.2 測試層次金字塔

```
           ┌─────────────────────────────┐
           │        E2E (Playwright)      │ 10%
           │  完整遊戲流程 × 多瀏覽器       │
           ├─────────────────────────────┤
           │   Performance (k6/Autocannon)│ 5%
           │   WS 並發壓測 × Lighthouse   │
           ├─────────────────────────────┤
           │  Integration (Vitest+TC)     │ 20%
           │  REST API × WS × Redis 真機  │
           ├─────────────────────────────┤
           │      Unit (Vitest)           │ 65%
           │  純函式 × 狀態機 × UI 邏輯   │
           └─────────────────────────────┘
```

| 層次 | 工具 | 環境 | 目標覆蓋率 |
|------|------|------|-----------|
| Unit | Vitest 1.x | Local（node） | shared ≥ 90%；server ≥ 80%；client ≥ 70% |
| Integration | Vitest + testcontainers | Local（Docker Redis） | 所有 REST + WS 路由 |
| E2E | Playwright 1.x | Local（K8s / Docker Compose） | 所有 P0 User Story Happy Path |
| Performance | k6 / Autocannon / Lighthouse CI | Local（k8s）+ CI | PRD §2.1 KPI 全項 |
| UAT | 手動 + 自動化腳本 | Staging / Local | 所有 PRD User Story AC |

---

## §2 Unit Test Plan

### §2.1 packages/shared

**測試檔案位置：** `packages/shared/src/__tests__/`

#### §2.1.1 PRNG 模組（mulberry32, djb2, fisherYates）

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| djb2 — 已知輸入輸出驗證 | 固定字串 → 固定 uint32（快照測試） | FR-04-1 |
| djb2 — 空字串回傳 5381 | hash 初始值邊界 | FR-04-1 |
| djb2 — 長字串輸入不 overflow | `>>> 0` 確保 uint32 範圍 | FR-04-1 |
| Mulberry32 — 相同 seed 序列可重現 | 連續呼叫 100 次產生相同序列 | FR-04-1 |
| Mulberry32 — 輸出範圍 [0, 1) | 所有輸出值嚴格在此區間 | FR-04-1 |
| Mulberry32 — 不同 seed 產生不同序列 | seed=0 vs seed=1 第一個值不同 | FR-04-1 |
| fisherYates — 無元素遺失 | 輸入 N 元素，輸出仍含全部 N 元素 | FR-04-4 |
| fisherYates — 單元素陣列不變 | edge: N=1 | FR-04-4 |
| fisherYates — 空陣列不報錯 | edge: N=0 | FR-04-4 |
| fisherYates — 同 rng 產生相同排列 | determinism 驗證 | FR-04-4 |

#### §2.1.2 GenerateLadder — seed determinism

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| 相同 seedSource + N → 完全相同輸出 | snapshot test | FR-04-1, AC-H03-3 |
| N=2, seed=0 → rowCount=20 | clamp 下界 | AC-H03-5, FR-04-3 |
| N=7, seed=X → rowCount=21 | N×3=21，clamp(21,20,60)=21 | AC-H03-5, FR-04-3 |
| N=21, seed=X → rowCount=60 | clamp 上界 | AC-H03-5, FR-04-3 |
| N=100, seed=X → rowCount=60 | 超過上界仍 clamp 至 60 | FR-04-3 |

#### §2.1.3 GenerateLadder — rowCount clamping

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| N=3 → rowCount=20（min clamp） | N×3=9 < 20，取 20 | AC-H03-5 |
| N=10 → rowCount=30 | N×3=30，無 clamp | AC-H03-5 |
| N=20 → rowCount=60（max clamp） | N×3=60，等於上界 | AC-H03-5 |

#### §2.1.4 GenerateLadder — segment validity

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| 所有 segment.col 在 [0, N-2] | 橫槓左端不超出欄位 | FR-04-2 |
| 所有 segment.row 在 [0, rowCount-1] | 列索引合法 | FR-04-2 |
| 同 row 內 segment 無重疊（col 及 col+1 不交叉） | 防衝突規則 | FR-04-2 |
| N=2 時 segment 數量 ≤ rowCount | 極端情況：每 row 最多 1 橫槓 | FR-04-2 |
| N=50 時所有橫槓合法 | 大 N stress | FR-04-2 |

#### §2.1.5 GenerateLadder — bar density

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| N=2（possiblePositions=1）density=0.50，平均橫槓數接近 50% rowCount | 統計性驗證（1000 次取平均）| FR-04-2 |
| N=3 density=0.65 | 統計性驗證 | FR-04-2 |
| N=4 density=0.75 | 統計性驗證 | FR-04-2 |
| N≥5 density=0.90 | 統計性驗證 | FR-04-2 |

#### §2.1.6 ComputeResults — 路徑計算與 bijection

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| 所有 endCol 唯一（bijection） | N 個起點 → N 個不同終點 | FR-04-4, NFR-03 |
| 無橫槓時 endCol = startCol | 直線走完 | FR-05-2 |
| 遇到右橫槓（segmentSet has `${row}:${col}`）向右移動 | 路徑方向正確 | FR-05-2 |
| 遇到左橫槓（segmentSet has `${row}:${col-1}`）向左移動 | 路徑方向正確 | FR-05-2 |
| 同 seed+N 呼叫兩次，results 完全一致 | determinism | NFR-03 |
| 1000 次隨機 seed 驗證 bijection 不失敗（CI property-based test） | 大規模驗證 | NFR-03 |

#### §2.1.7 ValidateGameStart

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| N=2, W=1 → 通過 | 最小合法邊界 | AC-H03-1 |
| N=50, W=49 → 通過 | 最大合法邊界 | AC-H03-1 |
| N=1 → INSUFFICIENT_PLAYERS | N < 2 | AC-H03-4 |
| W=0 → INVALID_PRIZES_COUNT | W < 1 | AC-H02-2 |
| W=N → INVALID_PRIZES_COUNT | W >= N | AC-H02-2 |
| W=null → PRIZES_NOT_SET | 未設定 | AC-H03-2 |

---

### §2.2 packages/server

**測試檔案位置：** `packages/server/src/__tests__/`

#### §2.2.1 RoomRepository（mock Redis）

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| createRoom — 成功建立並設 TTL=24h | 正常路徑 | FR-01-1, FR-01-2 |
| createRoom — Room Code 碰撞重試最多 10 次 | 碰撞逻辑 | FR-01-2, AC-H01-4 |
| createRoom — 重試超過 10 次拋出 ROOM_CODE_GENERATION_FAILED | 失敗路徑 | AC-H01-4 |
| getRoom — 存在房間回傳完整物件 | 正常路徑 | FR-01-3 |
| getRoom — 不存在/已過期拋出 ROOM_NOT_FOUND | 邊界 | FR-02-6 |
| addPlayer — 成功加入並廣播 ROOM_STATE | 正常路徑 | FR-02-1 |
| addPlayer — 暱稱重複拋出 NICKNAME_TAKEN（含離線玩家） | AC-P01-2, §6.4 |
| addPlayer — 人數達 50 拋出 ROOM_FULL | AC-P01-4, FR-02-3 |
| addPlayer — 房間狀態非 waiting 拋出 ROOM_NOT_ACCEPTING | AC-P01-8, FR-02-6 |
| kickPlayer — 成功移除並持久化 kickedPlayerIds | FR-11-2 |
| kickPlayer — 非 waiting 狀態拋出 INVALID_STATE | FR-11-3 |
| kickPlayer — 踢自己拋出 CANNOT_KICK_HOST | AC-H07-3b |
| updateWinnerCount — waiting 狀態成功 | AC-H02-1 |
| updateWinnerCount — 非 waiting 拋出 INVALID_STATE | AC-H02-4 |
| updateTitle — waiting 狀態成功 | AC-H01-5, FR-01-5 |
| updateTitle — 非 waiting 拋出 TITLE_UPDATE_NOT_ALLOWED_IN_STATE | AC-H01-5 |
| INCR revealedCount 原子操作 | 防 race condition | FR-13-1 |
| TTL — finished 後設為 1h | FR-01-2, EDD §9.1 |
| TTL — 最後一人斷線設為 5min | EDD §9.1 |

#### §2.2.2 RoomService — business logic

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| createRoom — 成功回傳 roomCode, playerId, token | US-H01, FR-01-4 |
| joinRoom — 存入 localStorage 相關資訊（服務端邏輯） | FR-02-1 |
| reconnect — 帶 playerId 回傳 ROOM_STATE_FULL | FR-10-1 |
| reconnect — playerId 在 kickedPlayerIds 拒絕 | FR-10-1, AC-P06-2 |
| reconnect — 同 playerId 新連線觸發 SESSION_REPLACED | FR-10-3 |
| ghostPlayer(waiting) — 視為新玩家 | FR-10-2 |
| ghostPlayer(running/revealing) — 回傳 ROOM_NOT_JOINABLE | FR-10-2 |
| playAgain — 剔除 isOnline=false 玩家 | FR-12-1, AC-H08-1 |
| playAgain — W 越界重設為 null | AC-H08-2, FR-12-2 |
| playAgain — 在線玩家 < 2 拋出 INSUFFICIENT_PLAYERS | AC-H08-3 |
| playAgain — 非 finished 狀態拋出 INVALID_STATE | AC-H08-5 |
| resetRoom — 任意狀態成功，不剔除離線玩家 | EDD §6.1 |

#### §2.2.3 GameService — state transitions

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| startGame — waiting→running，廣播 rowCount，不含 seed | AC-H03-1, FR-04-6 |
| startGame — N < 2 拋出 INSUFFICIENT_PLAYERS | AC-H03-4 |
| startGame — W 未設定拋出 PRIZES_NOT_SET | AC-H03-2 |
| startGame — W >= N 拋出 INVALID_PRIZES_COUNT | AC-H02-2 |
| startGame — 重複呼叫（已 running）拋出 INVALID_STATE | AC-H03-6 |
| beginReveal — running→revealing，原子生成 LadderData | AC-H04-1 |
| beginReveal — 非 running 狀態拋出 INVALID_STATE | AC-H04-5 |
| revealNext — 廣播 REVEAL_INDEX，revealedCount +1 | AC-H04-2 |
| revealNext — revealedCount === totalCount 時不廣播 | AC-H04-3 |
| revealNext — 非 revealing 狀態拋出 INVALID_STATE | AC-H04-6 |
| revealAll — 廣播 REVEAL_ALL（ResultSlotPublic，省略 path） | AC-H06-1 |
| revealAll — 所有路徑已揭曉時不廣播 | AC-H06-3 |
| revealAll — 非 revealing 拋出 INVALID_STATE | AC-H06-4 |
| endGame — revealing→finished，seed 首次公開 | AC-H04-4, FR-04-6 |
| endGame — revealedCount < totalCount 拋出 END_GAME_REQUIRES_ALL_REVEALED | AC-H04-4b |
| endGame — 非 revealing 拋出 INVALID_STATE | FR-09-3 |
| setRevealMode(auto) — intervalSec 合法（1-300）啟動計時器 | AC-H05-1 |
| setRevealMode(auto) — intervalSec 非整數拋出 INVALID_INTERVAL | AC-H05-3 |
| setRevealMode(auto) — intervalSec > 300 拋出 INVALID_INTERVAL | AC-H05-3 |
| setRevealMode(manual) — 停止自動計時器 | AC-H05-2 |
| autoReveal timer — 全揭後自動停止（不廣播多餘事件） | AC-H05-4 |
| autoReveal + manual 同時觸發 — INCR 原子，revealedCount 只增 1 | §6.8 |

#### §2.2.4 WebSocket handler — message routing

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| 非 JSON 訊息 → ERROR WS_INVALID_MSG，保持連線 | FR-03-4, EDD §11.1 |
| 未知 type → ERROR WS_UNKNOWN_TYPE | EDD §11.1 |
| 非 host 傳送 host-only 訊息 → ERROR PLAYER_NOT_HOST | FR-03-2 |
| maxPayload 64KB 超過 → 伺服器關閉連線 | FR-03-5, EDD §6.1 |
| 速率超限 60 msg/min → close 4029 | EDD §10.1 |
| JWT 驗證失敗（Upgrade 階段）→ 403 | EDD §8.2 |
| kickedPlayerId 在 Upgrade 階段 → close 4003 | FR-11-2, EDD §8.2 |
| Origin 不在白名單 → 403 | EDD §10.3 |

#### §2.2.5 Security — seed 防洩漏

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| waiting/running 狀態 ROOM_STATE 不含 seed | NFR-05, FR-04-6 |
| revealing 狀態 ROOM_STATE_FULL 使用 LadderDataPublic（省略 seed） | NFR-05, EDD §10.2 |
| finished 狀態 ROOM_STATE 含 seed | AC-H04-4 |
| GET /api/rooms/:code 不暴露 hostId（RoomSummaryPayload） | EDD §10.1 |

---

### §2.3 packages/client

**測試檔案位置：** `packages/client/src/__tests__/`

#### §2.3.1 LocalStorageService

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| saveNickname — 正確寫入 `ladder_last_nickname` | FR-08-1, AC-P01-6 |
| loadNickname — 讀取已儲存暱稱 | FR-08-2 |
| loadNickname — 無暱稱時回傳 null | FR-08-2 |
| savePlayerId — 寫入 UUID v4 | FR-08-3 |
| loadPlayerId — 讀取 playerId | FR-10-1 |
| clearPlayerId — 清除 playerId（踢除路徑） | FR-08-4, AC-P06-1 |
| clearPlayerId — 連線替換路徑同樣清除 | FR-08-4 |

#### §2.3.2 Canvas renderer（mock canvas 2D context）

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| drawRails — 繪製 N 條垂直線 | FR-06-1 |
| drawRungs — 依 segments[] 繪製橫槓 | FR-06-2 |
| drawRevealedPath（自己）— 高亮色 + alpha=1.0 | FR-06-3 |
| drawRevealedPath（他人）— 對應色 + alpha=0.6 | FR-06-3, FR-06-5 |
| drawUnrevealedPath — 灰色虛線 | FR-06-3 |
| drawWinnerStar — shadowBlur=10 金色光暈 | FR-06-5, FR-07-3 |
| colorFromIndex — 50 個不同顏色，無重複 | FR-06-5 |
| colorFromIndexDim — 淡化版顏色 | FR-06-5 |
| REVEAL_ALL 後 2 秒超時 → 跳至終止幀 | FR-06-6, AC-H06-1 |

#### §2.3.3 WS client 重連策略

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| 指數退避序列：1/2/4/8/30s | EDD §6.2 |
| 5 次失敗後停止重連 | EDD §6.2 |
| SESSION_REPLACED → Modal 提示，跳首頁 | EDD §11.2 |
| PLAYER_KICKED → 清除 playerId，顯示通知，關閉 WS | AC-P06-1, FR-08-4 |

#### §2.3.4 URL 與 localStorage 預填邏輯

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| URL `?room=AB3K7X` → 自動預填 Room Code 欄位 | AC-P01-5, FR-14-2 |
| localStorage `ladder_last_nickname` 有值 → 自動預填暱稱 | AC-P01-6, FR-08-2 |
| Clipboard API 可用 → 寫入邀請 URL，按鈕顯示「已複製！」1.5s | AC-H09-2, FR-14-3 |
| Clipboard API 不可用 → 顯示 fallback `<input>` 並全選 | AC-H09-3, FR-14-3 |

---

## §3 Integration Test Plan

**測試框架：** Vitest + testcontainers（真實 Redis Docker 容器）
**測試檔案位置：** `packages/server/src/__tests__/integration/`

### §3.1 REST API Integration

#### POST /api/rooms → GET /api/rooms/:code 完整 round-trip

| 測試案例 | 步驟 | 驗證點 | AC/FR |
|---------|------|--------|-------|
| 建立房間成功 | POST /api/rooms → 201 | roomCode 6 碼合法字元集；token JWT 有效 | AC-H01-1 |
| 建立後查詢房間 | GET /api/rooms/:code → 200 | status=waiting，playerCount=1 | AC-H01-2 |
| 加入房間 | POST /api/rooms/:code/players → 201 | playerId UUID v4；room.players 長度增加 | AC-P01-1 |
| 踢出玩家 | DELETE /api/rooms/:code/players/:id（host token）→ 204 | 後續 GET 確認玩家已移除 | AC-H07-1 |
| 開始遊戲 | POST /api/rooms/:code/game/start → 200 | status=running；rowCount 符合公式 | AC-H03-1 |
| 揭示（next mode）| POST /api/rooms/:code/game/reveal {mode:"next"} → 200 | revealedCount +1 | AC-H04-2 |
| 揭示（all mode）| POST /api/rooms/:code/game/reveal {mode:"all"} → 200 | ladder 為 LadderDataPublic（無 seed） | AC-H06-1 |
| 結束本局 | POST /api/rooms/:code/game/end → 200 | status=finished；含 seed | AC-H04-4 |
| 再玩一局 | POST /api/rooms/:code/game/play-again → 200 | status=waiting；kickedPlayerIds=[] | AC-H08-1 |
| 重置房間 | POST /api/rooms/:code/game/reset → 200 | status=waiting；含離線玩家 | EDD §2.9 |

#### 錯誤情境 REST Integration

| 測試案例 | 請求 | 預期回應 | AC/FR |
|---------|------|---------|-------|
| 查詢不存在房間 | GET /api/rooms/XXXXXX | 404 ROOM_NOT_FOUND | AC-P01-7 |
| 暱稱重複加入 | POST players x2 同暱稱 | 409 NICKNAME_TAKEN | AC-P01-2 |
| 房間滿員（50人）加入 | POST players 第 51 次 | 409 ROOM_FULL | AC-P01-4 |
| 非 host 呼叫 start | POST game/start（player token）| 403 PLAYER_NOT_HOST | EDD §8.2 |
| JWT 過期呼叫 host 操作 | 模擬過期 token | 401 AUTH_TOKEN_EXPIRED | AC-H08-4 |
| N < 2 開始遊戲 | POST game/start（只有 host） | 400 INSUFFICIENT_PLAYERS | AC-H03-4 |
| W 未設定開始遊戲 | POST game/start（winnerCount=null） | 400 PRIZES_NOT_SET | AC-H03-2 |
| 非 finished 狀態 play-again | POST game/play-again（running） | 409 INVALID_STATE | AC-H08-5 |
| endGame 尚有未揭曉 | POST game/end（revealedCount < N） | 409 END_GAME_REQUIRES_ALL_REVEALED | AC-H04-4b |

#### Redis 原子操作 Integration

| 測試案例 | 說明 | FR |
|---------|------|---|
| WATCH/MULTI/EXEC 並發保護 | 兩個同時 START_GAME 請求，只有一個成功 | §6.8 |
| INCR revealedCount 並發 | 兩個同時 REVEAL_NEXT，revealedCount 只增 1 | §6.8 |
| Redis SETNX 唯一 Room Code | 模擬 10 次碰撞 → ROOM_CODE_GENERATION_FAILED | AC-H01-4 |
| TTL 設定正確（waiting=24h, finished=1h）| PTTL 驗證 | EDD §9.1 |

### §3.2 WebSocket Integration

#### 連線 → JOIN_ROOM → ROOM_UPDATE 流程

| 測試案例 | 步驟 | 驗證點 | AC/FR |
|---------|------|--------|-------|
| WS 連線建立後收到 ROOM_STATE_FULL | 1.建立房間 2.WS connect | type=ROOM_STATE_FULL；selfPlayerId 正確 | EDD §6.2 |
| 玩家加入後所有連線收到 ROOM_STATE | 1.Host WS 2.Player REST join 3.Player WS | 兩個 client 均收到 ROOM_STATE；players.length=2 | AC-P02-1 |
| 玩家斷線後收到 ROOM_STATE（isOnline=false）| WS 斷線 | 其他 client 在 2s 內收到更新 | AC-P02-2 |
| 玩家重連後收到 ROOM_STATE_FULL | 帶 playerId 重連 | isOnline=true；房間狀態快照正確 | AC-P05-1 |

#### START_GAME → GAME_STARTED 流程

| 測試案例 | 步驟 | 驗證點 | AC/FR |
|---------|------|--------|-------|
| Host START_GAME → 所有 client 收到 ROOM_STATE(running) | 2 client WS | status=running；rowCount 符合公式；不含 seed | AC-H03-1 |
| rowCount 三邊界值自動驗證（N=3,10,21）| E2E 建立 3/10/21 人房 | rowCount=20/30/60 | AC-H03-5 |

#### REVEAL_ONE → REVEAL_RESULT 流程

| 測試案例 | 步驟 | 驗證點 | AC/FR |
|---------|------|--------|-------|
| BEGIN_REVEAL → ROOM_STATE(revealing) | Host WS | status=revealing；1s 內完成 | AC-H04-1 |
| REVEAL_NEXT → REVEAL_INDEX 廣播 | Host WS REVEAL_NEXT | 所有 client 收到 REVEAL_INDEX；path+result 正確 | AC-H04-2 |
| REVEAL_ALL_TRIGGER → REVEAL_ALL 廣播 | Host WS REVEAL_ALL_TRIGGER | ResultSlotPublic（無 path）；payload < 64KB | AC-H06-1 |
| END_GAME → ROOM_STATE(finished) + seed 公開 | 全揭後 END_GAME | status=finished；seed 首次出現在 payload | AC-H04-4 |

#### 斷線/重連 WebSocket Integration

| 測試案例 | 說明 | AC/FR |
|---------|------|-------|
| revealing 狀態重連 → 靜態已揭曉結果（不重播動畫） | 模擬斷線後 reconnect | ROOM_STATE_FULL 含已揭曉結果 | AC-P05-2 |
| 同 playerId 重複 WS 連線 → 舊連線收到 SESSION_REPLACED | 兩個 WS 連線同一 playerId | 舊連線 SESSION_REPLACED；新連線正常 | FR-10-3 |
| kickedPlayerId 重連 → close 4003 | 踢除後嘗試重連 | WS close code=4003 | AC-P06-2, FR-11-2 |
| Host 斷線後 Player 保持連線 | Host WS 強制關閉 | Player WS 60s 內不中斷 | §6.6 |

---

## §4 E2E Test Plan（Playwright）

**測試框架：** Playwright 1.x（Headless Chrome）
**測試環境：** Local（Docker Compose 或 K8s Rancher Desktop）
**測試檔案位置：** `packages/e2e/tests/`（或 `packages/server/e2e/`）

### §4.1 完整遊戲流程（2 個玩家，Happy Path P0）

```typescript
// 對應所有 P0 User Story 的核心流程
test('complete game flow: 2 players', async ({ browser }) => {
  // Arrange: 開啟兩個獨立 browser context
  const hostCtx = await browser.newContext();
  const playerCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const playerPage = await playerCtx.newPage();

  // Act + Assert: 依序驗證每個 Step
});
```

| Step | 驗證點 | AC/FR |
|------|--------|-------|
| 1. Host 建立房間 | POST /api/rooms 201；頁面顯示 6 碼 Room Code | AC-H01-1 |
| 2. Host 等待大廳顯示邀請連結 | 頁面含「複製邀請連結」按鈕 | AC-H09-1 |
| 3. Player 以邀請 URL 加入 | URL `?room=CODE` 自動預填；1.5s 內進入等待畫面 | AC-P01-5 |
| 4. Host 看到玩家列表更新 | 2s 內玩家列表出現 Player 暱稱 | AC-P02-1 |
| 5. Host 設定 winnerCount=1 | 廣播 ROOM_STATE；winnerCount=1 | AC-H02-1 |
| 6. Host 點擊「開始遊戲」 | ROOM_STATE(running)；rowCount=20（N=2） | AC-H03-1 |
| 7. Host 點擊「開始揭曉」 | ROOM_STATE(revealing)；1s 內完成 | AC-H04-1 |
| 8. Host 點擊「下一位」× 2 | 兩個 REVEAL_INDEX 廣播；Canvas 動畫播放 | AC-H04-2 |
| 9. Player 看到自己路徑高亮 | Canvas 高亮色顯示 | AC-P03-1 |
| 10. Host 點擊「結束本局」 | ROOM_STATE(finished)；seed 公開；結果頁面 | AC-H04-4 |
| 11. Player 看到中獎/未中獎文字 | 文字與 server result 一致 | AC-P04-1 |
| 12. Host 點擊「再玩一局」 | ROOM_STATE(waiting)；kickedPlayerIds 清空 | AC-H08-1 |

### §4.2 一鍵全揭流程（P0）

| Step | 驗證點 | AC/FR |
|------|--------|-------|
| REVEAL_ALL_TRIGGER 後 2s 內所有動畫完成 | 計時驗證；若超時 → 跳至終止幀 | AC-H06-1, FR-06-6 |
| REVEAL_ALL 後 Host 按「結束本局」→ finished | 確認 seed 公開 | AC-H06-2 |

### §4.3 踢除玩家流程（P1）

| Step | 驗證點 | AC/FR |
|------|--------|-------|
| Host 踢除 Player | Player 看到「你已被主持人移出房間」；WS 關閉 | AC-P06-1 |
| 被踢 Player 嘗試重連 | close 4003；顯示「你已被移出此房間」 | AC-P06-2 |

### §4.4 斷線重連流程（P1）

| Step | 驗證點 | AC/FR |
|------|--------|-------|
| 遊戲 running 狀態 Player 斷線後重連 | 3s 內（DOMContentLoaded → 狀態渲染）恢復 | AC-P05-1 |
| revealing 狀態重連 → 靜態已揭曉結果 | 不重播動畫；已揭曉結果正確顯示 | AC-P05-2 |

### §4.5 50 人房間上限（P0）

| Step | 驗證點 | AC/FR |
|------|--------|-------|
| 嘗試加入第 51 個玩家 | 顯示「房間已滿，無法加入」 | AC-P01-4 |

### §4.6 路徑揭示動畫完成確認

| Step | 驗證點 | AC/FR |
|------|--------|-------|
| REVEAL_INDEX 後等待動畫完成 selector | Canvas animate 結束 selector 可見 | AC-P03-1 |
| 動畫完成後底部結果槽顯示結果 | DOM 元素持久顯示 | AC-P03-2 |

### §4.7 自動揭曉模式（P1）

| Step | 驗證點 | AC/FR |
|------|--------|-------|
| SET_REVEAL_MODE(auto, intervalSec=1) → 自動廣播 | 每秒收到一個 REVEAL_INDEX | AC-H05-1 |
| 切換回手動模式 → 自動停止 | 3s 內不再有新 REVEAL_INDEX | AC-H05-2 |

### §4.8 多瀏覽器相容性（P1）

- Chrome 110+、Firefox 110+、Safari 15+（Playwright 跨瀏覽器執行）
- 最小 320px 寬度 viewport：無水平 overflow
- iOS Safari 15+ 模擬（Playwright mobile）

---

## §5 Performance Test Plan

### §5.1 WS 並發壓測（k6）

**工具：** k6（WebSocket 支援）
**目標環境：** Local K8s（Rancher Desktop）或 Staging

**測試腳本：** `k6/ws-load-test.js`

```javascript
// 目標：100 房間 × 50 人 × 完整遊戲流程
export const options = {
  scenarios: {
    ws_game_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5000 },  // 5,000 WS 連線
        { duration: '3m', target: 5000 },  // 穩定壓測
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    'ws_connecting': ['p(95)<1500'],    // WS 握手 P95 < 1.5s
    'ws_msgs_received': ['rate>0.995'], // 訊息接收成功率 > 99.5%
    'http_req_failed': ['rate<0.005'],  // HTTP 失敗率 < 0.5%
  },
};
```

| 指標 | 目標值 | 量測方式 |
|------|--------|---------|
| 並發 WS 連線數 | 5,000（100房間 × 50人） | k6 ws_sessions |
| 建立房間成功率 | > 99.5% | k6 http_req_failed |
| 玩家加入成功率 | > 99% | k6 http_req_failed |
| WS 廣播延遲（P95） | < 2s（伺服器發出→客戶端完成更新） | k6 ws_session_duration |
| WS 握手延遲（P99） | < 1.5s | k6 ws_connecting |
| 斷線重連時間（P95） | < 3s | k6 自訂 metric |
| Redis 操作 | < 500 ops/s | k6 + Redis INFO |

### §5.2 HTTP API 壓測（Autocannon）

**工具：** Autocannon
**目標：** `POST /api/rooms`、`POST /api/rooms/:code/players`

```bash
# 建立房間壓測
autocannon -c 50 -d 30 -m POST -H 'Content-Type:application/json' \
  -b '{"hostNickname":"Host","winnerCount":1}' \
  http://ladder.local/api/rooms

# 目標：P99 < 2s，成功率 > 99.5%
```

### §5.3 前端效能壓測（Lighthouse CI）

**工具：** Lighthouse CI（`@lhci/cli`）
**觸發時機：** 每次 PR（GitHub Actions）

**設定檔：** `lighthouserc.js`

```javascript
module.exports = {
  ci: {
    collect: { url: ['http://ladder.local/'], numberOfRuns: 3 },
    assert: {
      assertions: {
        'first-contentful-paint': ['warn', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
      },
    },
  },
};
```

| 指標 | 目標值 | 觸發 CI 阻斷 |
|------|--------|------------|
| FCP（Slow 4G） | < 1.5s | 是 |
| LCP（Slow 4G） | < 2.5s | 是 |
| CLS | < 0.1 | 是 |
| TBT | < 200ms | 警告 |
| JS bundle 首頁（gzip） | < 80KB | 是 |
| JS bundle 遊戲頁（gzip） | < 150KB | 是 |
| CSS（gzip） | < 30KB | 警告 |

### §5.4 Canvas FPS 壓測

| 測試案例 | 環境 | 目標 | 量測方式 |
|---------|------|------|---------|
| 50 人滿員房間，揭示動畫 FPS（桌機） | Chrome 1080p | ≥ 30fps | Chrome DevTools Performance → requestAnimationFrame timing |
| 50 人滿員房間，揭示動畫 FPS（手機） | Chrome DevTools Moto G4 throttling | ≥ 24fps（10s 平均） | Chrome DevTools Performance |

---

## §6 UAT Scenarios

每個 P0 User Story 對應至少 1 個 UAT 情境，由 QA / Product 人工驗證。

| UAT-ID | 對應 US | 情境標題 | 驗收人 |
|--------|---------|---------|--------|
| UAT-H01 | US-H01 | 主持人建立房間並取得 6 碼邀請連結 | QA |
| UAT-H02 | US-H02 | 主持人設定中獎名額（邊界值 W=1, W=N-1） | QA |
| UAT-H03 | US-H03 | 主持人開始遊戲，所有客戶端一致顯示梯子 | QA + PM |
| UAT-H04a | US-H04 | 主持人手動逐步揭曉（完整流程，N=5） | QA |
| UAT-H04b | US-H04 | 主持人在揭曉中途觸發結束（預期失敗提示） | QA |
| UAT-H05 | US-H05 | 主持人設定自動揭曉 T=3s，切換回手動 | QA |
| UAT-H06 | US-H06 | 主持人一鍵揭曉，2s 內動畫完成 | QA |
| UAT-H07 | US-H07 | 主持人踢除玩家，被踢者看到通知 | QA |
| UAT-H08 | US-H08 | 主持人再玩一局，離線玩家自動剔除 | QA |
| UAT-H09 | US-H09 | 主持人複製邀請連結（Clipboard + Fallback） | QA |
| UAT-P01a | US-P01 | 玩家透過邀請 URL 加入（自動預填 Room Code） | QA |
| UAT-P01b | US-P01 | 玩家使用上次暱稱（localStorage 預填） | QA |
| UAT-P01c | US-P01 | 玩家加入已滿房間（顯示房間已滿） | QA |
| UAT-P02 | US-P02 | 多玩家同時在線，玩家列表即時更新（< 2s）| QA |
| UAT-P03 | US-P03 | 玩家觀看自己路徑動畫（高亮 + FPS 目視確認） | QA |
| UAT-P04 | US-P04 | 玩家確認中獎/未中獎結果與主持人一致 | QA + PM |
| UAT-P05a | US-P05 | 玩家斷線後重連恢復（waiting 狀態） | QA |
| UAT-P05b | US-P05 | 玩家在 revealing 狀態斷線後重連（靜態結果，不重播） | QA |
| UAT-P06 | US-P06 | 被踢玩家看到通知並無法重新加入 | QA |

**UAT 通過標準：** 所有 P0 UAT 全數通過，P1 UAT 通過率 ≥ 90%

---

## §7 Test Coverage Targets

| 套件 | 層次 | 目標覆蓋率 | 工具 |
|------|------|-----------|------|
| `packages/shared` | Unit | ≥ 90% | Vitest v8 coverage |
| `packages/server`（application/domain） | Unit | ≥ 80% | Vitest v8 coverage |
| `packages/client`（非 Canvas DOM） | Unit | ≥ 70% | Vitest v8 coverage |
| REST API 端點 | Integration | 100%（所有 path） | Vitest + testcontainers |
| WS 訊息類型 | Integration | 100%（所有 WsMsgType） | Vitest + testcontainers |
| P0 User Story Happy Path | E2E | 100% | Playwright |
| P0 User Story Error Path | E2E | ≥ 80% | Playwright |
| P1 User Story Happy Path | E2E | ≥ 70% | Playwright |

### §7.1 CI 覆蓋率閘門設定

**vitest.config.ts：**

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        // packages/shared
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
```

**GitHub Actions 閘門：**

```yaml
- name: Unit + Integration Test with Coverage
  run: npx vitest --coverage --reporter=json
- name: Assert coverage >= 80% (server)
  run: node scripts/check-coverage.js packages/server 80
- name: Assert coverage >= 90% (shared)
  run: node scripts/check-coverage.js packages/shared 90
```

---

## §8 Migration Baseline（重要！）

### §8.1 現有測試基準

**截至 2026-04-21，現有 Vitest 測試：171 個全數通過（來源：EDD §12.4）**

參考快照：`docs/MIGRATION_CODE_SNAPSHOT.md`

遷移後必須維持以下條件：
1. 所有 171 個現有測試繼續通過（不得因重構導致退化）
2. 新增測試不得降低現有覆蓋率
3. 遷移步驟：先跑 `npx vitest run` 確認基準 171 通過 → 實施變更 → 再跑確認仍 171+ 通過

### §8.2 Migration 測試執行順序

```bash
# Step 1: 確認遷移前基準
npx vitest run --reporter=json | grep "Tests " # 應顯示 171 passed

# Step 2: 執行遷移（程式碼變更）

# Step 3: 確認遷移後基準維持
npx vitest run --reporter=json | grep "Tests " # 應顯示 ≥ 171 passed，0 failed

# Step 4: 新增測試（本 Test Plan 定義的新 cases）
npx vitest run --coverage
```

### §8.3 不可破壞的現有測試類別（依 MIGRATION_CODE_SNAPSHOT）

- PRNG 模組現有測試（djb2、Mulberry32、Fisher-Yates）
- GenerateLadder 現有快照測試
- ComputeResults 現有 bijection 測試
- RoomRepository mock Redis 現有 CRUD 測試
- 所有已通過的 WS handler 測試

---

## §9 Test Environments

### §9.1 Local — Unit & Integration

| 項目 | 設定 |
|------|------|
| Runtime | Node.js 20 LTS |
| 測試框架 | Vitest 1.x |
| Redis | testcontainers（真實 Docker Redis 6+ 容器） |
| 執行指令 | `npm run test:unit`、`npm run test:integration` |
| CI 環境變數 | `NODE_ENV=test`、`REDIS_URL=redis://localhost:6379` |

### §9.2 Local — E2E（Playwright + K8s）

| 項目 | 設定 |
|------|------|
| 執行環境 | Rancher Desktop（containerd），`http://ladder.local` |
| 瀏覽器 | Chromium（Headless）、Firefox、WebKit |
| 啟動指令 | `./scripts/dev-k8s.sh up && npx playwright test` |
| 截圖路徑 | `playwright-report/screenshots/` |
| 影片錄製 | 僅 CI 失敗時保留 |
| Timeout | 30s per test（WS 操作含重試） |

### §9.3 Local — Performance（k6）

| 項目 | 設定 |
|------|------|
| 工具 | k6（官方 Docker image：`grafana/k6:latest`） |
| 目標環境 | `http://ladder.local`（K8s Rancher Desktop） |
| 執行指令 | `docker run --rm -i grafana/k6 run - < k6/ws-load-test.js` |
| 結果輸出 | k6 summary JSON + Prometheus 指標（prom-client）|

### §9.4 CI（GitHub Actions）

| 階段 | 工具 | 觸發時機 |
|------|------|---------|
| lint + typecheck | ESLint + tsc --noEmit | 每次 PR |
| npm audit | npm audit --audit-level=high | 每次 PR |
| unit-test | Vitest（節點環境）| 每次 PR |
| integration-test | Vitest + testcontainers | 每次 PR |
| coverage-gate | Vitest coverage ≥ 80%/90% | 每次 PR（阻斷） |
| build | npm run build + Docker multi-stage | 每次 PR |
| e2e | Playwright（Docker Compose） | 每次 PR |
| lighthouse-ci | @lhci/cli | 每次 PR（阻斷 FCP/LCP/CLS） |
| k6 壓測 | k6 WebSocket（100房間×50人） | 週期性（非每次 PR，待 OQ-08 確認） |

---

*TEST_PLAN 版本：v1.0*
*生成時間：2026-04-21（devsop-autodev STEP-14）*
*基於 PRD v1.0 + EDD v2.0 + API v2.1*
