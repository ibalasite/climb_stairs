# Alignment Report

Generated: 2026-04-21 (STEP-22 re-scan)

## Summary

- Total checks: 21
- Pass: 14
- Warn: 4
- Fail: 3

---

## Level 1: Document Consistency

| Check | Status | Note |
|-------|--------|------|
| BRD §7 FR list → PRD §3 User Stories coverage | ✅ PASS | 全部 16 項 REQ-xx 均對應 PRD US-H01～US-H09、US-P01～US-P06，無缺口 |
| PRD US-H01～US-H09 AC → features/ BDD Scenarios | ✅ PASS | room-management / game-lifecycle / host-actions / reveal-flow / room-lifecycle 均有覆蓋；US-H09（複製邀請連結）由 features/client/waiting-room.feature 覆蓋 |
| PRD US-P01～US-P06 AC → features/ BDD Scenarios | ✅ PASS | player-management / reconnect / client-reconnect / client-canvas / game-flow 覆蓋全部玩家故事 |
| EDD §5 Key Algorithms → packages/shared/src/use-cases/ 實作 | ✅ PASS | djb2、createMulberry32、fisherYatesShuffle、generateLadder、computeResults 實作與 EDD §5 偽代碼完全一致 |
| API.md REST 端點（11 項）→ packages/server/src/main.ts 路由 | ✅ PASS | 所有 11 個 REST 端點（POST/GET /api/rooms、game/start、game/reveal、game/reset、game/end、game/play-again、DELETE player、/health、/ready）均已實作 |
| API.md WebSocket 訊息類型 → server main.ts WS handler | ⚠️ WARN | server 正確處理 END_GAME、PLAY_AGAIN，但 shared WsMsgType 未含此二項（見 FAIL-2） |
| SCHEMA.md §2.6 Room type → packages/shared/src/types/index.ts Room | ✅ PASS | SCHEMA.md §2.6 Room 欄位（不含 title/rowCount）與 shared/types/index.ts Room interface 完全一致 |
| API.md §1.5 Room type → packages/shared/src/types/index.ts Room | ⚠️ WARN | API.md §1.5 Room interface 含 `title: string \| null` 及 `rowCount: number \| null` 欄位，但 SCHEMA.md §2.6 和 shared 型別均不含這兩個欄位，且 server 從未建立含 title 的 Room；API.md 文件與實際實作脫節 |
| autoRevealIntervalSec 上限（文件間一致性） | ❌ FAIL | BRD REQ-05、PRD US-H05/FR-13-2、PRD §8.4、SCHEMA.md §4.4 均寫「1-30 秒」；但 API.md §1.5 和 server 程式碼驗證「1-300」；存在跨文件衝突 |
| shared WsMsgType 完整性 → API.md + server 行為 | ❌ FAIL | API.md WsMsgType 含 END_GAME 和 PLAY_AGAIN；server main.ts 實際處理這兩個 WS 訊息類型；但 shared/src/types/index.ts WsMsgType 缺少 END_GAME 和 PLAY_AGAIN |
| shared WsEventType 完整性 → API.md 定義 | ❌ FAIL | API.md WsEventType 含 PONG；shared/src/types/index.ts WsEventType 缺少 PONG；server PING handler（case 'PING': break）收到 PING 後直接 break，未回傳 PONG，與 API.md §3.6 規格矛盾 |

---

## Level 2: Code-Test Alignment

| Check | Status | Note |
|-------|--------|------|
| packages/shared 每個 export → 至少有 1 個測試 | ✅ PASS | djb2.test.ts、mulberry32.test.ts、fisherYates.test.ts、GenerateLadder.test.ts、ComputeResults.test.ts、ValidateGameStart.test.ts，全部 6 個匯出均有對應測試 |
| packages/server GameService 所有方法 → 有測試 | ✅ PASS | GameService.test.ts 覆蓋：startGame、beginReveal、revealNext、revealAll、kickPlayer、resetRoom、endGame、playAgain 全部方法 |
| packages/server RoomService 所有方法 → 有測試 | ✅ PASS | RoomService.test.ts 覆蓋：generateRoomCode、createRoom、joinRoom |
| packages/server HTTP routes → 有測試 | ⚠️ WARN | rooms.test.ts 只覆蓋 POST /api/rooms 和 GET /api/rooms/:code；POST players、DELETE player、game/start、game/reveal、game/reset、game/end、game/play-again 無 HTTP 層測試（main.ts 已被 vitest coverage 排除，業務邏輯由 service 層單元測試間接覆蓋） |
| packages/server WebSocket handler → 有測試 | ⚠️ WARN | handleWsConnection 和 handleWsMessage 無直接測試（main.ts 在 vitest coverage exclude 清單中）；WS 行為由 GameService 單元測試間接驗證 |
| features/ BDD Scenarios → 有對應測試或 todo 骨架 | ✅ PASS | 所有 BDD .feature 檔案均為規格文件；server/client 均有對應的 Vitest 單元測試覆蓋核心業務邏輯；缺少 E2E Playwright 步驟實作（features/ 目前為純規格，無 cucumber/step-definition 整合） |
| BDD features/ 路由路徑與 API.md 一致性 | ⚠️ WARN | features/room-lifecycle.feature 和 features/player-management.feature 部分 scenario 使用 `/api/v1/rooms` 路徑，但 API.md 定義為 `/api/rooms`（無 /v1 前綴），實際 server 路由亦無 /v1 前綴 |
| packages/client 所有模組 → 有測試 | ✅ PASS | LocalStorageService.test.ts、store.test.ts、canvas/renderer.test.ts、canvas/rendererBranches.test.ts、ws/handleMessage.test.ts、ws/ping.test.ts、ws/reconnect.test.ts，覆蓋主要 client 模組 |

---

## Level 3: Version Consistency

| Check | Status | Note |
|-------|--------|------|
| 各文件 Version/Date 是否合理 | ✅ PASS | BRD v1.0 (2026-04-21)、PRD v1.0 (2026-04-21)、PDD v1.1 (2026-04-21)、EDD v2.0 (2026-04-21)、ARCH v2.0 (2026-04-21)、API v2.1 (2026-04-21)、SCHEMA v2.1 (2026-04-21) 日期一致；EDD 修訂歷史中 ECR-20260420-001 日期 2026-04-20 為正常的歷史變更紀錄 |
| BRD 版本與 PRD/EDD 參照一致 | ✅ PASS | PRD 明確標示 Based on BRD v1.0；API/SCHEMA 標示 Based on EDD v2.0, PRD v1.4（legacy reference）；均有可追溯的來源標注 |

---

## Action Items（FAIL 項目）

### FAIL-1：autoRevealIntervalSec 上限不一致（需統一決策）

**衝突情況：**

| 文件 | 規格值 |
|------|--------|
| BRD §3.4 REQ-05 | T 1-30 秒 |
| PRD US-H05、FR-13-2 | 1～30 秒整數 |
| PRD §8.4 安全需求 | 超出 1～30 秒回傳 INVALID_AUTO_REVEAL_INTERVAL |
| SCHEMA.md §4.4 | max 30 秒 |
| SCHEMA.md §2.6 Room comment | "1-30s" |
| API.md §1.5 Room | "1-300 整數秒" |
| SCHEMA.md §4.5 SET_REVEAL_MODE 說明 | 1-300 整數 |
| server/main.ts（程式碼實際行為） | 驗證 1-300 |

**建議：** 由產品確認最終規格（1-30 或 1-300），然後統一修改 BRD §3.4、PRD US-H05/FR-13-2/§8.4、SCHEMA.md §4.4 三處文件（或改 API.md 和 server 程式碼）。不強制修復，因牽涉產品決策。

---

### FAIL-2：shared WsMsgType 缺少 END_GAME 和 PLAY_AGAIN

**問題：** `packages/shared/src/types/index.ts` 的 `WsMsgType` union 型別缺少 `'END_GAME'` 和 `'PLAY_AGAIN'`，導致型別不完整。

**影響：** 客戶端若依賴 `WsMsgType` 發送 `END_GAME` 或 `PLAY_AGAIN` 訊息，TypeScript 型別檢查不提示這兩個值為合法類型。

**修復方向：**
```typescript
// packages/shared/src/types/index.ts
export type WsMsgType =
  | 'START_GAME'
  | 'BEGIN_REVEAL'
  | 'REVEAL_NEXT'
  | 'REVEAL_ALL_TRIGGER'
  | 'END_GAME'        // ← 缺少
  | 'PLAY_AGAIN'      // ← 缺少
  | 'SET_REVEAL_MODE'
  | 'RESET_ROOM'
  | 'KICK_PLAYER'
  | 'PING';
```

---

### FAIL-3：shared WsEventType 缺少 PONG + server PING handler 未回應 PONG

**問題 A：** `packages/shared/src/types/index.ts` 的 `WsEventType` 缺少 `'PONG'`，但 API.md §3.6 明確定義 PONG 為 Server → Client 事件。

**問題 B：** `server/main.ts` 的 PING handler（`case 'PING': break`）收到 PING 後直接 break，未回傳 PONG，與 API.md §3.6 規格（"伺服器回應 PONG { ts: echo } 供 RTT 量測"）矛盾。

**修復方向：**
```typescript
// packages/shared/src/types/index.ts
export type WsEventType =
  | 'ROOM_STATE'
  | 'ROOM_STATE_FULL'
  | 'REVEAL_INDEX'
  | 'REVEAL_ALL'
  | 'PLAYER_KICKED'
  | 'SESSION_REPLACED'
  | 'HOST_TRANSFERRED'
  | 'ERROR'
  | 'PONG';  // ← 缺少
```

```typescript
// server/main.ts PING handler
case 'PING': {
  const tsPayload = (msg.payload as { ts?: number } | undefined)?.ts;
  send('PONG', { ts: tsPayload ?? Date.now() });
  break;
}
```

---

## WARN 參考

- **WARN：API.md Room 含 title/rowCount 欄位**：API.md §1.5 的 Room interface 比 SCHEMA.md §2.6 和 shared 型別多了 `title: string | null` 和 `rowCount: number | null`；server 從未使用這兩個欄位。建議更新 API.md §1.5 Room 定義，移除 title 和 rowCount，與 SCHEMA.md 及 shared 保持一致。

- **WARN：BDD features 使用 /api/v1 前綴**：`features/room-lifecycle.feature` 和 `features/player-management.feature` 的部分 step 使用 `/api/v1/rooms`，但 API.md 和 server 均為 `/api/rooms`（無版本前綴）。建議修正 BDD steps 中的路徑。

- **WARN：server HTTP 遊戲路由缺少 HTTP 層測試**：`game/start`、`game/reveal`、`game/reset`、`game/end`、`game/play-again`、DELETE player 等路由的 HTTP 層未有獨立測試（main.ts 已從 coverage 排除），業務邏輯僅由 service 單元測試間接覆蓋。

- **WARN：BDD features/ 無步驟實作**：所有 .feature 檔案目前為純規格文件，無 cucumber/Playwright step definitions，無法直接作為自動化驗收測試執行。
