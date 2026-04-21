# PRD — Ladder Room Online

## Document Control

| 欄位 | 內容 |
|------|------|
| Version | 1.0 |
| Status | Draft |
| Date | 2026-04-21 |
| Author | AI PM Agent（devsop-autodev STEP-03） |
| Based On | BRD v1.0 + legacy-PRD v1.4 + legacy-PDD v2.2 |
| Stakeholders | 前端工程師、後端工程師、QA、設計師、DevOps |

---

## §1 Purpose & Background

### §1.1 Purpose

Ladder Room Online 是一款基於 LINE 爬樓梯玩法的 **HTML5 線上多人互動抽獎遊戲**，支援最多 50 位玩家從不同地點透過瀏覽器加入同一場抽獎活動。本 PRD 定義系統的完整使用者故事、功能需求及驗收標準，作為工程實作的主要規格依據。

### §1.2 Background

LINE 原生爬樓梯遊戲是廣泛使用的抽獎互動形式，但存在以下限制：

| 問題 | 說明 |
|------|------|
| 人數限制 | 超過約 25 人後走線過程不完整顯示，核心互動體驗降級 |
| 視覺不完整 | 人數多時畫面顯示不完整，體驗大打折扣 |
| 規則僵化 | 難以自訂房間機制與獎項規則 |
| 無法獨立部署 | 不適合作為獨立品牌活動頁或大型線上互動玩法 |
| 異地參與障礙 | 不支援異地多人同房、主持人掌控揭曉節奏、結果公正可驗證 |

**目標用戶**：
- **主持人（Host）**：需要在活動中主持公平多人抽獎（公司行政、直播主、老師等）
- **玩家（Player）**：收到邀請連結、透過瀏覽器參與的活動參加者

**技術邊界**：Node.js 20 + Fastify + WebSocket（ws）+ Redis（唯一持久層）+ Vanilla TypeScript + Vite + Kubernetes，單一伺服器實例支援 100 並發房間、5,000 WebSocket 連線。

---

## §2 Goals & Success Metrics

### §2.1 可驗收指標（來自 BRD §3）

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

### §2.2 Go/No-Go 條件

**Go 條件（全部必須滿足）**：
- [ ] 所有 P0 User Story Happy Path E2E 通過
- [ ] 後端單元測試覆蓋率 ≥ 80%
- [ ] 1,000 次 seed 自動化驗證 100% bijection 通過
- [ ] k6 壓測：100 房間 × 50 人 WebSocket 並發成功率達標
- [ ] Lighthouse CI：FCP < 1.5s，LCP < 2.5s，CLS < 0.1

**No-Go 條件（任一觸發即阻止）**：
- [ ] 任何 P0 User Story E2E 測試失敗
- [ ] 結果一致性測試出現任何差異
- [ ] seed 在 `finished` 前洩漏
- [ ] 前端 JS bundle 超出限制

---

## §3 User Stories

### 主持人（Host）User Stories

---

### US-H01: 建立房間

**As a** 主持人，**I want to** 建立一個帶有唯一 6 碼房間碼的房間，**so that** 玩家能快速找到並加入我的抽獎活動。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-H01-1: Given 主持人點擊「建立房間」，When 系統接受請求，Then 於 2 秒內回傳 6 碼 Room Code（字元集：`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`，排除視覺混淆字元 O、I、0、1）且在 Redis 中不重複。
- [ ] AC-H01-2: Given 房間建立成功，When 主持人進入房間，Then 頁面顯示 Room Code、目前玩家列表（空）、設定中獎名額的輸入框，以及可選填的房間名稱 title（0～50 字）輸入框，狀態為 `waiting`。
- [ ] AC-H01-3: Given 建立房間請求因網路異常失敗，When 系統偵測到錯誤，Then 顯示「建立失敗，請重試」提示並保留輸入內容，不產生孤立房間。
- [ ] AC-H01-4: Given Room Code 生成碰撞次數超過 10 次，When 系統無法在上限次數內找到唯一碼，Then 回傳 `ROOM_CODE_GENERATION_FAILED` 錯誤，前端顯示「建立失敗，請重試」。

---

### US-H02: 設定中獎名額

**As a** 主持人，**I want to** 設定中獎名額（W），**so that** 我可以控制本局有多少玩家會獲獎。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-H02-1: Given 房間狀態為 `waiting`，When 主持人在輸入框填入 W（1 ≤ W ≤ N-1，N 含 isOnline=false 的斷線玩家），Then 系統接受並廣播更新後的 `ROOM_STATE` 給所有在線玩家。
- [ ] AC-H02-2: Given 主持人輸入 W ≤ 0 或 W ≥ N，When 主持人送出，Then 系統顯示「中獎名額須介於 1 到玩家數減 1 之間」錯誤，不更新狀態。
- [ ] AC-H02-3: Given 再玩一局後剔除離線玩家且 W ≥ 新 N，When 系統偵測越界，Then 自動將 W 重設為 null 並通知主持人「中獎名額已重設，請重新設定」。

---

### US-H03: 開始遊戲

**As a** 主持人，**I want to** 在所有玩家就緒後開始遊戲，**so that** 可以正式進入揭曉流程。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-H03-1: Given 房間狀態為 `waiting` 且 N ≥ 2 且 W 已設定，When 主持人點擊「開始遊戲」，Then 狀態轉為 `running`，後端以原子操作同步完成 seed 生成（UUID hex，djb2 hash 轉 uint32）、ladderMap 計算與 resultSlots 指派，並廣播 `ROOM_STATE`（status=`running`，含 rowCount）；seed 及完整樓梯資料在 status=`finished` 前禁止傳送給任何客戶端。
- [ ] AC-H03-2: Given 主持人點擊「開始遊戲」但 W 尚未設定，When 系統收到請求，Then 拒絕並回傳錯誤「請先設定中獎名額」，狀態維持 `waiting`。
- [ ] AC-H03-3: Given 遊戲開始後，When 任何玩家收到 `ROOM_STATE`，Then 所有客戶端渲染的樓梯結構與橫槓位置完全一致，Canvas 動畫 FPS 桌機 ≥ 30、手機 ≥ 24。
- [ ] AC-H03-4: Given 房間只有 Host 一人（N < 2），When 主持人點擊「開始遊戲」，Then 系統拒絕並回傳 `INSUFFICIENT_PLAYERS` 錯誤，前端顯示「人數不足（至少需要 2 位玩家）」，狀態維持 `waiting`。
- [ ] AC-H03-5: `rowCount` 公式為 `clamp(N×3, 20, 60)`。Given N=3 時 rowCount=20；N=10 時 rowCount=30；N=21 時 rowCount=60，When 遊戲開始後，Then 伺服器廣播的 `rowCount` 與公式計算值完全一致（E2E 自動化驗證三個邊界值）。

---

### US-H04: 手動逐步揭曉路徑

**As a** 主持人，**I want to** 以手動逐步揭曉每條路徑，**so that** 我可以配合現場節奏製造懸念。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-H04-1: Given 房間狀態為 `running`，When 主持人點擊「開始揭曉」（觸發 `BEGIN_REVEAL`），Then 伺服器執行狀態轉換（`running → revealing`）並廣播 `ROOM_STATE`（status=`revealing`），所有客戶端顯示揭曉控制介面；操作須在 1 秒內完成。
- [ ] AC-H04-2: Given 狀態為 `revealing`，When 主持人點擊「下一位」，Then 伺服器廣播 `REVEAL_INDEX`（含對應玩家 index），所有客戶端同步播放該玩家的行走動畫。
- [ ] AC-H04-3: Given 所有路徑已逐步揭曉，When 主持人點擊「下一位」，Then 系統不回應（按鈕 disabled），頁面顯示「結束本局」按鈕。
- [ ] AC-H04-4: Given 所有路徑已揭曉且主持人點擊「結束本局」（觸發 `END_GAME`），When 伺服器收到 `END_GAME`，Then 狀態轉為 `finished`，廣播 `ROOM_STATE`（status=`finished`，含完整得獎名單及 seed），所有客戶端顯示最終結果頁面；操作須在 1 秒內完成。
- [ ] AC-H04-5: Given 狀態為非 `running`，When 主持人嘗試觸發 `BEGIN_REVEAL`，Then 伺服器拒絕並回傳 `INVALID_STATE` 錯誤，狀態不變。

---

### US-H05: 設定自動揭曉間隔

**As a** 主持人，**I want to** 設定自動揭曉間隔（1～30 秒/格），**so that** 遊戲可以在無人操作時自動進行。

**Priority**: P1

**Acceptance Criteria**:
- [ ] AC-H05-1: Given 主持人選擇自動模式並設定間隔 T（1 ≤ T ≤ 30，T 須為正整數），When 遊戲進入 `revealing`，Then 每隔 T 秒伺服器自動廣播下一個 `REVEAL_INDEX`，直到全部揭曉完畢。
- [ ] AC-H05-2: Given 自動揭曉進行中，When 主持人切換回手動模式，Then 自動計時停止，改由主持人手動觸發後續揭曉，已揭曉項目不受影響。
- [ ] AC-H05-3: Given 主持人輸入 T ≤ 0、T > 30、T 非整數或 T 為非數字，When 系統驗證，Then 回傳 `INVALID_AUTO_REVEAL_INTERVAL` 錯誤並顯示「間隔須為 1～30 的整數」，不啟動自動揭曉。

---

### US-H06: 一鍵揭曉全部路徑

**As a** 主持人，**I want to** 一鍵揭曉全部路徑，**so that** 在時間緊迫時可以快速完成抽獎。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-H06-1: Given 狀態為 `revealing` 且尚有未揭曉路徑，When 主持人點擊「全部揭曉」，Then 伺服器廣播 `REVEAL_ALL`，所有客戶端同步播放剩餘所有路徑動畫，2 秒內完成渲染；若超過 2 秒，動畫立即跳至終止幀。
- [ ] AC-H06-2: Given `REVEAL_ALL` 廣播後，When 伺服器完成全部揭曉，Then 伺服器自動將 `revealedCount` 設為 `totalCount`，並立即觸發 `finished` 狀態轉換，廣播 `GAME_ENDED`（含 status: finished, seed, results[]）；無需主持人再次確認。
- [ ] AC-H06-3: Given 狀態為 `revealing` 且所有路徑已揭曉，When 主持人點擊「全部揭曉」，Then 系統不回應（按鈕 disabled）。

---

### US-H07: 踢除玩家

**As a** 主持人，**I want to** 踢除指定玩家，**so that** 我可以移除測試帳號或不當參與者。

**Priority**: P1

**Acceptance Criteria**:
- [ ] AC-H07-1: Given 房間狀態為 `waiting`，When 主持人對某玩家點擊「踢除」，Then 伺服器廣播 `PLAYER_KICKED`（含 playerId），被踢玩家跳轉至「你已被移出房間」頁面，玩家列表即時更新。
- [ ] AC-H07-2: Given 玩家被踢後，When 該玩家嘗試以相同 playerId 重連，Then 伺服器拒絕並回傳 `PLAYER_KICKED` 錯誤，不允許重新加入同一局。
- [ ] AC-H07-3: Given 房間狀態為 `running` 或之後，When 主持人嘗試踢除玩家，Then 系統拒絕並回傳 `INVALID_STATE` 錯誤（含 `KICK_NOT_ALLOWED_IN_STATE` 說明）。
- [ ] AC-H07-3b: Given 主持人嘗試踢除自己，When 系統驗證，Then 拒絕並回傳 `CANNOT_KICK_HOST` 錯誤。
- [ ] AC-H07-4: Given 玩家被踢除，When 踢除操作完成，Then 被踢玩家的 playerId 必須存在於 `kickedPlayerIds` 清單（Redis 持久化），同局內任何帶該 playerId 的重連嘗試均被拒絕並回傳 `PLAYER_KICKED`。
- [ ] AC-H07-5: Given 主持人點擊「再玩一局」，When 新局初始化完成，Then `kickedPlayerIds` 清空，前一局被踢者可使用任意暱稱以無 playerId 方式加入新局。

---

### US-H08: 再玩一局

**As a** 主持人，**I want to** 在一局結束後發起「再玩一局」，**so that** 我可以用同一房間繼續下一輪抽獎。

**Priority**: P1

**Acceptance Criteria**:
- [ ] AC-H08-1: Given 狀態為 `finished`，When 主持人點擊「再玩一局」，Then 系統剔除 `isOnline=false` 的玩家後，以剩餘在線玩家重置房間狀態為 `waiting`，並廣播新的 `ROOM_STATE`。
- [ ] AC-H08-2: Given 再玩一局後 W 越界，When 系統重置，Then W 被設為 null，主持人看到「請重新設定中獎名額」提示。
- [ ] AC-H08-3: Given 再玩一局後剩餘在線玩家數 < 2，When 主持人點擊「再玩一局」，Then 系統拒絕並回傳 `INSUFFICIENT_PLAYERS` 錯誤，前端提示「在線玩家不足（至少需要 2 位），無法開始新局」。
- [ ] AC-H08-4: Given 主持人的 JWT token 在 `waiting`/`running`/`revealing` 狀態中過期，When 主持人嘗試執行任何 Host 操作，Then 伺服器回傳 HTTP 401（含錯誤 `TOKEN_EXPIRED`），前端顯示「您的主持人身份已過期，請重新整理頁面重新獲取主持權」；其他玩家連線不受影響。

---

### US-H09: 複製邀請連結

**As a** 主持人，**I want to** 在等待大廳複製邀請連結，**so that** 參加者能快速加入房間。

**Priority**: P1

**Acceptance Criteria**:
- [ ] AC-H09-1: Given 房間狀態為 `waiting`，When 主持人在等待大廳頁面，Then 頁面顯示「複製邀請連結」按鈕，按鈕旁顯示完整邀請 URL（格式：`{origin}/?room={roomCode}`）。
- [ ] AC-H09-2: Given 主持人點擊「複製邀請連結」，When Clipboard API 執行成功，Then 按鈕短暫顯示「已複製！」（1.5 秒後恢復原文字），邀請 URL 複製至剪貼簿。
- [ ] AC-H09-3: Given Clipboard API 不可用（HTTP 環境或瀏覽器拒絕權限），When 主持人點擊複製，Then 顯示包含邀請 URL 的 `<input>` 文字框（已全選），供主持人手動複製。

---

### 玩家（Player）User Stories

---

### US-P01: 加入房間

**As a** 玩家，**I want to** 輸入暱稱並透過 6 碼房間碼加入房間，**so that** 我可以參與抽獎活動。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-P01-1: Given 玩家輸入有效暱稱（1～20 個 Unicode 字元）及正確 Room Code，When 送出後 WebSocket 握手成功，Then 從送出按鈕點擊起計 1.5 秒內進入等待畫面，玩家列表顯示自己的暱稱。
- [ ] AC-P01-2: Given 玩家輸入的暱稱與同房間已有玩家重複（暱稱比對區分大小寫），When 伺服器驗證，Then 回傳 `NICKNAME_TAKEN` 錯誤，提示「此暱稱已被使用，請換一個」。
- [ ] AC-P01-3: Given 玩家輸入空白暱稱或超過 20 字元，When 前端驗證，Then 即時顯示欄位錯誤訊息，送出按鈕保持 disabled；若前端驗證被繞過，伺服器端亦拒絕並回傳 `INVALID_NICKNAME` 錯誤。
- [ ] AC-P01-4: Given 房間人數已達 50 人上限，When 玩家嘗試加入，Then 伺服器回傳 `ROOM_FULL` 錯誤，玩家看到「房間已滿，無法加入」提示。
- [ ] AC-P01-5: Given 玩家透過邀請連結（含 `?room={roomCode}` URL 參數）進入頁面，When 頁面載入完成，Then Room Code 輸入框自動預填 URL 參數中的房間碼，玩家僅需輸入暱稱即可加入。
- [ ] AC-P01-6: Given 玩家曾經成功加入過任何房間，When 玩家再次進入加入頁面，Then 暱稱輸入框自動預填 localStorage 中儲存的上次暱稱（key: `ladder_last_nickname`）；Room Code 與暱稱均已預填時，「加入」按鈕呈現啟用狀態，玩家一鍵即可加入。

---

### US-P02: 觀看即時玩家列表更新

**As a** 玩家，**I want to** 在遊戲開始前看到即時更新的玩家列表，**so that** 我可以知道還有誰加入了房間。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-P02-1: Given 有新玩家加入房間，When 伺服器廣播 `ROOM_STATE`，Then 所有在線玩家的等待頁面在 2 秒內更新玩家列表（量測：從伺服器廣播 `ROOM_STATE` 時間戳起計，至其他客戶端玩家列表 DOM 更新完成）。
- [ ] AC-P02-2: Given 有玩家離線，When 伺服器偵測 WebSocket 斷線（TCP close 或 ping timeout ≤ 30 秒），Then 伺服器標記該玩家 `isOnline=false` 並廣播 `ROOM_STATE`，其他玩家列表中該玩家在 2 秒內顯示「離線」標記，不立即移除。

---

### US-P03: 觀看路徑揭曉動畫

**As a** 玩家，**I want to** 觀看自己路徑的揭曉動畫，**so that** 我可以體驗抽獎的緊張感。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-P03-1: Given 輪到自己的路徑揭曉（`REVEAL_INDEX` 指向自己），When 動畫播放，Then Canvas 高亮自己的路徑，動畫 FPS 桌機（1080p Chrome 最新穩定版）≥ 30、手機（Chrome DevTools Moto G4 throttling profile，10 秒錄製平均值）≥ 24。
- [ ] AC-P03-2: Given 其他玩家的路徑揭曉，When 動畫播放，Then 自己的路徑以灰色或淡色呈現，已揭曉玩家的結果在動畫結束後持久顯示於底部結果槽。

---

### US-P04: 確認中獎結果

**As a** 玩家，**I want to** 在結果揭曉後立即知道自己是否中獎，**so that** 我可以確認抽獎結果。

**Priority**: P0

**Acceptance Criteria**:
- [ ] AC-P04-1: Given 自己的路徑揭曉完畢，When 玩家路徑抵達底部結果槽，Then 畫面顯示「恭喜中獎！」或「未中獎」明確文字，且結果與伺服器端 `REVEAL_INDEX` payload 中 `result` 欄位一致。
- [ ] AC-P04-2: Given `REVEAL_ALL` 廣播後，When 所有動畫播放完畢，Then 每位玩家的螢幕均正確顯示自己的結果，無任何玩家的結果遺漏或錯誤。

---

### US-P05: 斷線後重連恢復狀態

**As a** 玩家，**I want to** 在斷線後能重新連上房間並恢復狀態，**so that** 我不會因網路波動而遺失參與資格。

**Priority**: P1

**Acceptance Criteria**:
- [ ] AC-P05-1: Given 玩家斷線後重新開啟頁面且 localStorage 中存有 `playerId`，When 玩家訪問房間連結，Then 系統以 `playerId` 自動重連，伺服器回傳完整房間狀態；重連時間 < 3 秒（量測：從頁面 DOMContentLoaded 事件起計，至收到伺服器回傳房間狀態快照並渲染完成）。
- [ ] AC-P05-2: Given 玩家重連時房間狀態已為 `revealing` 且部分路徑已揭曉，When 收到狀態快照，Then 客戶端直接呈現已揭曉的靜態結果，不重播已完成動畫。
- [ ] AC-P05-3: Given 玩家 localStorage 中 `playerId` 遺失（Ghost Player），When 玩家嘗試以原房間碼加入，Then 系統視為新玩家處理，若暱稱已存在則提示「暱稱已被使用」。

---

### US-P06: 被踢除後收到明確通知

**As a** 玩家，**I want to** 在被踢除後收到明確通知，**so that** 我可以了解自己已無法繼續參與。

**Priority**: P1

**Acceptance Criteria**:
- [ ] AC-P06-1: Given 伺服器廣播 `PLAYER_KICKED` 且 playerId 符合自己，When 客戶端收到訊息，Then 立即顯示「你已被主持人移出房間」提示，WebSocket 連線關閉，頁面提供「回首頁」按鈕。
- [ ] AC-P06-2: Given 玩家已被踢除，When 嘗試以相同 playerId 重連，Then 系統回傳 `PLAYER_KICKED` 錯誤，前端顯示「你已被移出此房間，無法重新加入」。

---

## §4 Functional Requirements

### FR-01: 房間管理 [P0]

對應 User Stories: US-H01, US-H02, US-H08

- **FR-01-1**: 系統須在 2 秒內生成唯一 6 碼 Room Code，字元集為 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（排除視覺混淆字元 O、I、0、1）。
- **FR-01-2**: Room Code 在 Redis 中以 TTL = 4 小時儲存，過期後自動釋放；碰撞則重試最多 10 次；超過 10 次回傳 `ROOM_CODE_GENERATION_FAILED`。
- **FR-01-3**: 每個房間對應一份完整狀態物件，包含：roomCode、title（string | null，0～50 字）、status、hostId、players[]、winnerCount、ladderMap、resultSlots、revealIndex、seed、rowCount。
- **FR-01-4**: 主持人建立房間後取得專屬 `token`（JWT），所有 Host 操作須附帶此 token 驗證。
- **FR-01-5**: 房間名稱（title）在 `waiting` 狀態下可由 Host 修改並即時廣播；`running` 後不可修改；非 `waiting` 狀態下的修改請求回傳 `TITLE_UPDATE_NOT_ALLOWED_IN_STATE`。

### FR-02: 玩家管理 [P0]

對應 User Stories: US-P01, US-P02

- **FR-02-1**: 玩家加入時伺服器生成唯一 `playerId`（UUID v4），回傳給前端存入 localStorage。
- **FR-02-2**: 暱稱須符合：1～20 個 Unicode 字元（禁止換行符及 null 字元）、同房間唯一；暱稱比對區分大小寫。
- **FR-02-3**: 同一房間最多允許 50 名玩家（含主持人）；超過上限時新連線回傳 `ROOM_FULL`。
- **FR-02-4**: 系統須維護玩家 `isOnline` 狀態，WebSocket 斷線後標記為 `isOnline=false`，保留其名額與路徑直至「再玩一局」。
- **FR-02-5**: Host 本人自動加入 players 陣列，也是抽獎玩家之一。

### FR-03: WebSocket 連線管理 [P0]

對應 User Stories: US-P02, US-P05

- **FR-03-1**: 伺服器 → 客戶端廣播事件：`ROOM_STATE`、`ROOM_STATE_FULL`、`REVEAL_INDEX`、`REVEAL_ALL`、`PLAYER_KICKED`、`SESSION_REPLACED`、`ERROR`。
- **FR-03-2**: 客戶端 → 伺服器操作：`START_GAME`、`UPDATE_WINNER_COUNT`、`BEGIN_REVEAL`、`REVEAL_NEXT`、`SET_AUTO_REVEAL`、`REVEAL_ALL`、`END_GAME`、`PLAY_AGAIN`、`KICK_PLAYER`、`JOIN_ROOM`、`RECONNECT`。
- **FR-03-3**: 所有 WebSocket 訊息格式為 JSON，包含 `type`、`payload` 欄位；伺服器須在 1 秒內回應或廣播。
- **FR-03-4**: `ERROR` 事件須包含 `code`（機器可讀）及 `message`（人類可讀）欄位。
- **FR-03-5**: WebSocket 訊息大小上限 64KB，超過則拒絕並關閉連線。

### FR-04: 梯子生成算法 [P0]

對應 User Stories: US-H03

- **FR-04-1**: 樓梯結構以 Mulberry32 PRNG 生成，seed 以 djb2 hash 將 seed 字串（UUID hex）轉為 uint32 初始化。
- **FR-04-2**: 橫槓生成規則：每 row 目標 `max(1, round(N/4))` 條橫槓；只連接相鄰欄位；同 row 橫槓不重疊（|a-b| ≤ 1 視為衝突）；每條橫槓最多嘗試 N×10 次。
- **FR-04-3**: `rowCount` 公式：`clamp(N×3, 20, 60)`（最小 20，最大 60）。
- **FR-04-4**: 結果槽指派須滿足 bijection（N 個起點對應 N 個唯一終點），以 Fisher-Yates 洗牌指派 W 個中獎槽位（消耗 N 次 PRNG）。
- **FR-04-5**: 樓梯資料由後端生成後序列化為 JSON 廣播至所有客戶端；前端僅負責渲染，不自行生成樓梯。
- **FR-04-6**: seed 及完整樓梯資料在 status=`finished` 前禁止傳送給任何客戶端（防止預測結果）。

### FR-05: 路徑計算 [P0]

對應 User Stories: US-H03, US-P03, US-P04

- **FR-05-1**: startColumn 指派：玩家依 `joinedAt` 由早到晚排序（相同時以 playerId 字典序升冪），依序指派打亂後的 startColumn。
- **FR-05-2**: 每位玩家從 startColumn 出發，遇到橫槓則移動至相鄰欄位，最終落點為 endColumn。
- **FR-05-3**: endColumn 查找 resultSlots 確定中獎/未中獎結果，計算結果（player.result）冗餘儲存於 Redis，客戶端直接使用廣播值。

### FR-06: 動畫系統 [P1]

對應 User Stories: US-P03, US-P04

- **FR-06-1**: 樓梯以 HTML5 Canvas 繪製，支援響應式尺寸（最小寬度 320px）。
- **FR-06-2**: 玩家路徑動畫以逐格方式播放，途經橫槓時路徑轉向。
- **FR-06-3**: 自己的路徑以高亮色顯示；其他玩家路徑以對應色顯示；未揭曉路徑以灰色虛線顯示。
- **FR-06-4**: Canvas 渲染以 `requestAnimationFrame` 驅動，在目標裝置達到規定 FPS 下限。
- **FR-06-5**: 每位玩家路徑顏色不同；每人一個顏色；半透明疊加；winner 顯示金色光暈效果。
- **FR-06-6**: `REVEAL_ALL` 廣播後，所有客戶端須在 2 秒內完成全部動畫渲染；若超過 2 秒，動畫立即跳至終止幀（final frame）。

### FR-07: 結果顯示 [P0]

對應 User Stories: US-P04, US-H06

- **FR-07-1**: 狀態轉為 `finished` 後，所有客戶端顯示完整得獎名單，主持人額外看到「再玩一局」按鈕。
- **FR-07-2**: 得獎名單依 startColumn 排序，顯示每位玩家暱稱及中獎/未中獎結果。
- **FR-07-3**: 中獎者路徑顯示金色光暈效果，未中獎者無特殊效果。

### FR-08: 本地儲存與用戶偏好 [P2]

對應 User Stories: US-P01, US-H09

- **FR-08-1**: 玩家加入成功後（WebSocket 握手成功），系統須將暱稱寫入 `localStorage.setItem('ladder_last_nickname', nickname)`。
- **FR-08-2**: 玩家加入頁面載入時讀取 `localStorage.getItem('ladder_last_nickname')`，若有值則自動預填暱稱欄位。
- **FR-08-3**: `playerId`（UUID v4）存於客戶端 localStorage，用於斷線重連身份驗證。
- **FR-08-4**: 玩家被踢除時，客戶端立即清除 localStorage 中的 playerId（live 路徑與重連路徑均需清除）。

### FR-09: 房間狀態機 [P0]

對應 User Stories: 全部

- **FR-09-1**: 房間狀態流轉：`waiting` → `running` → `revealing` → `finished` → `waiting`（再玩一局）。
- **FR-09-2**: 狀態轉換規則：
  - `waiting → running`：Host 點擊「開始遊戲」，Server 驗證 N ≥ 2 且 1 ≤ W ≤ N-1，以原子操作完成 seed 生成、ladderMap 計算、resultSlots 指派及 status 寫入。
  - `running → revealing`：Host 送出 `BEGIN_REVEAL`，Server 執行狀態轉換並廣播 `ROOM_STATE_FULL`。
  - `revealing → finished`：revealIndex 達到 N 後自動觸發（含一鍵全揭）。
  - `finished → waiting`：Host 送出 `PLAY_AGAIN`，剔除離線玩家後重置。
- **FR-09-3**: 非法狀態轉換由伺服器拒絕並回傳 `INVALID_STATE` 錯誤，不觸發任何廣播。
- **FR-09-4**: 每次狀態轉換須廣播對應事件給所有連線客戶端。

### FR-10: 斷線重連 [P1]

對應 User Stories: US-P05

- **FR-10-1**: 玩家重連時帶上 `playerId`，伺服器驗證後回傳對應房間狀態快照（依當前 status 決定欄位集合）。
- **FR-10-2**: Ghost Player 情境（localStorage 遺失）：玩家以無 `playerId` 方式加入，視為新玩家，暱稱若重複則提示衝突。
- **FR-10-3**: 同一 `playerId` 重複連線時，後來的連線更新 `isOnline=true`，舊 session 收到 `SESSION_REPLACED` 後斷線。
- **FR-10-4**: 重連時若房間狀態已為 `revealing` 且部分路徑已揭曉，客戶端直接呈現已揭曉的靜態結果，不重播已完成動畫。

### FR-11: 踢除玩家 [P1]

對應 User Stories: US-H07

- **FR-11-1**: 主持人發送踢除請求（含 playerId），伺服器驗證 hostToken 後廣播 `PLAYER_KICKED`。
- **FR-11-2**: 被踢玩家的 playerId 加入 `kickedPlayerIds` 清單（存於 Redis），同局有效；「再玩一局」後清空。
- **FR-11-3**: 踢除操作僅在 `waiting` 狀態允許；其他狀態伺服器拒絕並回傳 `INVALID_STATE` 錯誤。
- **FR-11-4**: Server 在送出 `PLAYER_KICKED` 事件後立即關閉被踢玩家的 WebSocket 連線。

### FR-12: 再玩一局 [P1]

對應 User Stories: US-H08

- **FR-12-1**: `PLAY_AGAIN` 觸發後，系統從玩家列表中移除 `isOnline=false` 的玩家，保留在線玩家並重置所有遊戲欄位。
- **FR-12-2**: W 若超出新 N-1 則重設為 null，通知主持人重新設定；kickedPlayerIds 清空。
- **FR-12-3**: 新局廣播完整 `ROOM_STATE`（status=`waiting`），剩餘玩家等待主持人設定並開始。

### FR-13: 揭曉控制 [P0]

對應 User Stories: US-H04, US-H05, US-H06

- **FR-13-1**: 手動模式：主持人每次點擊「下一位」，伺服器廣播 `REVEAL_INDEX`（含目前揭曉索引）。
- **FR-13-2**: 自動模式：主持人設定間隔 T（1 ≤ T ≤ 30 秒整數），伺服器每隔 T 秒廣播下一個 `REVEAL_INDEX`；切換回手動時停止計時。
- **FR-13-3**: 一鍵全揭：主持人觸發後廣播 `REVEAL_ALL`（含所有未揭曉路徑資料），客戶端於 2 秒內完成全部動畫渲染。
- **FR-13-4**: 揭曉順序由伺服器決定（依 startColumn 順序），所有客戶端依廣播順序渲染。

### FR-14: 邀請連結 [P2]

對應 User Stories: US-H09, US-P01

- **FR-14-1**: 房間碼輸入框須自動轉大寫，降低輸入錯誤率。
- **FR-14-2**: 玩家可透過 URL 參數（如 `?room=ABC123`）直接進入加入頁面並預填 Room Code。
- **FR-14-3**: 主持人等待大廳須顯示「複製邀請連結」按鈕，點擊後以 Clipboard API 將 `{origin}/?room={roomCode}` 寫入剪貼簿；Clipboard API 不可用時顯示可全選的 `<input>` 文字框作為 Fallback。
- **FR-14-4**: 邀請 URL 格式：`{origin}/?room={roomCode}`，其中 roomCode 為 6 碼大寫房間碼。

---

## §5 Non-Functional Requirements

### NFR-01: 效能

| 指標 | 目標值 | 量測方式 |
|------|--------|---------|
| Canvas 動畫 FPS（桌機） | ≥ 30fps | Chrome DevTools，50 人滿員房間，1080p Chrome |
| Canvas 動畫 FPS（手機） | ≥ 24fps | Chrome DevTools Moto G4 throttling profile，10 秒錄製平均值 |
| WebSocket 廣播延遲（P95） | < 2 秒 | 伺服器發出到客戶端完成狀態更新 |
| 房間建立 API 回應（P99） | < 2 秒 | Server 端計時 |
| 玩家加入 WebSocket 握手（P99） | < 1.5 秒 | Playwright 量測：click 至 waiting 元素可見 |
| 斷線重連時間（P95） | < 3 秒 | 頁面 DOMContentLoaded 至狀態快照渲染完成 |
| FCP（Simulated Slow 4G） | < 1.5 秒 | Lighthouse CI |
| LCP（Simulated Slow 4G） | < 2.5 秒 | Lighthouse CI |
| CLS | < 0.1 | Lighthouse CI |

### NFR-02: 並發與容量

| 指標 | 目標值 | 量測方式 |
|------|--------|---------|
| 並發房間數 | 100 個 | k6 模擬 100 房間 × 50 人 WebSocket 並發 |
| 每房間玩家數 | 50 人 | k6 壓力測試 |
| WebSocket 連線數 | 5,000 個 | k6 壓力測試 |
| 建立房間成功率 | > 99.5% | 正常負載下量測 |
| 玩家加入成功率 | > 99% | 正常負載下量測 |
| Redis 記憶體 | ~8.8 MB（100 房間） | 每房間 ~88 KB |

### NFR-03: 結果一致性

- 目標：100% 的局次中，所有在線客戶端顯示的最終結果與伺服器計算結果完全一致（0 容忍差異）。
- 量測：E2E 測試比對伺服器端廣播 payload 與各客戶端顯示結果；自動化跑 1,000 次亂數 seed 驗證 bijection 特性。

### NFR-04: 可靠性與斷線容忍

| 指標 | 目標值 |
|------|--------|
| 重連恢復成功率 | 100% |
| 重連完成時間（P95） | < 3 秒 |
| 主持人斷線容忍 | 主持人斷線後 60 秒內重連，其他玩家連線不中斷 |

### NFR-05: 安全性

| 安全需求 | 規格 |
|---------|------|
| JWT 認證 | 所有 Host 操作須驗證 JWT；非法/過期回傳 401；非 Host 回傳 403 |
| playerId 不可猜測 | UUID v4 |
| 踢除禁令持久化 | kickedPlayerIds 存於 Redis，同局有效 |
| WebSocket 訊息大小 | 上限 64KB，超過則拒絕並關閉連線 |
| seed 防洩漏 | seed 及完整樓梯資料在 status=`finished` 前禁止傳送給任何客戶端 |
| 自動揭示間隔驗證 | T 非整數或超出 1～30 秒範圍時回傳 `INVALID_AUTO_REVEAL_INTERVAL` |

### NFR-06: 前端效能預算

| 資源 | 目標值 | 量測方式 |
|------|--------|---------|
| 首頁 JS bundle（gzip） | < 80KB | Lighthouse CI bundle 分析 |
| 遊戲頁 JS bundle（gzip） | < 150KB | Lighthouse CI bundle 分析 |
| CSS | < 30KB | Lighthouse CI |

### NFR-07: 測試覆蓋率

- 後端單元測試覆蓋率 ≥ 80%（含 PRNG 算法、狀態機、WebSocket 事件處理）
- 前端單元測試覆蓋率 ≥ 70%（含 Canvas 渲染邏輯、事件解析）
- E2E 測試覆蓋所有 P0 User Story 的 Happy Path 及主要錯誤路徑
- 量測：Vitest coverage report（後端）+ Playwright E2E suite，CI 強制閘門

### NFR-08: 瀏覽器相容性

- 支援 Chrome 110+、Firefox 110+、Safari 15+；iOS Safari 15+ 與 Android Chrome 110+
- 在最小 320px 寬度裝置上核心遊戲流程可正常操作（無水平 overflow）

---

## §6 Edge Cases & Error Handling

### §6.1 斷線重連邊界情況

| 情境 | 預期行為 |
|------|---------|
| 玩家在 `waiting` 狀態斷線後重連 | 自動恢復等待大廳狀態，isOnline=true 更新並廣播 |
| 玩家在 `revealing` 狀態斷線後重連 | 回傳狀態快照，呈現已揭曉靜態結果，不重播動畫 |
| 玩家在 `finished` 狀態斷線後重連 | 回傳完整結算頁面狀態 |
| 同一 playerId 多分頁連線 | 後來的連線視為重連（更新 isOnline=true），舊 session 收到 `SESSION_REPLACED` 後斷線 |
| localStorage 遺失（Ghost Player） | 視為新玩家；`waiting` 狀態可輸入新暱稱加入；`running`/`revealing` 狀態回傳 `ROOM_NOT_JOINABLE` |

### §6.2 房間滿員與人數不足

| 情境 | 預期行為 |
|------|---------|
| 房間已達 50 人上限 | 新連線回傳 `ROOM_FULL`，顯示「房間已滿，無法加入」 |
| 開始遊戲時 N < 2 | 回傳 `INSUFFICIENT_PLAYERS`，顯示「人數不足（至少需要 2 位玩家）」 |
| 再玩一局後在線玩家 < 2 | 回傳 `INSUFFICIENT_PLAYERS`，不啟動新局 |

### §6.3 超時與回退

| 情境 | 預期行為 |
|------|---------|
| 原子寫入（`running` 狀態）逾時 10 秒未完成 | Server 清除部分已寫入資料，狀態回退至 `waiting`，廣播 `ROOM_STATE`（reason=`ROLLBACK_TIMEOUT`） |
| 原子寫入拋出異常 | Server 清除部分已寫入資料，狀態回退至 `waiting`，廣播 `ROOM_STATE`（reason=`ROLLBACK_ERROR`） |
| 客戶端 15 秒計時器先觸發（廣播遺失） | 顯示「連線逾時，請重新整理頁面」提示 |

### §6.4 暱稱衝突

| 情境 | 預期行為 |
|------|---------|
| 暱稱與在線玩家重複 | 回傳 `NICKNAME_TAKEN`，提示「此暱稱已被使用，請換一個」 |
| 暱稱與離線玩家（isOnline=false）重複 | 同樣回傳 `NICKNAME_TAKEN`（離線玩家暱稱在再玩一局前保留） |
| 被踢玩家暱稱 | 踢除後立即釋放，其他玩家可使用 |

### §6.5 防作弊邊界

| 情境 | 預期行為 |
|------|---------|
| 客戶端嘗試在 `finished` 前取得 seed | Server 不回傳 seed；seed 僅在 `finished` 狀態廣播 `ROOM_STATE` 時包含 |
| 同一 playerId 被踢後嘗試重連 | 回傳 `PLAYER_KICKED`，拒絕重連；被踢者需以全新 playerId（新暱稱）加入新局 |
| 非 Host 嘗試執行 Host 操作 | 回傳 HTTP 403 |
| JWT token 過期 | 回傳 HTTP 401（含 `TOKEN_EXPIRED`） |

### §6.6 主持人斷線期間

| 情境 | 預期行為 |
|------|---------|
| 主持人在 `waiting` 狀態斷線 | 房間維持 `waiting`，其他玩家連線不中斷；主持人重連後恢復控制權 |
| 主持人在 `revealing` 狀態斷線（自動揭曉進行中） | 自動揭曉計時器繼續（Server 端），主持人重連後可繼續控制 |
| 主持人斷線超過 60 秒 | 其他玩家仍保持連線，房間狀態維持；主持人以原 playerId 重連後恢復 |

---

## §7 Constraints & Dependencies

### §7.1 技術約束

| 約束 | 說明 |
|------|------|
| Node.js 20 LTS | Runtime 環境，不支援其他版本 |
| Redis 6+ | 唯一持久層，需支援 WATCH/MULTI/EXEC 原子操作 |
| Kubernetes（Rancher Desktop） | 本機開發環境；MVP 單一 Pod 部署 |
| Vanilla TypeScript + Vite | 前端技術棧，不使用 UI 框架（React/Vue 等） |
| WebSocket（ws 套件） | 即時通訊協定，不使用 Socket.IO |
| Fastify | HTTP 伺服器框架 |
| Monorepo 結構 | packages/server、packages/client、packages/shared |
| 繁體中文 UI | MVP 以繁體中文為唯一介面語言 |

### §7.2 MVP 不包含功能（Out of Scope）

1. **使用者帳號系統**：主持人身份以一次性 JWT token 管理
2. **行動原生 App（iOS / Android）**：MVP 僅支援行動瀏覽器
3. **觀眾模式（Spectator）**：所有連線者皆為 Host 或 Player
4. **多房間管理後台**：不提供管理員儀表板
5. **自訂獎品名稱或分組抽獎**：結果槽僅區分「中獎」與「未中獎」
6. **動畫主題或皮膚自訂**：使用單一視覺主題
7. **抽獎結果匯出（PDF / CSV）**：不提供結果下載
8. **國際化（i18n）多語言支援**：僅繁體中文
9. **多 Pod 水平擴展（HPA Multi-node）**：MVP 單一 Pod 部署
10. **聲音效果與背景音樂**：視覺動畫為唯一反饋形式

### §7.3 依賴項

| 依賴項 | 類型 | 說明 |
|-------|------|------|
| Node.js 20 LTS | 技術依賴 | Runtime 環境 |
| Redis 6+ | 基礎設施依賴 | 唯一持久層 |
| Kubernetes（Rancher Desktop） | 基礎設施依賴 | 本機開發環境 |
| GitHub Actions | CI/CD 依賴 | 自動化測試與部署 |
| Vitest | 測試依賴 | 後端覆蓋率 ≥ 80%，前端 ≥ 70% |
| Playwright | 測試依賴 | E2E 測試，覆蓋所有 P0 User Story |
| k6 | 壓測依賴 | WebSocket 並發壓力測試 |
| Lighthouse CI | 效能依賴 | 前端效能監控，每次 PR 自動量測 |

---

## §8 Open Questions

| # | 問題 | 狀態 | 影響範圍 |
|---|------|------|---------|
| OQ-01 | 台灣 PDPA 對暱稱/playerId 的適用性是否需要隱私聲明？ | [OPEN] | 合規、首頁設計 |
| OQ-02 | MVP 後商業模式：免費基礎版（15 人）+ 付費進階版（50 人），是否確認方向？ | [OPEN] | 商業模式 |
| OQ-03 | Post-MVP 是否需要觀眾模式（Spectator）？預計哪個 Sprint？ | [OPEN] | 範疇規劃 |
| OQ-04 | 抽獎結果匯出（PDF/CSV）的優先序？是否列入 Post-MVP P1？ | [OPEN] | 產品路線圖 |
| OQ-05 | 主持人斷線超過 60 秒後是否需要自動轉交主持權？或房間自動暫停？ | [OPEN] | 可靠性設計 |
| OQ-06 | `finished` 後 seed 公開是否需要主持人確認，或自動隨 `ROOM_STATE` 廣播？ | [OPEN] | 防作弊設計 |
| OQ-07 | 多語言支援（英文）是否列入 Post-MVP 路線圖？時程？ | [OPEN] | 國際化 |
| OQ-08 | k6 壓測中「100 房間 × 50 人」是否需要在 CI 強制閘門執行，或僅週期性執行？ | [OPEN] | CI/CD 設計 |

---

## Appendix: Requirement Traceability

### US → FR → BRD §X 對照表

| User Story | 功能需求 | BRD 來源 |
|-----------|---------|---------|
| US-H01：建立房間 | FR-01-1, FR-01-2, FR-01-3, FR-01-4 | BRD §3.4 REQ-01, §5.1 |
| US-H02：設定中獎名額 | FR-01-3, FR-09-2 | BRD §3.4 REQ-02, §5.1 |
| US-H03：開始遊戲 | FR-04-1～FR-04-6, FR-05-1～FR-05-3, FR-09-2 | BRD §3.4 REQ-03, §5.1 |
| US-H04：手動逐步揭曉 | FR-13-1, FR-13-4, FR-09-2 | BRD §3.4 REQ-04, §5.1 |
| US-H05：自動揭曉間隔 | FR-13-2, FR-09-3 | BRD §3.4 REQ-05, §5.1 |
| US-H06：一鍵全揭 | FR-13-3, FR-06-6, FR-07-1 | BRD §3.4 REQ-06, §5.1 |
| US-H07：踢除玩家 | FR-11-1～FR-11-4 | BRD §3.4 REQ-07, §5.1 |
| US-H08：再玩一局 | FR-12-1～FR-12-3 | BRD §3.4 REQ-08, §5.1 |
| US-H09：複製邀請連結 | FR-14-3, FR-14-4 | BRD §3.4 REQ-09, §5.1 |
| US-P01：加入房間 | FR-02-1～FR-02-3, FR-08-1～FR-08-2, FR-14-2 | BRD §3.4 REQ-10, REQ-11, §5.1 |
| US-P02：即時玩家列表 | FR-02-4, FR-03-1, FR-09-4 | BRD §3.4 REQ-12, §5.1 |
| US-P03：路徑揭曉動畫 | FR-06-1～FR-06-6 | BRD §3.4 REQ-13, §5.1 |
| US-P04：中獎結果確認 | FR-07-1～FR-07-3, FR-05-3 | BRD §3.4 REQ-14, §5.1 |
| US-P05：斷線重連 | FR-10-1～FR-10-4 | BRD §3.4 REQ-15, §5.1 |
| US-P06：被踢通知 | FR-08-4, FR-11-4 | BRD §3.4 REQ-16, §5.1 |

### 驗收標準優先序總表

| User Story | 優先級 | 狀態 |
|-----------|--------|------|
| US-H01：主持人建立房間並取得 6 碼 Room Code | P0 | 待開發 |
| US-H02：主持人設定中獎名額 W | P0 | 待開發 |
| US-H03：主持人開始遊戲 | P0 | 待開發 |
| US-H04：主持人手動逐步揭曉路徑 | P0 | 待開發 |
| US-H05：主持人設定自動揭曉間隔 | P1 | 待開發 |
| US-H06：主持人一鍵揭曉全部路徑 | P0 | 待開發 |
| US-H07：主持人踢除玩家 | P1 | 待開發 |
| US-H08：主持人發起再玩一局 | P1 | 待開發 |
| US-H09：主持人複製邀請連結 | P1 | 待開發 |
| US-P01：玩家輸入暱稱並加入房間 | P0 | 待開發 |
| US-P02：玩家觀看即時玩家列表更新 | P0 | 待開發 |
| US-P03：玩家觀看自己路徑的揭曉動畫 | P0 | 待開發 |
| US-P04：玩家確認自己的中獎結果 | P0 | 待開發 |
| US-P05：玩家斷線後重連恢復狀態 | P1 | 待開發 |
| US-P06：玩家被踢除後收到明確通知 | P1 | 待開發 |

---

*PRD 版本：v1.0*
*生成時間：2026-04-21*
*基於 BRD v1.0 + legacy-PRD v1.4 + legacy-PDD v2.2*
