# PRD — Ladder Room Online
**版本**：v1.0  **日期**：2026-04-19  **基於 PDD**：v2.1
**作者**：AI PM Agent  **狀態**：Draft
**利害關係人**：前端工程師、後端工程師、QA、設計師

---

## 執行摘要

Ladder Room Online 是一款基於 HTML5 Canvas 的多人線上爬樓梯抽獎遊戲，支援最多 50 人同房間即時參與。主持人建立房間並掌控揭曉節奏，玩家透過 6 碼房間碼加入並即時觀看路徑動畫；Mulberry32 PRNG 算法確保每局結果在所有客戶端 100% 一致，消除舞弊疑慮，適用於團隊抽獎、課堂點名、活動互動等場景。

---

## 使用者故事

### 主持人（Host）

- **US-H01**：作為主持人，我想要建立一個帶有唯一 6 碼房間碼的房間，以便玩家能快速找到並加入我的抽獎活動。
  - AC-H01-1：Given 主持人點擊「建立房間」，When 系統接受請求，Then 於 2 秒內回傳 6 碼 Room Code（字元集排除 0/O/1/I 等易混淆字元）且在 Redis 中不重複。
  - AC-H01-2：Given 房間建立成功，When 主持人進入房間，Then 頁面顯示 Room Code、目前玩家列表（空）、設定中獎名額的輸入框，狀態為 `waiting`。
  - AC-H01-3：Given 建立房間的請求因網路異常失敗，When 系統偵測到錯誤，Then 顯示「建立失敗，請重試」提示並保留輸入內容，不產生孤立房間。

- **US-H02**：作為主持人，我想要設定中獎名額（W），以便控制本局有多少玩家會獲獎。
  - AC-H02-1：Given 房間狀態為 `waiting`，When 主持人在輸入框填入 W（1 ≤ W < N，N 為目前玩家數），Then 系統接受並廣播更新後的 `ROOM_STATE` 給所有在線玩家。
  - AC-H02-2：Given 主持人輸入 W = 0 或 W ≥ N，When 主持人送出，Then 系統顯示「中獎名額須介於 1 到玩家數減 1 之間」錯誤，不更新狀態。
  - AC-H02-3：Given 再玩一局且剔除離線玩家後 W ≥ 新 N，When 系統偵測到越界，Then 自動將 W 重設為 null 並通知主持人「中獎名額已重設，請重新設定」。

- **US-H03**：作為主持人，我想要在所有玩家就緒後開始遊戲，以便正式進入揭曉流程。
  - AC-H03-1：Given 房間狀態為 `waiting` 且 N ≥ 2 且 W 已設定，When 主持人點擊「開始遊戲」，Then 狀態轉為 `running`，後端立即以 Mulberry32+djb2 seed 生成樓梯結構並廣播 `ROOM_STATE` 含樓梯資料。
  - AC-H03-2：Given 主持人點擊「開始遊戲」但 W 尚未設定，When 系統收到請求，Then 拒絕並回傳錯誤「請先設定中獎名額」，狀態維持 `waiting`。
  - AC-H03-3：Given 遊戲開始後，When 任何玩家（含主持人）收到 `ROOM_STATE`，Then 所有客戶端渲染的樓梯結構與橫槓位置完全一致，Canvas FPS 桌機 ≥ 30、手機 ≥ 24。

- **US-H04**：作為主持人，我想要以手動逐步揭曉每條路徑，以便配合現場節奏製造懸念。
  - AC-H04-1：Given 狀態為 `revealing`，When 主持人點擊「下一位」，Then 伺服器廣播 `REVEAL_INDEX`（含對應玩家 index），所有客戶端同步播放該玩家的行走動畫。
  - AC-H04-2：Given 所有路徑已逐步揭曉，When 主持人點擊「下一位」，Then 系統不回應（按鈕 disabled），狀態等待主持人觸發 `finished`。

- **US-H05**：作為主持人，我想要設定自動揭曉間隔（1～30 秒/格），以便讓遊戲在無人操作時自動進行。
  - AC-H05-1：Given 主持人選擇自動模式並設定間隔秒數 T（1 ≤ T ≤ 30），When 遊戲進入 `revealing`，Then 每隔 T 秒伺服器自動廣播下一個 `REVEAL_INDEX`，直到全部揭曉完畢。
  - AC-H05-2：Given 自動揭曉進行中，When 主持人切換回手動模式，Then 自動計時停止，改由主持人手動觸發後續揭曉，已揭曉項目不受影響。

- **US-H06**：作為主持人，我想要一鍵揭曉全部路徑，以便在時間緊迫時快速完成抽獎。
  - AC-H06-1：Given 狀態為 `revealing` 且尚有未揭曉路徑，When 主持人點擊「全部揭曉」，Then 伺服器廣播 `REVEAL_ALL`，所有客戶端同步播放剩餘所有路徑動畫（可壓縮時長），2 秒內完成渲染。
  - AC-H06-2：Given `REVEAL_ALL` 廣播後，When 動畫播放完畢，Then 狀態自動轉為 `finished`，顯示完整得獎名單。

- **US-H07**：作為主持人，我想要踢除指定玩家，以便移除測試帳號或不當參與者。
  - AC-H07-1：Given 房間狀態為 `waiting`，When 主持人對某玩家點擊「踢除」，Then 伺服器廣播 `PLAYER_KICKED`（含 playerId），被踢玩家收到後跳轉至「你已被移出房間」頁面，玩家列表即時更新。
  - AC-H07-2：Given 玩家被踢後，When 該玩家嘗試以相同 playerId 重連，Then 伺服器拒絕並回傳 `PLAYER_KICKED` 錯誤，不允許重新加入同一局。
  - AC-H07-3：Given 房間狀態為 `running` 或之後，When 主持人嘗試踢除玩家，Then 系統拒絕並回傳 `INVALID_STATE` 錯誤。

- **US-H08**：作為主持人，我想要在一局結束後發起「再玩一局」，以便用同一房間繼續下一輪抽獎。
  - AC-H08-1：Given 狀態為 `finished`，When 主持人點擊「再玩一局」，Then 系統剔除 `isOnline=false` 的玩家後，以剩餘在線玩家重置房間狀態為 `waiting`，並廣播新的 `ROOM_STATE`。
  - AC-H08-2：Given 再玩一局後 W 越界，When 系統重置，Then W 被設為 null，主持人看到「請重新設定中獎名額」提示。
  - AC-H08-3：Given 再玩一局時在線玩家數 < 2，When 主持人點擊「再玩一局」，Then 系統拒絕並提示「在線玩家不足，無法開始新局」。

---

### 玩家（Player）

- **US-P01**：作為玩家，我想要輸入暱稱並透過 6 碼房間碼加入房間，以便參與抽獎活動。
  - AC-P01-1：Given 玩家輸入有效暱稱（1～20 個 Unicode 字元）及正確 Room Code，When 送出後 WebSocket 握手成功，Then 1.5 秒內進入等待畫面，玩家列表顯示自己的暱稱。
  - AC-P01-2：Given 玩家輸入的暱稱與同房間已有玩家重複，When 伺服器驗證，Then 回傳 `NICKNAME_TAKEN` 錯誤，提示「此暱稱已被使用，請換一個」。
  - AC-P01-3：Given 玩家輸入空白暱稱或超過 20 字元，When 前端驗證，Then 即時顯示欄位錯誤訊息，送出按鈕保持 disabled。
  - AC-P01-4：Given 房間人數已達 50 人上限，When 玩家嘗試加入，Then 伺服器回傳 `ROOM_FULL` 錯誤，玩家看到「房間已滿，無法加入」提示。

- **US-P02**：作為玩家，我想要在遊戲開始前看到即時更新的玩家列表，以便知道還有誰加入了房間。
  - AC-P02-1：Given 有新玩家加入房間，When 伺服器廣播 `ROOM_STATE`，Then 所有在線玩家的等待頁面在 2 秒內更新玩家列表。
  - AC-P02-2：Given 有玩家離線，When 伺服器偵測 WebSocket 斷線，Then 其他玩家列表中該玩家顯示「離線」標記，不立即移除。

- **US-P03**：作為玩家，我想要觀看自己路徑的揭曉動畫，以便體驗抽獎的緊張感。
  - AC-P03-1：Given 輪到自己的路徑揭曉（`REVEAL_INDEX` 指向自己），When 動畫播放，Then Canvas 高亮自己的路徑，動畫 FPS 桌機 ≥ 30、手機 ≥ 24。
  - AC-P03-2：Given 其他玩家的路徑揭曉，When 動畫播放，Then 自己的路徑以灰色或淡色呈現，已揭曉玩家的結果在動畫結束後持久顯示於底部結果槽。

- **US-P04**：作為玩家，我想要在結果揭曉後立即知道自己是否中獎，以便確認抽獎結果。
  - AC-P04-1：Given 自己的路徑揭曉完畢，When 玩家路徑抵達底部結果槽，Then 畫面顯示「恭喜中獎！」或「未中獎」明確文字，且結果與伺服器端計算一致。
  - AC-P04-2：Given `REVEAL_ALL` 廣播後，When 所有動畫播放完畢，Then 每位玩家的螢幕均正確顯示自己的結果，無任何玩家的結果遺漏或錯誤。

- **US-P05**：作為玩家，我想要在斷線後能重新連上房間並恢復狀態，以便不因網路波動而遺失參與資格。
  - AC-P05-1：Given 玩家斷線後重新開啟頁面且 localStorage 中存有 `playerId`，When 玩家訪問房間連結，Then 系統以 `playerId` 自動重連，伺服器回傳完整房間狀態，重連時間 < 3 秒。
  - AC-P05-2：Given 玩家重連時房間狀態已為 `revealing` 且部分路徑已揭曉，When 收到狀態快照，Then 客戶端直接呈現已揭曉的靜態結果，不重播已完成動畫。
  - AC-P05-3：Given 玩家 localStorage 中 `playerId` 遺失（Ghost Player），When 玩家嘗試以原房間碼加入，Then 系統視為新玩家處理，若暱稱已存在則提示「暱稱已被使用」。

- **US-P06**：作為玩家，我想要在被踢除後收到明確通知，以便了解自己已無法繼續參與。
  - AC-P06-1：Given 伺服器廣播 `PLAYER_KICKED` 且 playerId 符合自己，When 客戶端收到訊息，Then 立即顯示「你已被主持人移出房間」提示，WebSocket 連線關閉，頁面提供「回首頁」按鈕。
  - AC-P06-2：Given 玩家已被踢除，When 嘗試以相同 playerId 重連，Then 系統回傳 `PLAYER_KICKED` 錯誤，前端顯示「你已被移出此房間，無法重新加入」。

---

## 功能需求

### FR-01 房間建立與管理 [P0]

- FR-01-1：系統須在 2 秒內生成唯一 6 碼 Room Code，字元集為大寫英數（排除 O/0/I/1 視覺混淆字元），共 32 字元集。
- FR-01-2：Room Code 在 Redis 中以 TTL = 4 小時儲存，過期後自動釋放；碰撞則重試最多 10 次（依 PDD §7.1）。
- FR-01-3：每個房間對應一份完整狀態物件，包含：roomCode、status、hostId、players[]、winnerCount、ladderMap、resultSlots、revealIndex、seed、rowCount。
- FR-01-4：主持人建立房間後取得專屬 `hostToken`（JWT），所有 Host 操作須附帶此 token 驗證。

### FR-02 玩家加入與身份管理 [P0]

- FR-02-1：玩家加入時伺服器生成唯一 `playerId`（UUID v4），回傳給前端存入 localStorage。
- FR-02-2：暱稱須符合：1～20 個 Unicode 字元（禁止換行符及 null 字元）、同房間唯一。
- FR-02-3：同一房間最多允許 50 名玩家（含主持人）；超過上限時新連線回傳 `ROOM_FULL`。
- FR-02-4：系統須維護玩家 `isOnline` 狀態，WebSocket 斷線後標記為 `isOnline=false`，保留其名額與路徑直至「再玩一局」。

### FR-03 樓梯生成算法 [P0]

- FR-03-1：樓梯結構以 Mulberry32 PRNG 生成，seed 以 djb2 hash 將 seed 字串（UUID hex）轉為 uint32 初始化。
- FR-03-2：橫槓生成規則：每 row 目標 max(1, round(N/4)) 條橫槓；只連接相鄰欄位；同 row 橫槓不重疊（|a-b| ≤ 1 視為衝突）；每條橫槓最多嘗試 N×10 次。
- FR-03-3：結果槽指派須滿足 bijection（N 個起點對應 N 個唯一終點），以 Fisher-Yates 洗牌指派 W 個中獎槽位（消耗 N 次 PRNG）。
- FR-03-4：樓梯資料由後端生成後序列化為 JSON 廣播至所有客戶端；前端僅負責渲染，不自行生成樓梯。

### FR-04 房間狀態機 [P0]

- FR-04-1：房間狀態流轉：`waiting` → `running` → `revealing` → `finished` → `waiting`（再玩一局）。
- FR-04-2：每次狀態轉換須廣播對應事件（`ROOM_STATE` 或 `ROOM_STATE_FULL`）給所有連線客戶端。
- FR-04-3：非法狀態轉換由伺服器拒絕並回傳 `INVALID_STATE` 錯誤，不觸發任何廣播。
- FR-04-4：`running→revealing` 為原子操作（ladderMap、resultSlots、所有 startColumn/endColumn/result、status 同時寫入）。

### FR-05 揭曉控制 [P0]

- FR-05-1：手動模式：主持人每次點擊「下一位」，伺服器廣播 `REVEAL_INDEX`（含目前揭曉索引）。
- FR-05-2：自動模式：主持人設定間隔 T（1 ≤ T ≤ 30 秒），伺服器每隔 T 秒廣播下一個 `REVEAL_INDEX`；切換回手動時停止計時。
- FR-05-3：一鍵全揭：主持人觸發後廣播 `REVEAL_ALL`（含所有未揭曉路徑資料），客戶端於 2 秒內完成全部動畫渲染。
- FR-05-4：揭曉順序由伺服器決定（依 startColumn 順序），所有客戶端依廣播順序渲染。

### FR-06 WebSocket 事件規格 [P0]

- FR-06-1：伺服器 → 客戶端事件：`ROOM_STATE`、`ROOM_STATE_FULL`、`REVEAL_INDEX`、`REVEAL_ALL`、`PLAYER_KICKED`、`SESSION_REPLACED`、`ERROR`。
- FR-06-2：客戶端 → 伺服器：透過 HTTP REST 端點或 WebSocket 訊息發送操作指令。
- FR-06-3：所有 WebSocket 訊息格式為 JSON，包含 `type`、`payload` 欄位；伺服器須在 1 秒內回應或廣播。
- FR-06-4：`ERROR` 事件須包含 `code`（機器可讀）及 `message`（人類可讀）欄位。

### FR-07 斷線重連 [P1]

- FR-07-1：玩家重連時帶上 `playerId`，伺服器驗證後回傳對應房間狀態快照（依當前 status 決定欄位集合）。
- FR-07-2：Ghost Player 情境（localStorage 遺失）：玩家以無 `playerId` 方式加入，視為新玩家，暱稱若重複則提示衝突。
- FR-07-3：同一 `playerId` 重複連線時，後來的連線更新 `isOnline=true`，舊 session 收到 `SESSION_REPLACED` 後斷線。

### FR-08 再玩一局 [P1]

- FR-08-1：`PLAY_AGAIN` 觸發後，系統從玩家列表中移除 `isOnline=false` 的玩家，保留在線玩家並重置所有遊戲欄位。
- FR-08-2：W 若超出新 N-1 則重設為 null，通知主持人重新設定；kickedPlayerIds 清空。
- FR-08-3：新局廣播完整 `ROOM_STATE`（status=`waiting`），剩餘玩家等待主持人設定並開始。

### FR-09 踢除玩家 [P1]

- FR-09-1：主持人發送踢除請求（含 playerId），伺服器驗證 hostToken 後廣播 `PLAYER_KICKED`。
- FR-09-2：被踢玩家的 playerId 加入 `kickedPlayerIds` 清單（存於 Redis），同局有效；「再玩一局」後清空。
- FR-09-3：踢除操作僅在 `waiting` 狀態允許；其他狀態伺服器拒絕並回傳 `INVALID_STATE` 錯誤。

### FR-10 Canvas 動畫渲染 [P1]

- FR-10-1：樓梯以 HTML5 Canvas 繪製，支援響應式尺寸（最小寬度 320px）。
- FR-10-2：玩家路徑動畫以逐格方式播放，途經橫槓時路徑轉向。
- FR-10-3：自己的路徑以高亮色顯示；其他玩家路徑以對應色顯示；未揭曉路徑以灰色虛線顯示。
- FR-10-4：Canvas 渲染以 `requestAnimationFrame` 驅動，在目標裝置達到規定 FPS 下限。

### FR-11 房間碼輸入體驗 [P2]

- FR-11-1：房間碼輸入框須自動轉大寫，降低輸入錯誤率。
- FR-11-2：玩家可透過 URL 參數（如 `?room=ABC123`）直接進入加入頁面並預填 Room Code。

### FR-12 得獎名單展示 [P2]

- FR-12-1：狀態轉為 `finished` 後，所有客戶端顯示完整得獎名單，主持人額外看到「再玩一局」按鈕。
- FR-12-2：得獎名單依 startColumn 排序，顯示每位玩家暱稱及中獎/未中獎結果。

---

## 非功能需求

### NFR-01 效能
- 目標：Canvas 動畫桌機 ≥ 30fps；Snapdragon 720G 及 iPhone 11 等級手機 ≥ 24fps（50 人滿員房間）。
- 目標：WebSocket 廣播端對端延遲（伺服器發出到客戶端完成狀態更新）< 2 秒（P95）。
- 目標：房間建立 API 回應時間 < 2 秒（P99）；玩家加入 WebSocket 握手完成 < 1.5 秒（P99）。
- 量測：Playwright 在目標裝置錄製 FPS；WebSocket 打點計算端對端延遲。

### NFR-02 並發與容量
- 目標：單一伺服器實例支援 100 個並發房間、每房間最多 50 人，共 5,000 個 WebSocket 連線。
- 目標：房間建立成功率 > 99.5%；玩家加入成功率 > 99%（正常負載下）。
- 量測：k6 模擬 100 房間 × 50 人的 WebSocket 並發場景，量測成功率與錯誤率。

### NFR-03 結果一致性
- 目標：100% 的局次中，所有在線客戶端顯示的最終結果與伺服器計算結果完全一致（0 容忍差異）。
- 量測：E2E 測試比對伺服器端廣播 payload 與各客戶端顯示結果；自動化跑 1,000 次亂數 seed 驗證 bijection 特性。

### NFR-04 可靠性與斷線容忍
- 目標：玩家斷線後重連，房間狀態恢復率 100%；重連完成時間 < 3 秒（P95）。
- 目標：主持人斷線後 60 秒內重連不影響其他玩家連線狀態。
- 量測：自動化測試模擬 WebSocket 強制斷線並量測重連與狀態同步時間。

### NFR-05 安全性
- 目標：所有 Host 操作須驗證 `hostToken`，非法請求回傳 403。
- 目標：玩家 `playerId` 為 UUID v4（不可猜測）；kickedPlayerIds 機制確保被踢玩家無法在同局重連。
- 目標：WebSocket 訊息大小上限 64KB，超過則拒絕並關閉連線。
- 量測：手動滲透測試驗證 JWT 驗證、輸入邊界與黑名單機制。

### NFR-06 前端效能預算
- 目標：首頁 JS bundle（gzip）< 80KB；遊戲頁面 JS bundle（gzip）< 150KB；CSS < 30KB。
- 目標：FCP < 1.5 秒（4G 網路）；LCP < 2.5 秒；CLS < 0.1。
- 量測：Lighthouse CI 整合於 CI/CD pipeline，每次 PR 自動量測並阻擋超標版本。

### NFR-07 測試覆蓋率
- 目標：後端單元測試覆蓋率 ≥ 80%（含 PRNG 算法、狀態機、WebSocket 事件處理）。
- 目標：前端單元測試覆蓋率 ≥ 70%（含 Canvas 渲染邏輯、事件解析）。
- 目標：E2E 測試覆蓋所有 P0 User Story 的 Happy Path 及主要錯誤路徑。
- 量測：Vitest coverage report（後端）+ Playwright E2E suite，CI 強制閘門。

### NFR-08 瀏覽器相容性
- 目標：支援 Chrome 110+、Firefox 110+、Safari 15+；iOS Safari 15+ 與 Android Chrome 110+。
- 目標：在最小 320px 寬度裝置上核心遊戲流程可正常操作（無水平 overflow）。
- 量測：Playwright 跨瀏覽器 E2E 測試。

---

## 驗收標準總表

| US | Story | 優先級 | 狀態 |
|----|-------|--------|------|
| US-H01 | 主持人建立房間並取得 6 碼 Room Code | P0 | 待開發 |
| US-H02 | 主持人設定中獎名額 W | P0 | 待開發 |
| US-H03 | 主持人開始遊戲 | P0 | 待開發 |
| US-H04 | 主持人手動逐步揭曉路徑 | P0 | 待開發 |
| US-H05 | 主持人設定自動揭曉間隔 | P1 | 待開發 |
| US-H06 | 主持人一鍵揭曉全部路徑 | P0 | 待開發 |
| US-H07 | 主持人踢除玩家 | P1 | 待開發 |
| US-H08 | 主持人發起再玩一局 | P1 | 待開發 |
| US-P01 | 玩家輸入暱稱並加入房間 | P0 | 待開發 |
| US-P02 | 玩家觀看即時玩家列表更新 | P0 | 待開發 |
| US-P03 | 玩家觀看自己路徑的揭曉動畫 | P0 | 待開發 |
| US-P04 | 玩家確認自己的中獎結果 | P0 | 待開發 |
| US-P05 | 玩家斷線後重連恢復狀態 | P1 | 待開發 |
| US-P06 | 玩家被踢除後收到明確通知 | P1 | 待開發 |

---

## 不在範圍（Out of Scope）

1. **使用者帳號系統**：MVP 不實作登入、註冊、歷史紀錄查詢；主持人身份以一次性 JWT token 管理。
2. **行動原生 App（iOS / Android）**：MVP 僅支援行動瀏覽器（Mobile Web）。
3. **觀眾模式（Spectator）**：MVP 不支援純觀看不參與的角色；所有連線者皆為 Host 或 Player。
4. **多房間管理後台**：MVP 不提供管理員儀表板。
5. **自訂獎品名稱或分組抽獎**：MVP 結果槽僅區分「中獎」與「未中獎」，不支援多獎項層級。
6. **動畫主題或皮膚自訂**：MVP 使用單一視覺主題。
7. **抽獎結果匯出（PDF / CSV）**：MVP 不提供結果下載功能。
8. **國際化（i18n）多語言支援**：MVP 以繁體中文為唯一介面語言。
9. **伺服器端水平擴展（Multi-node clustering）**：MVP 以單一 Node.js 實例部署。
10. **聲音效果與背景音樂**：MVP 不包含音效；視覺動畫為唯一反饋形式。

---

*PRD 版本：v1.0*  
*生成時間：2026-04-19*  
*基於 PDD v2.1（Ladder Room Online）*
