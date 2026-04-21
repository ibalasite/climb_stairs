# BRD — Ladder Room Online

**版本**：v1.0  
**日期**：2026-04-21  
**狀態**：Draft  
**基於**：IDEA.md + legacy-PRD v1.4 + legacy-PDD v2.2 + legacy-EDD + legacy-ARCH v1.2 + legacy-API v1.1 + legacy-SCHEMA v1.1  

---

## §1 Product Vision & PR-FAQ

### §1.1 Hypothetical Press Release

**Ladder Room Online 正式上線 — 讓異地多人抽獎公平、透明且充滿樂趣**

*2026 年春季 — 台灣*

今天，Ladder Room Online 宣布正式推出，這是一款基於 LINE 爬樓梯玩法的 HTML5 線上多人互動抽獎遊戲，支援最多 50 位玩家同時從不同地點加入同一場抽獎活動。

活動主持人只需 1 分鐘即可建立房間，分享 6 碼邀請連結，玩家無需安裝任何 App，透過手機或電腦瀏覽器即可加入。獨家 Mulberry32 PRNG 算法確保所有客戶端結果 100% 一致，完全消除舞弊疑慮。主持人可手動逐步揭曉、設定自動揭曉間隔，或一鍵全部揭曉，靈活配合現場節奏。

「我們的目標是讓每一場線上活動的抽獎環節都能像現場一樣令人期待，」開發團隊表示。「從尾牙到直播互動，Ladder Room Online 讓公平、透明與娛樂性三者並存。」

Ladder Room Online 現已可透過瀏覽器存取，主持人無需下載安裝，即可立即建立房間並開始第一場抽獎活動。

---

### §1.2 Internal FAQ

**Q1：這個產品解決了什麼核心問題？**  
A：LINE 原生爬樓梯遊戲在人數超過上限後只顯示結果，不顯示完整走線過程，視覺不完整，且無法獨立部署作為品牌活動頁或大型線上互動玩法。Ladder Room Online 突破這些限制，支援異地多人同房、主持人掌控揭曉節奏、結果公正可驗證。

**Q2：目標用戶是誰？**  
A：兩類：(1) 需要在活動中主持公平多人抽獎的主持人（Host），例如公司活動負責人、直播主、老師；(2) 收到邀請連結、透過瀏覽器參與的玩家（Player）。

**Q3：MVP 的技術邊界是什麼？**  
A：Node.js 20 + Fastify + WebSocket（ws）+ Redis（唯一持久層）+ Vanilla TypeScript + Vite + Kubernetes（Rancher Desktop 本機開發），單一伺服器實例支援 100 並發房間、5,000 WebSocket 連線。

**Q4：如何確保抽獎結果公平？**  
A：採用 Mulberry32 PRNG + djb2 hash seed + Fisher-Yates 洗牌，seed 在 `finished` 狀態前禁止傳送給任何客戶端，防止預測結果；結果槽以 bijection 確保 N 個起點對應 N 個唯一終點。

**Q5：MVP 範圍內不包含哪些功能？**  
A：不含使用者帳號系統、行動原生 App、觀眾模式、多房間管理後台、自訂獎品名稱、動畫主題自訂、抽獎結果匯出、多語言支援、伺服器端水平擴展（Multi-node）及聲音效果。

---

## §2 Problem Statement

### §2.1 Problem & User Needs

**問題背景**

LINE 爬樓梯遊戲是廣泛使用的抽獎互動形式，但原生版本存在以下限制：

| 問題 | 說明 |
|------|------|
| 人數限制 | 超過一定人數後只顯示結果，不顯示完整走線過程 |
| 視覺不完整 | 人數多時畫面顯示不完整，體驗大打折扣 |
| 規則僵化 | 難以自訂房間機制與獎項規則 |
| 無法獨立部署 | 不適合作為獨立品牌活動頁或大型線上互動玩法 |
| 異地參與障礙 | 不支援異地多人同房、主持人掌控揭曉節奏、結果公正可驗證 |

**用戶需求**

- **主持人**：快速建立活動（1 分鐘內開局）、即時掌握人員狀態、結果公平且可在投影或直播上展示
- **玩家**：10 秒內完成加入、不需安裝 App、手機電腦均可參與、能感受到抽獎過程的期待感

### §2.2 Pain Point Quantification

- LINE 原生限制：超過約 25 人後走線過程不完整顯示，核心互動體驗降級
- 視覺展示：大型活動需要投影展示揭曉過程，LINE 原生工具無法支援定制化展示節奏
- 部署靈活性：線上活動、尾牙、直播互動需求日增，現有工具缺乏可獨立部署的解決方案
- 公信力不足：無法驗證抽獎結果，影響活動公正性認知

> **⚠️ [TODO]** §2.2 需補充具體量化數據：如 LINE 爬樓梯月活躍使用次數、台灣線上活動市場規模、主持人痛點調查數據等。

---

## §3 Business Objectives & Success Metrics

### §3.1 SMART Goals

| # | 目標 | Specific | Measurable | Achievable | Relevant | Time-bound |
|---|------|----------|------------|------------|---------|------------|
| G1 | 技術穩定性 | 建立房間成功率 > 99.5% | Server 端請求成功率（排除基礎設施故障期間） | 單一實例部署，Redis 原子操作 | 確保用戶信任 | MVP 上線後第 1 個月 |
| G2 | 玩家體驗 | 玩家加入成功率 > 99% | 玩家加入請求成功率 | WebSocket 穩定架構 | 降低參與門檻 | MVP 上線後第 1 個月 |
| G3 | 性能達標 | Canvas 動畫桌機 ≥ 30fps；手機 ≥ 24fps | Chrome DevTools FPS 量測 | Vanilla TS + requestAnimationFrame | 抽獎體驗關鍵指標 | MVP 上線前通過 E2E 測試 |
| G4 | 同步延遲 | 廣播端對端延遲 < 2 秒（P95） | WebSocket 打點計算端對端延遲 | Redis Pub/Sub + ws | 確保揭曉體驗流暢 | MVP 上線前通過 k6 壓測 |
| G5 | 結果一致性 | 100% 客戶端結果一致 | 多客戶端結果比對；1,000 次 seed 自動驗證 | Mulberry32 PRNG，shared 演算法 | 公平性核心承諾 | MVP 上線前通過自動化測試 |

### §3.2 KPIs

| KPI | 目標值 | 量測方式 | 量測時機 | 優先級 |
|-----|--------|---------|---------|--------|
| 建立房間成功率 | > 99.5% | Server 端日誌統計 | MVP 上線後第 1 個月 | P0 |
| 玩家加入成功率 | > 99% | Server 端日誌統計 | MVP 上線後第 1 個月 | P0 |
| 同房間最大人數 | 50 人 | k6 壓力測試（50 並發連線） | MVP 上線前 CI | P0 |
| 開局後結果一致性 | 100% | 多客戶端結果比對；1,000 次 seed 自動化驗證 | MVP 上線前 CI 閘門 | P0 |
| 揭曉動畫流暢度（桌機） | ≥ 30fps | Chrome DevTools，50 人滿員，1080p | MVP E2E 測試 | P1 |
| 揭曉動畫流暢度（手機） | ≥ 24fps | Chrome DevTools Moto G4 throttling，10 秒平均 | MVP E2E 測試 | P1 |
| 房間同步延遲（P95） | < 2 秒 | WebSocket 打點計算端對端延遲 | k6 壓測 | P1 |
| 重連恢復成功率 | 100% | 自動化測試模擬 WebSocket 強制斷線 | MVP E2E 測試 | P1 |
| 重連完成時間（P95） | < 3 秒 | Playwright 量測：DOMContentLoaded 至狀態渲染完成 | MVP E2E 測試 | P1 |
| 前端 JS bundle（首頁，gzip） | < 80KB | Lighthouse CI bundle 分析 | 每次 PR | P1 |
| 前端 JS bundle（遊戲頁，gzip） | < 150KB | Lighthouse CI bundle 分析 | 每次 PR | P1 |
| FCP（Simulated Slow 4G） | < 1.5s | Lighthouse CI | 每次 PR | P1 |
| LCP（Simulated Slow 4G） | < 2.5s | Lighthouse CI | 每次 PR | P1 |
| CLS | < 0.1 | Lighthouse CI | 每次 PR | P1 |

### §3.3 OKRs (Optional)

**Objective：成為台灣線上活動主持人首選的抽獎工具**

| Key Result | 量測指標 | 目標時間 |
|------------|---------|---------|
| KR1：技術基礎可靠 | 建立房間成功率 ≥ 99.5%，連續 30 天 | MVP 上線後第 1 個月 |
| KR2：用戶體驗順暢 | P95 玩家加入時間 < 1.5 秒 | MVP 上線前通過 E2E 測試 |
| KR3：結果公信力 | 1,000 次自動化 seed 測試 100% bijection 驗證通過 | MVP 上線前 |

> **⚠️ [TODO]** §3.3 OKR 中的 KR 需補充實際業務成長目標（如：月活用戶數、房間創建數量等），目前僅有技術層面指標。

### §3.4 RTM（Requirement Traceability Matrix）

| 需求 ID | 需求描述 | 來源文件 | 對應 User Story | 對應功能需求 | 對應 NFR | 驗收標準 |
|---------|---------|---------|----------------|------------|---------|---------|
| REQ-01 | 建立唯一 6 碼 Room Code | PDD §7.1 | US-H01 | FR-01-1, FR-01-2 | NFR-02 | AC-H01-1, AC-H01-4 |
| REQ-02 | 設定中獎名額 W（1 ≤ W ≤ N-1） | PDD §6.2, §6.3 | US-H02 | FR-01-3 | - | AC-H02-1, AC-H02-2 |
| REQ-03 | 開始遊戲（N ≥ 2 且 W 已設定） | PDD §6.2 | US-H03 | FR-04-1 | NFR-01, NFR-03 | AC-H03-1～AC-H03-5 |
| REQ-04 | 手動逐步揭曉 | PRD §US-H04 | US-H04 | FR-05-1 | NFR-01 | AC-H04-1～AC-H04-5 |
| REQ-05 | 自動揭曉（T 1-30 秒） | PRD §US-H05 | US-H05 | FR-05-2 | NFR-01 | AC-H05-1～AC-H05-3 |
| REQ-06 | 一鍵全揭 | PRD §US-H06 | US-H06 | FR-05-3 | NFR-01 | AC-H06-1～AC-H06-3 |
| REQ-07 | 踢除玩家（waiting 狀態） | PDD §7.1 | US-H07 | FR-09-1～FR-09-3 | NFR-05 | AC-H07-1～AC-H07-5 |
| REQ-08 | 再玩一局 | PRD §US-H08 | US-H08 | FR-08-1～FR-08-3 | - | AC-H08-1～AC-H08-4 |
| REQ-09 | 複製邀請連結（Clipboard API + fallback） | PRD FR-11-3 | US-H09 | FR-11-3 | - | AC-H09-1～AC-H09-3 |
| REQ-10 | 玩家加入（暱稱 + 6 碼碼） | PDD §7.1 | US-P01 | FR-02-1～FR-02-3 | NFR-01 | AC-P01-1～AC-P01-6 |
| REQ-11 | URL 預填房號 + localStorage 暱稱預填 | PRD FR-11-2, FR-11-4 | US-P01 | FR-11-2, FR-11-4 | - | AC-P01-5, AC-P01-6 |
| REQ-12 | 即時玩家列表更新（< 2 秒） | PRD §US-P02 | US-P02 | FR-02-4 | NFR-01 | AC-P02-1, AC-P02-2 |
| REQ-13 | 路徑揭曉動畫（Canvas） | PRD §US-P03 | US-P03 | FR-10-1～FR-10-4 | NFR-01 | AC-P03-1, AC-P03-2 |
| REQ-14 | 中獎結果確認 | PRD §US-P04 | US-P04 | FR-12-1, FR-12-2 | NFR-03 | AC-P04-1, AC-P04-2 |
| REQ-15 | 斷線重連（< 3 秒恢復） | PDD §8 | US-P05 | FR-07-1～FR-07-3 | NFR-04 | AC-P05-1～AC-P05-3 |
| REQ-16 | 被踢通知與 localStorage 清除 | PDD §7.1 | US-P06 | FR-09-2, FR-09-3 | NFR-05 | AC-P06-1, AC-P06-2 |
| REQ-17 | Mulberry32 PRNG + Fisher-Yates bijection | PRD FR-03 | US-H03 | FR-03-1～FR-03-4 | NFR-03, NFR-05 | AC-H03-3, NFR-03 |
| REQ-18 | JWT 認證（Host 操作） | PRD NFR-05 | US-H01～US-H09 | FR-01-4 | NFR-05 | NFR-05 |
| REQ-19 | WebSocket 訊息大小上限 64KB | EDD §0 | 全部 WS 操作 | FR-06-3 | NFR-05 | - |
| REQ-20 | Kubernetes + Redis 部署 | EDD §2 | 全部 | - | NFR-02, NFR-04 | k6 壓測 |

### §3.5 Benefits Realization Plan

| 效益 | 實現條件 | 量測時間點 | 負責方 |
|------|---------|-----------|-------|
| 主持人可在 1 分鐘內建立並開始一場抽獎活動 | MVP 上線且通過 E2E 測試 | MVP 上線後第 1 個月 | 產品 + QA |
| 玩家無需安裝 App，10 秒內完成加入 | P99 加入時間 < 1.5s | MVP 上線後 E2E 量測 | 前端 + QA |
| 所有客戶端抽獎結果 100% 一致，消除舞弊疑慮 | 1,000 次 seed 自動化驗證 | MVP 上線前 CI 閘門 | 後端 + QA |
| 支援尾牙/直播等大型活動（50 人同房） | k6 壓測通過 100 房間 × 50 人 | MVP 上線前壓測 | 後端 + DevOps |

---

## §4 Target Users

### §4.1 User Segments

| 角色 | 使用情境 | 核心需求 | 規模 |
|------|---------|---------|------|
| 主持人（Host） | 尾牙、直播互動、線上活動、課堂點名、會議抽獎 | 快速建立活動（1 分鐘內開局）、即時掌握人員狀態、結果公平可展示 | 每場 1 人 |
| 玩家（Player） | 收到邀請連結、透過瀏覽器參與 | 10 秒內完成加入、不需安裝 App、手機電腦均可、感受抽獎期待感 | 每房間 2～50 人 |

**使用規模**：正常活動規模支援 30 人，系統設計上限 50 人；單一伺服器實例支援 100 個並發房間、5,000 個 WebSocket 連線。

### §4.2 User Personas

**Persona 1：Annie — 企業活動主持人（Host）**

- **年齡**：32 歲
- **職位**：公司行政/HR，負責年度尾牙活動規劃
- **技術程度**：中等，熟悉使用 LINE 群組工具
- **使用情境**：尾牙當天需要在大螢幕投影面前，公開主持 30 人抽獎，確保過程公平透明且有視覺效果
- **核心痛點**：LINE 爬樓梯超過 20 人後走線看不清楚，現場氣氛打折；擔心被員工質疑結果不公平
- **期望**：在 1 分鐘內設定好，一個按鈕就能開始；過程有動畫效果，投影出來好看；結果無庸置疑
- **成功定義**：全程無技術問題，員工看得清楚走線，對結果沒有異議

**Persona 2：Bob — 直播主（Host）**

- **年齡**：26 歲
- **職位**：遊戲類 Twitch/YouTube 直播主
- **技術程度**：高，熟悉各種線上互動工具
- **使用情境**：直播中進行觀眾互動抽獎，需要分享連結給觀眾加入，配合直播節奏一步步揭曉
- **核心痛點**：需要客製化揭曉節奏（手動/自動），在直播緊張時刻製造懸念；觀眾人數不定（可能 10 人，也可能 40 人）
- **期望**：支援手動逐步揭曉，可以設定自動間隔；手機和電腦都能順暢參與
- **成功定義**：直播中零延遲、零 bug，觀眾體驗流暢，互動熱度高

**Persona 3：Carol — 活動參與者（Player）**

- **年齡**：28 歲
- **職位**：公司員工，被邀請參加尾牙抽獎
- **技術程度**：低，日常主要使用 LINE 和 FB
- **使用情境**：在尾牙現場，用手機點擊主持人分享的連結加入抽獎
- **核心痛點**：擔心需要安裝 App 或操作複雜；手機螢幕小，擔心看不清楚自己的走線
- **期望**：點連結就能進入，只需要輸入名字；能清楚看到自己的路徑走到哪裡，知道自己有沒有中獎
- **成功定義**：10 秒內完成加入，抽獎過程能清楚看到自己的路徑，結果清晰呈現

---

## §5 Scope

### §5.1 In Scope

**主持人功能（Host）**

1. 建立房間：生成唯一 6 碼 Room Code（32 字元集，排除視覺混淆字元），2 秒內完成，房間 TTL 4 小時
2. 設定中獎名額：設定 W（1 ≤ W ≤ N-1），可在 `waiting` 狀態隨時調整；房間名稱（title，0～50 字）
3. 開始遊戲：驗證 N ≥ 2 且 W 已設定後，狀態轉為 `running`，凍結玩家名單
4. 手動逐步揭曉：每次點擊「下一位」廣播 `REVEAL_INDEX`，逐格播放路徑動畫
5. 自動揭曉：設定間隔 T（1 ≤ T ≤ 30 秒整數），伺服器自動定時廣播
6. 一鍵全揭：廣播 `REVEAL_ALL`，所有客戶端 2 秒內完成全部動畫渲染
7. 踢除玩家：僅在 `waiting` 狀態有效，被踢玩家同局不可重連
8. 再玩一局：`finished` 後剔除離線玩家，重置房間狀態為 `waiting`
9. 複製邀請連結：Clipboard API 一鍵複製 `{origin}/?room={roomCode}`；不可用時 fallback 為可全選 `<input>`

**玩家功能（Player）**

1. 加入房間：輸入暱稱（1～20 Unicode 字元，同房唯一）及 6 碼房間碼，1.5 秒內進入等待畫面
2. URL 預填房號：透過邀請連結自動帶入 Room Code
3. localStorage 暱稱記憶：自動預填上次暱稱（key: `ladder_last_nickname`）
4. 即時玩家列表：等待大廳即時顯示其他玩家加入/離線狀態，廣播更新 < 2 秒
5. 路徑揭曉動畫：Canvas 高亮自己路徑，桌機 ≥ 30fps，手機 ≥ 24fps
6. 中獎結果確認：路徑抵達底部後即時顯示「恭喜中獎！」或「未中獎」
7. 斷線重連：帶 `playerId` 自動重連，3 秒內恢復狀態快照，不重播已完成動畫
8. 被踢通知：收到 `PLAYER_KICKED` 後立即提示、清除 localStorage、提供「回首頁」按鈕

**遊戲核心機制**

- Mulberry32 PRNG 算法：所有客戶端結果 100% 一致
- 樓梯生成規則：`rowCount = clamp(N×3, 20, 60)`；每 row max(1, round(N/4)) 條橫槓
- 結果槽 bijection：Fisher-Yates 洗牌確保公平分配
- 防作弊：seed 在 `finished` 前禁止傳送至任何客戶端

**技術交付**

- 後端 API（10 個 HTTP REST 端點 + WebSocket 事件）
- 前端 Web App（Vanilla TypeScript + Vite + HTML5 Canvas）
- Redis 持久層（5 種 Key 結構 + TTL 策略）
- Kubernetes 部署設定（本機 Rancher Desktop + 生產 HPA）
- CI/CD Pipeline（GitHub Actions：lint → audit → test → build → e2e → deploy）

### §5.2 Out of Scope

1. **使用者帳號系統**：MVP 不實作登入、註冊、歷史紀錄查詢；主持人身份以一次性 JWT token 管理
2. **行動原生 App（iOS / Android）**：MVP 僅支援行動瀏覽器（Mobile Web）
3. **觀眾模式（Spectator）**：MVP 不支援純觀看不參與的角色
4. **多房間管理後台**：MVP 不提供管理員儀表板
5. **自訂獎品名稱或分組抽獎**：MVP 結果槽僅區分「中獎」與「未中獎」
6. **動畫主題或皮膚自訂**：MVP 使用單一視覺主題
7. **抽獎結果匯出（PDF / CSV）**：MVP 不提供結果下載功能
8. **國際化（i18n）多語言支援**：MVP 以繁體中文為唯一介面語言
9. **伺服器端水平擴展（Multi-node clustering）**：MVP 以單一 Node.js 實例部署
10. **聲音效果與背景音樂**：MVP 不包含音效

### §5.3 Assumptions & Dependencies

**假設**

- 用戶具備基本瀏覽器操作能力，使用現代瀏覽器（Chrome 110+、Firefox 110+、Safari 15+）
- 主持人設備具備穩定網路連線（一般 WiFi）
- 玩家設備最低規格：近 4 年內 mid-range Android（Snapdragon 720G 等級）或 iPhone 11
- 系統部署於具備 Redis 6+ 的環境

**依賴**

| 依賴項 | 類型 | 說明 |
|-------|------|------|
| Node.js 20 LTS | 技術依賴 | Runtime 環境 |
| Redis 6+ | 基礎設施依賴 | 唯一持久層，需支援 WATCH/MULTI/EXEC |
| Kubernetes（Rancher Desktop） | 基礎設施依賴 | 本機開發環境 |
| GitHub Actions | CI/CD 依賴 | 自動化測試與部署 |
| GitHub Pages | 部署依賴 | 前端靜態資源 CDN |
| Vitest | 測試依賴 | 後端覆蓋率目標 ≥ 80%，前端 ≥ 70% |
| Playwright | 測試依賴 | E2E 測試，覆蓋所有 P0 User Story |

---

## §6 Market & Context

### §6.1 Market Size

**目標市場**

- **直接市場**：台灣線上活動工具市場，包含：企業年終尾牙（每年 10-12 月旺季）、直播互動抽獎（Twitch/YouTube/Facebook Live）、線上課程互動（教育場景）、社群活動（讀書會、俱樂部等）
- **潛在擴展市場**：東南亞 LINE 生態圈（LINE 為 TH/TW/JP 主要通訊工具）

> **⚠️ [TODO]** §6.1 需補充具體市場規模數據：台灣線上活動工具市場規模（TAM/SAM/SOM）、LINE 月活用戶數、年度尾牙活動場次估計等。

### §6.2 Competitive Landscape

| 競品 | 優勢 | 劣勢 | 與本產品差異 |
|------|------|------|------------|
| LINE 原生爬樓梯 | 零進入門檻，用戶熟悉 | 人數上限、視覺不完整、不可獨立部署 | Ladder Room Online 突破人數限制，支援完整走線動畫 |
| Mentimeter / Slido | 功能豐富，投票/問答 | 不支援爬樓梯玩法，訂閱制付費 | 專注爬樓梯核心玩法，免費 MVP |
| 其他線上抽獎工具 | 各有特色 | 多數缺乏爬樓梯走線動畫 | 走線動畫是核心差異化體驗 |

> **⚠️ [TODO]** §6.2 需補充更多競品分析，包含：抽獎輪盤工具（Wheel of Names 等）、日本/韓國同類工具，及定價策略比較。

---

## §7 Functional Requirements Overview

（高層次功能列表，詳細規格請參考 docs/req/legacy-PRD.md）

### 主持人功能（P0 優先）

| FR ID | 功能 | 優先級 |
|-------|------|--------|
| FR-01 | 房間建立與管理（Room Code 生成、JWT token） | P0 |
| FR-03 | 樓梯生成算法（Mulberry32 PRNG、Fisher-Yates） | P0 |
| FR-04 | 房間狀態機（waiting → running → revealing → finished） | P0 |
| FR-05 | 揭曉控制（手動/自動/一鍵全揭） | P0 |
| FR-06 | WebSocket 事件規格 | P0 |

### 玩家功能（P0 優先）

| FR ID | 功能 | 優先級 |
|-------|------|--------|
| FR-02 | 玩家加入與身份管理（playerId、暱稱唯一性） | P0 |
| FR-10 | Canvas 動畫渲染（requestAnimationFrame，FPS 達標） | P1 |
| FR-11 | 房間碼輸入體驗（URL 預填、localStorage 暱稱、複製邀請） | P2 |
| FR-12 | 得獎名單展示 | P2 |

### 可靠性功能（P1）

| FR ID | 功能 | 優先級 |
|-------|------|--------|
| FR-07 | 斷線重連（3 秒內恢復、Ghost Player 處理） | P1 |
| FR-08 | 再玩一局（剔除離線玩家、W 越界重設） | P1 |
| FR-09 | 踢除玩家（waiting 狀態限定、kickedPlayerIds 持久化） | P1 |

---

## §8 Non-Functional Requirements

### §8.1 Performance

| 指標 | 目標值 | 量測方式 |
|------|--------|---------|
| Canvas 動畫 FPS（桌機） | ≥ 30fps | Chrome DevTools，50 人滿員房間，1080p Chrome |
| Canvas 動畫 FPS（手機） | ≥ 24fps | Chrome DevTools Moto G4 throttling profile，10 秒錄製平均值 |
| WebSocket 廣播延遲（P95） | < 2 秒 | 伺服器發出到客戶端狀態更新完成 |
| 房間建立 API 回應（P99） | < 2 秒 | Server 端計時 |
| 玩家加入 WebSocket 握手（P99） | < 1.5 秒 | Playwright 量測：click 至 waiting 元素可見 |
| 斷線重連時間（P95） | < 3 秒 | 頁面 DOMContentLoaded 至狀態快照渲染完成 |
| FCP（Simulated Slow 4G） | < 1.5 秒 | Lighthouse CI |
| LCP（Simulated Slow 4G） | < 2.5 秒 | Lighthouse CI |
| CLS | < 0.1 | Lighthouse CI |

### §8.2 Availability

| 指標 | 目標值 |
|------|--------|
| 建立房間成功率 | > 99.5%（排除基礎設施故障） |
| 玩家加入成功率 | > 99% |
| 重連恢復成功率 | 100% |
| 主持人斷線容忍 | 主持人斷線後 60 秒內重連，其他玩家連線不中斷 |

### §8.3 Scalability

| 指標 | 目標值 | 說明 |
|------|--------|------|
| 並發房間數 | 100 個 | 單一伺服器實例 |
| 每房間玩家數 | 50 人 | 系統設計上限 |
| WebSocket 連線數 | 5,000 個 | 單一伺服器實例 |
| Redis 記憶體 | ~8.8 MB（100 房間） | 每房間 ~88 KB |

**水平擴展策略（Post-MVP）**：Kubernetes HPA 依 WebSocket 連線數自動擴展後端 Pod；Traefik Ingress 做 sticky session；Redis 作為唯一共享狀態層。

### §8.4 Security

| 安全需求 | 規格 | 來源 |
|---------|------|------|
| JWT 認證 | 所有 Host 操作需 JWT Bearer token；非法/過期回傳 401；非 Host 回傳 403 | PRD NFR-05 |
| playerId 不可猜測 | UUID v4 | PRD NFR-05 |
| 踢除禁令持久化 | kickedPlayerIds 存於 Redis，同局有效 | PRD NFR-05 |
| WebSocket 訊息大小限制 | 上限 64KB，超過則拒絕並關閉連線 | EDD §0 |
| seed 防洩漏 | seed 及完整樓梯資料在 status=`finished` 前禁止傳送給任何客戶端 | PRD NFR-05 |
| 自動揭示間隔驗證 | T 非整數或超出 1～30 秒範圍時回傳 INVALID_AUTO_REVEAL_INTERVAL | PRD NFR-05 |
| 前端 Bundle 預算 | 首頁 JS < 80KB gzip；遊戲頁 < 150KB gzip；CSS < 30KB | PRD NFR-06 |

---

## §9 Compliance & Data Governance

### §9.1 Legal & Regulatory

> **⚠️ [TODO]** §9.1 需確認適用法規：台灣個人資料保護法（PDPA）對暱稱/playerId 的適用性；若有涉及抽獎法規（如促銷活動相關規定），需請法務確認。

**目前已知**：

- 系統不儲存個人識別資訊（PII），僅存暱稱（用戶自行輸入，非強制真實身份）和 UUID playerId
- 房間數據有明確 TTL（最長 24 小時），`finished` 後 1 小時自動過期

### §9.2 Data Privacy

| 資料類型 | 存放位置 | TTL | 說明 |
|---------|---------|-----|------|
| 暱稱（nickname） | Redis room:{code} | 24h（waiting/running/revealing），1h（finished） | 非強制真實身份 |
| playerId（UUID v4） | Redis + 客戶端 localStorage | Redis 同上；localStorage 無過期，用戶可清除 | 不可猜測 UUID |
| JWT token | 客戶端記憶體（非 localStorage） | 連線 session 期間 | Host 專屬，一次性 |
| 樓梯結構（ladderMap） | Redis room:{code}:ladder | 同 room:{code} | 遊戲結束後隨房間過期 |

**隱私原則**：
- 最小資料收集：僅收集遊戲運作所需最少資訊
- 自動過期：所有資料透過 Redis TTL 自動清除，無需手動刪除
- 無追蹤：MVP 不使用 Analytics 工具或第三方追蹤

### §9.3 Audit Requirements

- **防作弊審計**：seed 在 `finished` 狀態後可選擇性公開，允許事後驗證抽獎結果
- **結果一致性審計**：Mulberry32 PRNG 算法確定性，相同 seed 可 100% 重現相同結果（1,000 次自動化驗證）
- **操作日誌**：WebSocket 事件及 HTTP 請求記錄於 Server 端日誌，用於問題排查

> **⚠️ [TODO]** §9.3 需確認是否需要更正式的操作審計日誌（如：誰在何時踢除了哪位玩家），以及日誌保留策略。

---

## §10 Stakeholders

### §10.1 RACI Matrix

| 活動 | 前端工程師 | 後端工程師 | QA | 設計師 | 產品負責人 | DevOps |
|------|-----------|-----------|-----|-------|-----------|--------|
| BRD 定義 | I | I | I | I | **A/R** | I |
| PRD 撰寫 | C | C | C | C | **A/R** | - |
| 系統架構設計 | C | **A/R** | I | - | I | C |
| 前端開發（Canvas + Vanilla TS） | **A/R** | I | C | C | I | - |
| 後端開發（Fastify + WS + Redis） | I | **A/R** | C | - | I | C |
| shared 模組開發（PRNG/狀態機） | C | **A/R** | C | - | I | - |
| K8s 部署設定 | - | C | I | - | I | **A/R** |
| CI/CD Pipeline | I | C | C | - | I | **A/R** |
| 單元/整合測試 | C | **A/R** | R | - | I | - |
| E2E 測試 | C | C | **A/R** | - | I | - |
| 性能測試（k6/Lighthouse） | C | C | **A/R** | - | I | C |
| 安全審查 | C | **A/R** | C | - | I | C |

**利害關係人角色說明**：

| 角色 | 職責範圍 | 備註 |
|------|---------|------|
| 產品負責人 | BRD/PRD 定義、優先序決策、Go/No-Go 判斷 | 單一決策點 |
| 前端工程師 | Vanilla TS + Vite + HTML5 Canvas 開發 | 需熟悉 requestAnimationFrame |
| 後端工程師 | Fastify + WebSocket + Redis + shared 模組 | 需熟悉 Clean Architecture |
| QA | E2E 測試、k6 壓測、Lighthouse CI、安全審查 | 負責 Go/No-Go 驗證 |
| 設計師 | UI/UX 設計、Canvas 動畫視覺規格 | 提供設計稿 |
| DevOps | K8s 部署、CI/CD Pipeline、GitHub Actions | 負責基礎設施 |

> **⚠️ [TODO]** §10.1 需補充實際人員名單及聯絡資訊，並確認各角色是否有具體負責人。

---

## §11 Business Model (Optional)

> **⚠️ [TODO]** §11 MVP 階段無商業模式設計。後續版本可考慮：免費基礎版（房間人數上限 15 人）+ 付費進階版（50 人上限 + 自訂主題 + 歷史紀錄）；或面向企業的 SaaS 授權模式。需產品負責人確認商業模式方向。

---

## §12 Risks & Mitigations

### §12.1 Risk Register

| 風險 ID | 風險描述 | 影響 | 發生機率 | 嚴重程度 | 緩解策略 |
|--------|---------|------|---------|---------|---------|
| R-01 | WebSocket 大規模斷線（如 CDN 或網路故障） | 所有玩家同時斷線，遊戲中斷 | 低 | 高 | Redis 持久化房間狀態；支援 3 秒內快速重連恢復；Kubernetes readiness probe |
| R-02 | Redis 服務中斷 | 無法讀取/寫入房間狀態，所有操作失敗 | 低 | 高 | Redis StatefulSet 部署；liveness/readiness probe；POST-MVP 考慮 Redis Sentinel |
| R-03 | Mulberry32 PRNG 碰撞導致結果不一致 | 客戶端結果不同，公信力喪失 | 極低 | 極高 | 1,000 次自動化 seed 驗證；shared 模組前後端共用同一實作；CI 強制閘門 |
| R-04 | 50 人房間 Canvas 動畫性能不達標 | 手機 FPS 低於 24fps，視覺體驗差 | 中 | 中 | requestAnimationFrame 渲染；Lighthouse CI 監控；Moto G4 throttling 測試 |
| R-05 | Room Code 碰撞（10 次重試仍失敗） | 建立房間失敗 | 極低 | 低 | 最多重試 10 次；超過回傳 ROOM_CODE_GENERATION_FAILED；32 字元集 6 碼 ≈ 10 億組合 |
| R-06 | JWT token 洩漏導致 Host 操作被仿冒 | 未授權操作房間 | 低 | 高 | JWT 簽章驗證；token 僅在連線 session 使用；WsServer.handleUpgrade 前置驗證 |
| R-07 | 前端 bundle 超出預算（> 150KB gzip） | 低速網路首次載入過慢，用戶流失 | 低 | 中 | Vanilla TS + Vite（無 UI 框架）；Lighthouse CI 阻擋超標版本 |
| R-08 | 再玩一局後 W 越界導致無法開始 | 主持人不知道需要重設 W | 中 | 低 | 自動重設 W 為 null 並通知主持人；前端顯示明確提示 |
| R-09 | Ghost Player（localStorage 遺失）占用槽位 | 同一物理玩家雙重抽獎機會 | 中 | 中 | MVP 不自動阻止；Host 可踢除斷線玩家；Lobby 明確顯示離線標記 |

### §12.2 Go/No-Go Criteria

**Go 條件（全部必須滿足）**

- [ ] 所有 P0 User Story（US-H01～US-H04、US-H06、US-P01～US-P04）Happy Path E2E 通過
- [ ] 後端單元測試覆蓋率 ≥ 80%
- [ ] 1,000 次 seed 自動化驗證 100% bijection 通過（結果一致性 0 容忍）
- [ ] k6 壓測：100 房間 × 50 人 WebSocket 並發，建立成功率 > 99.5%，加入成功率 > 99%
- [ ] Lighthouse CI：FCP < 1.5s，LCP < 2.5s，CLS < 0.1（Simulated Slow 4G）
- [ ] 安全檢查：JWT 驗證通過手動滲透測試

**No-Go 條件（任一觸發即阻止上線）**

- [ ] 任何 P0 User Story E2E 測試失敗
- [ ] 結果一致性測試出現任何差異（0 容忍）
- [ ] seed 在 `finished` 前洩漏
- [ ] 前端 JS bundle（gzip）超出限制（首頁 > 80KB 或遊戲頁 > 150KB）

---

## §13 Roadmap Overview

### MVP（當前版本）

**目標**：完整的爬樓梯抽獎核心功能上線

| 里程碑 | 功能範圍 | 優先級 | 預估週期 |
|-------|---------|--------|---------|
| M1：基礎架構 | 專案腳手架（Monorepo、TypeScript、Vite）、Redis 連線、K8s 本機環境 | P0 | Sprint 1（Week 1-2） |
| M2：核心遊戲邏輯 | packages/shared（PRNG、狀態機、樓梯生成）、後端 API 骨架 | P0 | Sprint 2（Week 3-4） |
| M3：房間系統 | 建立/加入房間、WebSocket 連線、玩家列表同步 | P0 | Sprint 3（Week 5-6） |
| M4：遊戲流程 | 開始遊戲、揭曉控制（手動/自動/全揭）、結果展示 | P0 | Sprint 4（Week 7-8） |
| M5：可靠性 | 斷線重連、踢除玩家、再玩一局 | P1 | Sprint 5（Week 9-10） |
| M6：用戶體驗 | 邀請連結、localStorage 暱稱記憶、Canvas 動畫優化 | P2 | Sprint 6（Week 11） |
| M7：品質閘門 | E2E 測試、k6 壓測、Lighthouse CI、安全審查 | P0/CI | Sprint 6-7（Week 11-12） |

### Post-MVP 規劃

> **⚠️ [TODO]** §13 Post-MVP 路線圖需產品負責人確認優先序。候選功能包含：觀眾模式、多語言支援、自訂獎品名稱、抽獎結果匯出、商業模式實作（付費方案）。

---

## Appendix A: Glossary

| 術語 | 定義 |
|------|------|
| Room Code | 6 碼唯一房間代碼，字元集為 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（排除視覺混淆字元 O、I、0、1） |
| Host | 建立房間的主持人，擁有 JWT token，可控制遊戲開局與揭曉節奏 |
| Player | 透過 Room Code 加入房間的參與者（含 Host 本人） |
| playerId | Server 生成的 UUID v4，存於客戶端 localStorage，用於身份驗證與斷線重連 |
| waiting | 房間狀態：等待玩家加入，Host 可編輯設定 |
| running | 房間狀態：遊戲進行中（`START_GAME` 後，`BEGIN_REVEAL` 前）|
| revealing | 房間狀態：揭曉進行中 |
| finished | 房間狀態：本局結束，seed 可選擇性公開 |
| seed | 樓梯生成的隨機種子，由 UUID hex 以 djb2 hash 轉 uint32 初始化 |
| Mulberry32 | 本系統使用的 PRNG（偽隨機數生成器），確保所有客戶端結果 100% 一致 |
| PRNG | Pseudo-Random Number Generator，偽隨機數生成器 |
| bijection | 一一對應：N 個起點對應 N 個唯一終點，確保抽獎公平性 |
| rowCount | 樓梯行數，公式：`clamp(N×3, 20, 60)` |
| startColumn | 玩家對應的起始垂直線（由左至右從 0 編號） |
| Ghost Player | localStorage 已清除、以無 playerId 身分訪問的玩家 |
| kickedPlayerIds | Redis Set，記錄本局被踢除的玩家 ID，同局有效 |
| TTL | Time-To-Live，Redis 鍵的自動過期時間 |
| N | 當前房間玩家數（含 isOnline=false 的斷線玩家） |
| W | 中獎名額（1 ≤ W ≤ N-1） |

---

## Appendix B: References

| 文件 | 版本 | 說明 |
|------|------|------|
| docs/req/legacy-PRD.md | v1.4 | 完整使用者故事（US-H01～US-H09、US-P01～US-P06）、功能需求（FR-01～FR-12）、非功能需求（NFR-01～NFR-08）及驗收標準 |
| docs/req/legacy-PDD.md | v2.2 | 產品背景、角色定義、核心玩法規則、房間系統詳規、斷線重連、防作弊需求 |
| docs/req/legacy-EDD.md | - | 技術棧定義、Clean Architecture 分層結構、系統架構圖、資料流圖 |
| docs/req/legacy-ARCH.md | v1.2 | Clean Architecture 各層職責、套件依賴關係、packages/shared 輸出清單、模組職責說明 |
| docs/req/legacy-API.md | v1.1 | Base URL 策略、JWT 認證、10 個 HTTP REST 端點、完整 WebSocket 事件規格 |
| docs/req/legacy-SCHEMA.md | v1.1 | Redis 設計決策、5 種 Redis Key 結構、TTL 策略、Room 物件 JSON 結構 |
| docs/IDEA.md | - | BRD 生成主要輸入，含 Appendix C 指向 legacy docs |
