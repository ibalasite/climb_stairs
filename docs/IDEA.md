# IDEA.md — Ladder Room Online

> 供 devsop-autodev STEP 01 BRD Review 使用
> 生成來源：從 legacy-PRD.md、legacy-PDD.md、legacy-EDD.md、legacy-ARCH.md、legacy-API.md、legacy-SCHEMA.md 提取
> 日期：2026-04-21

---

## §1 Product Vision

一款以 LINE 爬樓梯規則為基礎、支援異地多人加入同一房間、由主持人控制開局與揭曉節奏的 **HTML5 線上多人抽獎互動遊戲**，適用於尾牙、直播、線上活動、會議抽獎等場景。

---

## §2 Problem Statement

**誰的問題：** 需要在活動中主持公平多人抽獎的主持人，以及希望以簡單方式遠端參與抽獎的玩家。

**什麼問題：**
- LINE 原生爬樓梯遊戲在人數超過上限後只顯示結果、不顯示完整走線過程，視覺不完整
- 超過一定人數時畫面顯示不完整，規則僵化，難以自訂房間機制與獎項規則
- 無法作為獨立品牌活動頁或大型線上互動玩法獨立部署
- 現有工具不支援異地多人同房、主持人掌控揭曉節奏、結果公正可驗證等需求

---

## §3 Core Features

### 主持人功能（Host）

1. **建立房間**：生成唯一 6 碼 Room Code（32 字元集，排除視覺混淆字元），2 秒內完成，房間 TTL 4 小時
2. **設定中獎名額**：設定 W（1 ≤ W ≤ N-1），可在 `waiting` 狀態隨時調整
3. **開始遊戲**：驗證 N ≥ 2 且 W 已設定後，狀態轉為 `running`，凍結玩家名單
4. **手動逐步揭曉**：每次點擊「下一位」廣播 `REVEAL_INDEX`，逐格播放路徑動畫
5. **自動揭曉**：設定間隔 T（1 ≤ T ≤ 30 秒整數），伺服器自動定時廣播下一個揭曉
6. **一鍵全揭**：廣播 `REVEAL_ALL`，所有客戶端 2 秒內完成全部動畫渲染，自動觸發 `finished`
7. **踢除玩家**：僅在 `waiting` 狀態有效，被踢玩家同局不可重連，「再玩一局」後禁令解除
8. **再玩一局**：`finished` 後剔除離線玩家，重置房間狀態為 `waiting`，繼續下一輪
9. **複製邀請連結**：Clipboard API 一鍵複製 `{origin}/?room={roomCode}`，不可用時 fallback 為可全選 `<input>`

### 玩家功能（Player）

1. **加入房間**：輸入暱稱（1～20 Unicode 字元，同房唯一）及 6 碼房間碼，1.5 秒內進入等待畫面
2. **URL 預填房號**：透過邀請連結自動帶入 Room Code，localStorage 自動預填上次暱稱
3. **即時玩家列表**：等待大廳即時顯示其他玩家加入/離線狀態，廣播到更新 < 2 秒
4. **路徑揭曉動畫**：Canvas 高亮自己路徑，桌機 ≥ 30fps，手機 ≥ 24fps
5. **中獎結果確認**：路徑抵達底部後即時顯示「恭喜中獎！」或「未中獎」
6. **斷線重連**：帶 `playerId` 自動重連，3 秒內恢復狀態快照，不重播已完成動畫
7. **被踢通知**：收到 `PLAYER_KICKED` 後立即提示、清除 localStorage、提供「回首頁」按鈕

### 遊戲核心機制

- **Mulberry32 PRNG 算法**：由 UUID hex 以 djb2 hash 轉 uint32 初始化，保證所有客戶端結果 100% 一致
- **樓梯生成規則**：每 row 生成 max(1, round(N/4)) 條橫槓，橫槓只連接相鄰欄位，不重疊；rowCount = clamp(N×3, 20, 60)
- **結果槽 bijection**：Fisher-Yates 洗牌確保 N 個起點對應 N 個唯一終點，W 個中獎槽公平分配
- **防作弊**：seed 及完整樓梯資料在 status=`finished` 前禁止傳送至任何客戶端

---

## §4 Target Users

| 角色 | 使用情境 | 核心需求 |
|------|---------|---------|
| 主持人（Host） | 尾牙、直播互動、線上活動、課堂點名、會議抽獎 | 快速建立活動（1 分鐘內開局）、即時掌握人員狀態、結果公平可展示 |
| 玩家（Player） | 收到邀請連結、透過瀏覽器參與 | 10 秒內完成加入、不需安裝 App、手機電腦均可、感受抽獎期待感 |

**規模：** 正常活動規模支援 30 人，系統設計上限 50 人；單一伺服器實例支援 100 個並發房間、5,000 個 WebSocket 連線。

---

## §5 Technical Context

### 語言與框架

| 層級 | 技術 | 版本 / 備註 |
|------|------|------------|
| Runtime | Node.js | 20 LTS |
| 語言 | TypeScript | strict mode，前後端共用 |
| HTTP Server | Fastify | REST API (`/api/*`) |
| WebSocket | ws（原生） | `maxPayload: 65536`（64KB 上限） |
| 快取 / 狀態 | Redis | 唯一持久層；原子操作、Pub/Sub、房間持久化 |
| 前端框架 | Vanilla TypeScript + Vite | 無 UI 框架，零依賴，HTML5 Canvas 渲染 |
| Monorepo | npm workspaces | `packages/shared`、`packages/server`、`packages/client` |

### 架構原則

- **Clean Architecture**：Domain（shared）→ Use Cases（shared）→ Application（server）→ Infrastructure（server）→ Presentation（server）
- **packages/shared**：前後端共用純邏輯（PRNG、狀態機、樓梯生成），零 I/O，可在瀏覽器執行
- **DI 策略**：constructor injection，`container.ts` 以工廠函式組裝所有依賴，測試時直接傳入 mock

### 基礎設施

| 環境 | 技術 |
|------|------|
| 容器 | Docker（Distroless Node.js 20 / Nginx 1.27-alpine），多階段建構 |
| 編排 | Kubernetes（HPA）+ Traefik Ingress，sticky session |
| 前端部署（本機） | Nginx Pod（ladder-client:local），`imagePullPolicy: Never` |
| 前端部署（生產） | GitHub Pages CDN，bundle < 150KB gzip |
| 本機開發 | `./scripts/dev-k8s.sh [up|down|restart|logs]`，http://ladder.local |
| CI/CD | GitHub Actions：lint → audit → test → build → e2e → deploy |

### 測試框架

- **單元 + 整合**：Vitest（後端覆蓋率目標 ≥ 80%，前端 ≥ 70%）
- **E2E**：Playwright（覆蓋所有 P0 User Story Happy Path 及主要錯誤路徑）
- **性能**：k6 壓力測試（100 房間 × 50 人並發）、Lighthouse CI（每次 PR 自動量測）

### 非功能約束

- Canvas 動畫：桌機 ≥ 30fps，手機 ≥ 24fps（50 人滿員房間）
- WebSocket 廣播端對端延遲 < 2 秒（P95）
- 首頁 JS bundle（gzip）< 80KB；遊戲頁面 JS bundle < 150KB；CSS < 30KB
- FCP < 1.5s，LCP < 2.5s，CLS < 0.1（Lighthouse Simulated Slow 4G）
- 結果一致性：0 容忍差異（1,000 次亂數 seed 自動驗證 bijection 特性）

---

## §6 原始需求原文

以下段落逐字提取自舊文件，作為需求溯源依據。

### 來自 legacy-PDD.md §1（產品概述）

> Ladder Room Online 是一款基於 LINE 爬樓梯玩法的 HTML5 線上多人互動遊戲。玩家可從不同地點使用瀏覽器進入同一個 Room，等待主持人開始。主持人設定中獎名額後，系統隨機生成樓梯，所有玩家沿各自起點向下走，最終對應到底部的中獎或未中獎結果。
>
> **一句話定義**：一款以 LINE 爬樓梯規則為基礎，支援異地玩家加入同一 Room，由主持人控制開局與揭曉的 HTML5 線上多人抽獎遊戲。

### 來自 legacy-PDD.md §2（產品背景）

> LINE 爬樓梯遊戲是常見的抽獎互動形式，但原生版本存在以下限制：人數限制（超過一定人數後只顯示結果，不顯示完整走線過程）、視覺不完整（人數多時畫面顯示不完整）、規則僵化（難以自訂房間機制與獎項規則）、無法獨立部署（不適合作為獨立品牌活動頁或大型線上互動玩法）。線上活動、尾牙、直播互動需求日增，需要一個可獨立部署、支援異地多人的解決方案。

### 來自 legacy-PRD.md（執行摘要）

> Ladder Room Online 是一款基於 HTML5 Canvas 的多人線上爬樓梯抽獎遊戲，支援最多 50 人同房間即時參與。主持人建立房間並掌控揭曉節奏，玩家透過 6 碼房間碼加入並即時觀看路徑動畫；Mulberry32 PRNG 算法確保每局結果在所有客戶端 100% 一致，消除舞弊疑慮，適用於團隊抽獎、課堂點名、活動互動等場景。

### 來自 legacy-PRD.md（FR-03 樓梯生成算法）

> 樓梯結構以 Mulberry32 PRNG 生成，seed 以 djb2 hash 將 seed 字串（UUID hex）轉為 uint32 初始化。橫槓生成規則：每 row 目標 max(1, round(N/4)) 條橫槓；只連接相鄰欄位；同 row 橫槓不重疊（|a-b| ≤ 1 視為衝突）；每條橫槓最多嘗試 N×10 次。結果槽指派須滿足 bijection（N 個起點對應 N 個唯一終點），以 Fisher-Yates 洗牌指派 W 個中獎槽位（消耗 N 次 PRNG）。樓梯資料由後端生成後序列化為 JSON 廣播至所有客戶端；前端僅負責渲染，不自行生成樓梯。

### 來自 legacy-EDD.md §1（系統概覽）

> Ladder Room Online 是一款基於 HTML5 Canvas 的多人線上爬樓梯抽獎系統，採用 WebSocket 長連接驅動即時遊戲狀態同步，支援最多 50 名玩家共享同一房間。後端以 Fastify 處理 HTTP REST 操作，ws 原生 WebSocket 處理即時通訊，Redis 同時承擔分散式狀態鎖（原子操作）、房間資料持久化與跨 Pod Pub/Sub 廣播的角色；前端以 Vanilla TypeScript + Vite 建構，透過 HTML5 Canvas 逐段繪製梯子揭示動畫，全程無任何 UI 框架依賴，確保最小 JS bundle。整體系統遵循 Clean Architecture 分層原則，核心遊戲邏輯（PRNG、狀態機、梯子生成）封裝於 packages/shared 並在前後端共用，保證演算法一致性可驗證；部署層透過 Kubernetes HPA 依 WebSocket 連線數自動水平擴展後端 Pod，Nginx Ingress 做 sticky session 確保同一房間玩家路由至同一 Pod，Redis 作為唯一共享狀態層解耦 Pod 間狀態依賴。

### 來自 legacy-PRD.md（NFR-05 安全性）

> 所有 Host 操作須驗證 token（JWT），非法或過期 token 回傳 401；操作者非 Host 回傳 403。玩家 playerId 為 UUID v4（不可猜測）；kickedPlayerIds 機制確保被踢玩家無法在同局重連。WebSocket 訊息大小上限 64KB，超過則拒絕並關閉連線。seed 在 status=finished 前禁止傳送給任何客戶端（防止預測抽獎結果）。

### 來自 legacy-SCHEMA.md（持久層選擇）

> Ladder Room Online 使用 Redis 作為唯一的持久層。選擇 Redis 的原因：房間生命週期短（數分鐘到數小時），天然適合 TTL 驅動的資料管理；WebSocket 廣播需要低延遲讀寫，Redis 的亞毫秒響應完全符合；原子操作（INCR、SETNX、MULTI/EXEC、WATCH）消除競態條件，無需分散式鎖服務；記憶體用量可預測（每房間 ~88 KB，100 房間僅 ~8.8 MB）。

---

## Appendix C：Attached Materials（附件與素材）

| 檔案路徑 | 類型 | 內容說明 | 應用於 |
|---------|------|---------|--------|
| docs/req/legacy-PRD.md | 舊版文件 | PRD v1.4，含完整使用者故事（US-H01～US-H09 主持人、US-P01～US-P06 玩家）、功能需求（FR-01～FR-12）、非功能需求（NFR-01～NFR-08）及驗收標準總表，詳述 Room Code 生成、玩家加入、PRNG 算法、狀態機、揭曉控制、Canvas 動畫等所有規格 | BRD §2,§4 / PRD §3,§4 |
| docs/req/legacy-PDD.md | 舊版文件 | PDD v2.2，含產品背景（LINE 爬樓梯痛點）、產品目標（成功指標）、角色定義（Host/Player）、核心玩法規則（橫槓規則、開局規則、中獎規則）、房間系統詳規（暱稱唯一性、Ghost Player、被踢玩家、多分頁處理）、揭曉控制、斷線重連、再玩一局及防作弊需求 | BRD §1,§2 / PDD §2,§3 |
| docs/req/legacy-EDD.md | 舊版文件 | EDD（無版本號），定義完整技術棧（Node.js 20、TypeScript strict、Fastify、ws、Redis、Vanilla TS + Vite、Vitest、GitHub Actions、Docker Distroless、Kubernetes HPA + Traefik）、Clean Architecture 分層結構、系統架構圖（k8s cluster、Redis StatefulSet、HPA）及資料流圖 | EDD §2,§3 |
| docs/req/legacy-ARCH.md | 舊版文件 | ARCH v1.2，詳述 Clean Architecture 各層職責（Domain/Use Cases/Application/Infrastructure/Presentation）、套件依賴關係（shared ← server/client，無直接 cross-import）、packages/shared 輸出清單（entities、value-objects、use-cases、prng、types）及 packages/server 各模組單句職責說明（container.ts、RoomService、GameService、WsMessageHandler、RoomRepository 等） | EDD §2 / ARCH |
| docs/req/legacy-API.md | 舊版文件 | API v1.1，定義 Base URL 策略、認證方式（JWT Bearer）、回應格式（直接 JSON，無 envelope）、10 個 HTTP REST 端點（POST /api/rooms、GET /api/rooms/:code、加入/踢出/開始/揭示/結束/再玩/健康檢查）及完整 WebSocket 事件規格（ROOM_STATE、REVEAL_INDEX、REVEAL_ALL、PLAYER_KICKED、SESSION_REPLACED 等伺服器廣播；JOIN_ROOM、START_GAME、BEGIN_REVEAL、REVEAL_NEXT、REVEAL_ALL 等客戶端訊息） | API.md |
| docs/req/legacy-SCHEMA.md | 舊版文件 | SCHEMA v1.1，描述 Redis 作為唯一持久層的設計決策、5 種 Redis Key 結構（room:{code} JSON、ladder JSON、revealedCount 計數器、kicked Set、sessions Hash）、TTL 策略（waiting/running/revealing 24h、finished 1h、全員離線 5min）及四個生命週期階段（waiting/running/revealing/finished）的完整 Room 物件 JSON 結構範例 | SCHEMA.md |
