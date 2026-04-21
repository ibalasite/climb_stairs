# HTML5 線上多人爬樓梯遊戲 PDD

**產品名稱**：Ladder Room Online  
**版本**：v2.2（對應產品 MVP v1）  
**產品類型**：多人線上房間制抽獎／派對互動遊戲  
**核心玩法參考**：LINE 爬樓梯遊戲  
**文件狀態**：Draft

---

## 1. 產品概述

Ladder Room Online 是一款基於 LINE 爬樓梯玩法的 **HTML5 線上多人互動遊戲**。玩家可從不同地點使用瀏覽器進入同一個 Room，等待主持人開始。主持人設定中獎名額後，系統隨機生成樓梯，所有玩家沿各自起點向下走，最終對應到底部的中獎或未中獎結果。

**一句話定義**：一款以 LINE 爬樓梯規則為基礎，支援異地玩家加入同一 Room，由主持人控制開局與揭曉的 HTML5 線上多人抽獎遊戲。

---

## 2. 產品背景

### 2.1 現有問題

LINE 爬樓梯遊戲是常見的抽獎互動形式，但原生版本存在以下限制：

| 問題 | 說明 |
|------|------|
| 人數限制 | 超過一定人數後只顯示結果，不顯示完整走線過程 |
| 視覺不完整 | 人數多時畫面顯示不完整 |
| 規則僵化 | 難以自訂房間機制與獎項規則 |
| 無法獨立部署 | 不適合作為獨立品牌活動頁或大型線上互動玩法 |

### 2.2 為何現在做

線上活動、尾牙、直播互動需求日增，需要一個可獨立部署、支援異地多人的解決方案。

---

## 3. 產品目標

### 3.1 核心目標

建立一個支援多人異地加入的爬樓梯遊戲系統，具備：

- 玩家可透過 Room Code / 連結加入房間
- 主持人可建立房間並控制開局
- 主持人可設定中獎名額
- 開始後產生唯一且固定的樓梯地圖
- 所有玩家共享同一組樓梯結構與結果邏輯
- 每位玩家可看到自己的走線與最終結果
- 主持人可查看完整得獎名單

### 3.2 體驗目標

- 玩法直觀，接近 LINE 爬樓梯熟悉體驗
- 正常活動規模支援 30 人，系統設計上限 50 人
- 適合直播、尾牙、線上社群活動、會議抽獎
- 房間操作簡單，玩家加入門檻低

### 3.3 成功指標

| 指標 | 目標 | 量測方式 |
|------|------|----------|
| 建立房間成功率 | > 99.5% | Server 端請求成功率（排除基礎設施故障期間） |
| 玩家加入成功率 | > 99% | 玩家加入請求成功率 |
| 同房間設計上限人數 | 50 人 | 壓力測試（50 並發連線） |
| 開局後結果一致性 | 100%（所有端一致） | 多客戶端結果比對 |
| 揭曉動畫流暢度 | 無卡頓（桌機 ≥ 30fps；手機 ≥ 24fps） | Chrome DevTools FPS 量測；**測試條件**：桌機 Chrome（最新版）、50 人滿員房間（設計上限）、一般 WiFi 網路；手機端以近 4 年內 mid-range Android 裝置（Snapdragon 720G 等級）及 iPhone 11 以上為基準，目標 ≥ 24fps（動畫降速仍可接受），低於此門檻視為效能問題需修復 |
| 房間同步延遲 | 體感 < 2 秒 | 訊息從寫入到所有端接收的時間差 |

---

## 4. 產品定位

**定位**：線上房間制互動抽獎遊戲，屬於「活動遊戲工具」而非競技遊戲。

**定位關鍵字**：Party Game、Lottery Game、Event Interaction Tool、Room-based Mini Game

---

## 5. 角色定義

### 5.1 主持人（Host）

**情境**：需要在活動中主持一場公平的多人抽獎

**權限**：
- 建立房間
- 設定中獎名額
- 開始遊戲
- 控制揭曉節奏（手動 / 自動 / 一鍵全揭）
- 查看最終結果與得獎名單

**核心需求**：
- 快速建立活動（1 分鐘內可開局）
- 即時看到誰已加入
- 保證結果公平
- 適合投影或直播展示

### 5.2 玩家（Player）

**情境**：收到邀請連結，透過瀏覽器加入活動

**權限**：
- 輸入名稱加入房間
- 等待遊戲開始
- 觀看公開揭曉
- 查看自己的最終結果

**核心需求**：
- 加入簡單（10 秒內可完成）
- 不需安裝 App
- 手機或電腦均可參與
- 能感受到抽獎過程的期待感

---

## 6. 核心玩法規則

### 6.1 基礎規則

延續 LINE 爬樓梯遊戲邏輯：

1. 每位玩家對應一條起始垂直線（startColumn，由左至右從 0 編號）
2. 樓梯中間隨機產生橫槓，橫槓只連接相鄰欄位
3. 玩家路徑從上往下逐 row 走
4. 遇橫槓即移動到左右相鄰線（橫槓為雙向，來自任一端均移動至對面欄）
5. 最終落到下方某個結果槽位
6. 結果槽位代表中獎 / 未中獎

### 6.2 開局規則

1. Host 建立 Room（Host 本人自動加入 players 陣列，也是抽獎玩家之一）
2. 其他玩家陸續加入（加上 Host 共至少 2 人才可開局）
3. Host 設定中獎名額（W，規則：1 ≤ W ≤ N-1，N 為當前 players 陣列長度；「W == null」僅在建立房間後尚未設定中獎名額時出現，即首局開始前；再玩一局後 winnerCount 必定為整數，此分支不會觸發）
4. Host 確認人數後按下「開始遊戲」
5. Server 端重新驗證 N ≥ 2 且 1 ≤ W ≤ N-1（防止開始瞬間有人離開造成 W 越界）；**N 為 players 陣列當前長度，不論 isOnline 狀態，含斷線玩家**；驗證失敗則回傳錯誤，Room 維持 `waiting`，Host 端顯示對應提示訊息：N < 2 時顯示「人數不足（至少需要 2 位玩家）」；W == null 時顯示「請先設定中獎名額」；W ≤ 0 時顯示「中獎名額不合法（須大於 0），請設定 1 到 N-1 之間的值」（措辭與 §14 `WINNER_COUNT_INVALID_AT_START` 一致；涵蓋 W=0 與 W<0 兩種情況，「不得為 0」措辭在 W<0 時不準確）；W ≥ N 時顯示「中獎名額不合法，請重新設定後再開局」；**錯誤回應中需包含 Server 端驗證時的實際 N 值**，客戶端以此 N 顯示提示訊息（不依賴後續 `ROOM_STATE` 廣播中的 N），確保提示文字中的人數與錯誤當下的實際人數一致
6. 驗證通過後系統凍結玩家名單（開始後不可新增或移除玩家）及 winnerCount（`running` 後不可更改，見 §11.2 防作弊需求；Server 應拒絕 `running`/`revealing`/`finished` 狀態下的 winnerCount 更新請求），並在 Room.status = `running` 的 **DB 寫入 commit ACK 到達後**立即將廣播送出至所有端（客戶端顯示「遊戲開始中，請稍候…」過渡畫面；此時 15 秒逾時計時開始，見 §8.3）；**廣播時序**：commit ACK 後廣播隨即送出，與 §7.1 rollback 說明「Server 計時從 commit ACK 後起算，廣播隨即送出」對稱——兩個方向的廣播均在 DB commit 確認後才送出，不採樂觀廣播（pre-commit broadcast）；**此廣播使用 `ROOM_STATE` 事件，廣播欄位列表詳見 §14 `ROOM_STATE` payload「waiting→running 廣播」規格**（必須包含完整 players 陣列、winnerCount、hostId 等）
7. Host 點擊「揭示結果」→ Server 收到 `BEGIN_REVEAL` 訊息後，以單一原子操作生成本局唯一隨機種子（seed），將 [0..N-1] 以 seed 作為亂數來源隨機打亂後，依 **players 陣列的 joinedAt 由早到晚排序**（joinedAt 相同時以 playerId 字典序升冪作為次要排序鍵，確保排序結果確定性）**依序指派**（即打亂後的第 i 個值指派給 joinedAt 排序第 i 位的玩家）給每位玩家作為 startColumn（此排序與 Lobby 顯示順序一致，確保相同 seed 可完全重現相同的 startColumn 指派結果），寫入 seed、rowCount、ladderMap、resultSlots、每位玩家的 startColumn、endColumn **及 result**，**以及 Room.status = `revealing`**（此原子操作將 status 從 `running` 更新為 `revealing`，資料寫入與 status 更新不可分割；player.result 為冗餘儲存欄位，由 endColumn 查找 resultSlots 計算後一併寫入，客戶端直接使用廣播值，不需自行計算；**revealIndex 不在本原子操作寫入範圍內**，進入 `revealing` 後 revealIndex 仍為 0，待 Host 主動觸發後才遞增；seed 不在 `revealing` 前傳送至任何客戶端，待 `finished` 結算頁才可選擇性公開，見 §11.1）；原子操作完成後廣播 `ROOM_STATE_FULL` 給所有連線
8. 進入揭曉流程

> **注意**：再玩一局後 Host 再次點擊「開始遊戲」時，Server 端執行與本節步驟 5-8 完全相同的驗證與原子寫入流程，生成規則一致。

### 6.3 中獎規則

- 若玩家數為 N，中獎名額為 W（合法範圍：1 ≤ W ≤ N-1）
- W < N 時必有未中獎者；W = N 時不合法（全員中獎等同無抽獎意義）
- 底部共有 N 個結果位置
- 其中 W 個位置標記為「中獎」，其餘標記為「未中獎」
- 每位玩家沿同一份樓梯行走後，依最終落點判定是否中獎

---

## 7. 功能需求

### 7.1 房間系統

#### 建立房間

- Host 填寫暱稱（必填，1~20 個 Unicode 碼位，禁止換行符及 null 字元）後建立房間；Server 同步生成 Host 的 playerId 並將 Host 加入 players 陣列；玩家暱稱限制相同（1~20 個 Unicode 碼位，禁止換行符及 null 字元）；房間名稱（title）限制 0~50 個 Unicode 碼位（同樣禁止換行符及 null 字元）
- 系統產生唯一 Room ID、Room Code（6 碼）、Join URL
- Room Code 字元集：大寫英文字母（A-Z 排除 O、I）＋數字（2-9，排除 0 與 1），共 32 個字元（24 字母 + 8 數字），排除原則為避免視覺混淆（O/0、I/1）
- Room Code 碰撞時系統自動重試生成，最多重試 10 次；超過 10 次仍碰撞則回傳 500 錯誤
- 範例：Room Code `A7K29M`，Join URL `/room/A7K29M`
- 房間名稱（title）在 `waiting` 狀態下可由 Host 修改並即時廣播至所有已加入的客戶端（即已取得 playerId 並在等待室中的玩家）；尚未提交暱稱的訪客看到的 title 為頁面初始載入時的值；`running` 後不可修改；**若 title 修改請求在非 `waiting` 狀態下到達 Server，Server 靜默拒絕並回傳 `TITLE_UPDATE_NOT_ALLOWED_IN_STATE` 錯誤；客戶端不顯示錯誤（`running` 後 title 輸入框應已隱藏或禁用）；若發生競態（客戶端提交時為 `waiting`，Server 處理時已轉為 `running`），行為同上（靜默忽略）**

#### 加入房間

玩家可透過以下方式加入：
- 輸入 Room Code
- 點擊邀請連結

加入後需填寫：
- 暱稱（必填）

**暱稱唯一性規則**：同一局玩家名單（含 isOnline=false 的斷線玩家）中暱稱不可重複；已被 Host 踢除的玩家暱稱立即釋放。再玩一局後，因 isOnline=false 而被移除的玩家之暱稱視為已釋放，新玩家（或重新加入的玩家）可使用相同暱稱加入。**Ghost player 暱稱釋放鏈**：若 ghost player（localStorage 已清除、以無 playerId 身分訪問）在 `finished` 狀態到達，Server 回傳 `ROOM_FINISHED`，客戶端以訪客身分建立匿名 WebSocket 監聽廣播；Host 按「再玩一局」後，Server 廣播 `waiting`：(1) ghost 的舊 playerId（isOnline=false）從 players 陣列移除，(2) 其暱稱同步釋放，(3) 客戶端收到 `waiting` 廣播後自動恢復加入頁面，ghost player 可使用原暱稱或新暱稱加入新局。**`finished` 狀態錯誤碼區分**：無 playerId（localStorage 已清除）→ `ROOM_FINISHED`；帶過期 playerId（不在 players 且不在 kickedPlayerIds）→ `PLAYER_NOT_IN_ROOM`；兩者最終行為相同（匿名 session 等待 `waiting` 廣播，見 §14），但錯誤碼不同，工程師須分別在客戶端 handler 中處理。

**被踢除玩家規則**：玩家被踢除時，若其客戶端仍處於連線中，Server 立即推送 `PLAYER_KICKED` 事件至該玩家的 session；客戶端**立即清除 localStorage 中的 playerId**，顯示提示「你已被主持人移除」，並在 3 秒後導回首頁（不導至加入頁——被踢除者不一定希望立即重新加入同一房間，首頁讓使用者自行決定下一步行動）；**live 路徑與重連路徑（§14 `PLAYER_KICKED` 錯誤碼）均需清除 localStorage**——若 live 路徑不清除，被踢玩家 3 秒後返回首頁、再次訪問同一房間連結時，舊 playerId 仍存於 localStorage，Server 仍回傳 `PLAYER_KICKED` 重連錯誤，需額外一次清除流程，UX 多一層障礙；兩路徑行為應保持一致；**Server 在送出 `PLAYER_KICKED` 事件後立即關閉被踢玩家的 WebSocket 連線**（不等待客戶端自行斷線）——關閉連線觸發 isOnline=false 事件，Server 廣播 `ROOM_STATE`（isOnline=false）至剩餘玩家，確保被踢玩家不以「仍連線」狀態在其他客戶端的玩家名單中短暫可見；**isOnline 的 false 更新廣播由連線關閉事件自然觸發，不需要 Server 額外發送**（與一般斷線行為相同）。客戶端收到 `PLAYER_KICKED` 後應立即清除 localStorage 並開始 3 秒倒數 UI，此時 WebSocket 連線已由 Server 關閉，客戶端不再收到任何房間廣播；3 秒倒數完成後才導回首頁，被踢除玩家的頁面不因 Host 按「再玩一局」而自動恢復操作狀態。若玩家離線後重連並帶上原 playerId，Server 回傳 `PLAYER_KICKED` 錯誤；客戶端清除 localStorage；**依房間當時狀態分兩條路徑（詳見 §14 `PLAYER_KICKED` 錯誤碼路徑 ①②）**：① `waiting` 狀態——顯示「你已被主持人移除，請使用新暱稱重新加入」，保留可操作加入頁；② `running`/`revealing`/`finished` 狀態——顯示靜態提示頁（不顯示可操作加入頁，因提交加入請求必然失敗）；**此行為（保留可操作加入頁）僅適用於 `waiting` 狀態重連，非所有重連情境的通用行為**。被踢除的玩家可清除 localStorage 並使用新暱稱重新加入（視同新玩家）。被踢除禁令（`PLAYER_KICKED`）以一局為單位：Host 按「再玩一局」觸發 `waiting` 重置後（kickedPlayerIds 清空），前一局被踢除的玩家禁令自動解除（不再被視為被踢除）；但由於其原 playerId 同時因 isOnline=false 而被移除出 players 陣列（見 §7.6），重連時 Server 回傳 `PLAYER_NOT_IN_ROOM`（非 `PLAYER_KICKED`），客戶端清除 localStorage 並引導玩家以新暱稱加入新局（詳見本段末尾「被踢除禁令解除後的 playerId 重連」說明）。

**玩家身分識別**：玩家首次加入時，Server 生成 UUID 作為 `playerId` 並透過 response 回傳給客戶端，客戶端存入 localStorage。重連時客戶端帶上 `playerId` 完成身分驗證，同一 `playerId` 不可在同一房間重複加入。**多分頁同 playerId 處理**：若同一 playerId 已有連線 session，Server 視後來的連線為重連（更新 isOnline=true），舊 session 收到 `SESSION_REPLACED` 訊息後斷線。**localStorage 遺失的玩家（ghost player）**：若玩家清除 localStorage 後以無 playerId 的方式重新訪問，其舊 playerId 仍保留在 players 陣列中，以 isOnline=false 的斷線玩家身分計入 N、佔用暱稱（至「再玩一局」前）、並在開始遊戲時獲得 startColumn 及 result（其揭曉畫面如同一般斷線玩家）；該玩家的新訪問視同全新訪客：在 `waiting` 狀態下可輸入新暱稱加入，取得新 playerId，成為額外的 players 成員。**Ghost 雙槽公平性說明**：在此情況下，同一物理玩家同時佔有舊 ghost 槽（isOnline=false）與新槽（isOnline=true），兩個槽均獲得獨立的 startColumn 與抽獎結果，相當於該玩家擁有雙重抽獎機會。Lobby 顯示中，新入房的玩家與 ghost 槽各自呈現，Host 可見兩筆記錄（一筆離線標示、一筆正常連線）。Host 知情後可選擇踢除其中一筆。MVP 不自動阻止此情況，Host 需自行判斷並管理。在 `running`/`revealing` 狀態下回傳 `ROOM_NOT_JOINABLE`，提示「此房間遊戲已開始，無法加入」；在 `finished` 狀態下回傳相應提示「此房間遊戲已結束，請等待主持人開啟下一局後再加入」，客戶端監聽 `waiting` 廣播後自動恢復加入頁面操作。**被踢除禁令解除後的 playerId 重連**：再玩一局後 kickedPlayerIds 清空，前一局被踢除的玩家以原 playerId 重連時，其 playerId 已不在 players 陣列，Server 回傳 `PLAYER_NOT_IN_ROOM`，客戶端清除 localStorage 並顯示加入頁面（視同新訪客），使用新暱稱加入新局。

#### 房間狀態

| 狀態 | 說明 | 允許加入新玩家 |
|------|------|----------------|
| `waiting` | 等待玩家加入，Host 可編輯設定 | 是 |
| `running` | 遊戲進行中（樓梯已生成） | 否 |
| `revealing` | 揭曉進行中 | 否 |
| `finished` | 本局結束 | 否 |

#### 房間狀態轉換

| 從 | 到 | 觸發條件 |
|----|----|----------|
| `waiting` | `running` | Host 點擊「開始遊戲」，Server 端重新驗證 N ≥ 2 且 1 ≤ W ≤ N-1 皆合法後，立即設定 Room.status = `running` 廣播至所有端（使用 **`ROOM_STATE` 事件**，非 `ROOM_STATE_FULL`；詳見 §14 事件目錄）|
| `running` | `revealing` | Server 完成 ladderMap、resultSlots 與所有玩家 startColumn、endColumn 及 Room.status = `revealing` 原子寫入後自動觸發（**廣播使用 `ROOM_STATE_FULL` 事件**，非 `ROOM_STATE`；詳見 §14 事件目錄）|
| `running` | `waiting` | Server 原子寫入拋出異常或自 **Server 完成 Room.status = `running` 的 DB 寫入確認後（commit ACK；廣播隨即送出）**（步驟 6）起計時逾時 10 秒；**注意：Server 計時從 commit ACK 後起算，客戶端 15 秒計時從收到廣播後起算**，兩者之間存在網路傳輸延遲；「視為同一時間點」為近似說法，實際上兩個計時器起點可能相差幾百毫秒至幾秒（取決於網路狀況），此為可接受的近似誤差（10 秒 vs 15 秒的緩衝足夠吸收一般網路延遲）未完成；回退前 Server 清除本次已寫入的部分資料（seed 重置為 `""`、rowCount 重置為 0、ladderMap 重置為 `[]`、resultSlots 重置為 `[]`，以及任何已部分寫入的 player.startColumn、player.endColumn、player.result 重置為 null；**autoReveal 和 autoRevealInterval 不在本原子寫入範圍**（autoReveal 僅在 `revealing` 狀態可切換，autoRevealInterval 僅在 `revealing` 狀態可調整，`running` 期間兩者均不可改，值必然仍為 `false`/`3`；此兩欄位不列入 rollback 清單，不需額外 DB 寫入）；**`autoRevealStartedAt`（in-memory）亦不在 rollback 清單**——`running` 狀態下 autoReveal 不可切換（見上段），autoReveal enable 請求在 `running` 狀態下靜默忽略（見 §7.5 揭曉控制請求非 `revealing` 狀態的統一規則），Server 不可能在 `running` 期間執行 enable 操作並更新此時間戳；故 `autoRevealStartedAt` 在整個 `running` 狀態期間必然為 null，rollback 後其值仍為 null，無需額外清除；**revealIndex 不在需清除欄位範圍內**（因 `running` 狀態本局從未遞增，依 §6.2 步驟 7 確認 revealIndex 不在原子寫入範圍（`running→revealing` 原子寫入不含 revealIndex）；revealIndex = 0 的保證來源：首局由 §9 初始值（= 0）確立，後續局由 §7.6「再玩一局」重置為 0；故進入 `running` 時 revealIndex 必然為 0，rollback 時其值必然仍為 0，不需額外重置；若 revealIndex 意外非 0 則視為 Server bug，需另行修復；**防禦性建議**：原子寫入入口應在執行寫入前以斷言驗證 `revealIndex == 0`，若驗證失敗應中止操作並觸發 rollback（等同原子寫入拋出異常的 `ROLLBACK_ERROR` 路徑），不應帶著非 0 的 revealIndex 繼續執行，否則後續 `REVEAL_INDEX` 廣播的動畫觸發邏輯將以錯誤基底計算，客戶端呈現錯誤動畫順序）；**title 因 `running` 後禁止修改（§7.1 建立房間規則），在 rollback 期間不可能被更改，故不在 rollback 清單中**；players 陣列維持凍結瞬間的名單不變（不回退至 `running` 前）；**rollback 不執行 isOnline=false 玩家移除**：isOnline=false 玩家移除僅發生於 Host 主動點擊「再玩一局」（見 §7.6）；斷線玩家暱稱在 rollback 後的 `waiting` 狀態仍被佔用，ghost player 若嘗試使用原暱稱加入將被拒絕，須改用不同暱稱或等待 Host 點擊「再玩一局」後再加入；**rollback 後 Host 可手動踢除 isOnline=false 玩家**——rollback 後房間回到 `waiting` 狀態，踢除操作在 `waiting` 狀態有效（§7.1 房間規則），Host 若需降低 N 以重設合法 W，可踢除斷線玩家，無需等待「再玩一局」；被踢除玩家暱稱立即釋放，其 playerId 加入 kickedPlayerIds 清單；**rollback 後等待室顯示名單 = 凍結瞬間名單**：即 `waiting→running` 轉換發生時的 players 陣列（含 `running` 期間斷線而 isOnline=false 的玩家）——此名單在 rollback 前後完全相同，不回退至 `running` 前的名單，也不移除任何玩家；**kickedPlayerIds 在 rollback 後保留（不清空）**：踢除操作發生於 `waiting` 狀態，rollback 返回同一 `waiting` 狀態，踢除禁令在 rollback 後持續有效；kickedPlayerIds 僅在 Host 點擊「再玩一局」（見 §7.6）時才重置為 `[]`；將 Room status 設回 `waiting` 並廣播（`ROOM_STATE` 事件，額外攜帶 `reason` 欄位；**兩個合法字串值**：`"ROLLBACK_TIMEOUT"`（10 秒逾時觸發回退）或 `"ROLLBACK_ERROR"`（原子寫入拋出異常觸發回退）；工程師直接實作時使用此兩個值，§14 `ROOM_STATE` payload 說明亦引用此處定義），所有端顯示對應錯誤提示。**10 秒 vs 15 秒逾時說明**：Server 10 秒回退廣播應先於客戶端 15 秒計時器觸發，客戶端 15 秒計時器為最終安全網（fallback）；若廣播遺失導致客戶端 15 秒先觸發，客戶端顯示「連線逾時，請重新整理頁面」提示，並在玩家手動重整後帶 playerId 重連，依 §8.3 重連流程呈現正確畫面。**同時觸發優先序**：若 Server `waiting` 廣播與客戶端 15 秒計時器幾乎同時到達，**廣播優先**——客戶端收到任何狀態廣播時立即取消計時器並依廣播跳轉（不顯示逾時錯誤）；計時器僅在計時屆滿且廣播完全未到達的情況下觸發逾時提示（見 §8.3） |
| `finished` | `waiting` | Host 點擊「再玩一局」，Server 驗證通過後執行玩家名單 pruning、欄位重置原子操作，設定 Room.status = `waiting` 並廣播（使用 **`ROOM_STATE` 事件**；詳見 §7.6 再玩一局語意） |
| `revealing` | `finished` | revealIndex 達到 N 後自動觸發（含 Host 點擊「一鍵全揭」時 Server 直接設 revealIndex = N 的情況）；DB 寫入 revealIndex = N 與 status = `finished` 為單一原子操作；Server 在同一廣播中同步推送 revealIndex = N + status = `finished`（逐步揭曉到達 N 時廣播不帶 `revealAll` 旗標；一鍵全揭時 Server 發出 `REVEAL_ALL` 事件（非 `REVEAL_INDEX`），攜帶 `revealAll: true`，詳見 §14 `REVEAL_ALL` 及 §7.5）；**live 接收此廣播**（即廣播送達時已在連線中的客戶端）若正在播放最後一位（startColumn = N-1）的動畫，待動畫播放完畢後再跳轉至結算頁；其他 live 客戶端（未播放最後動畫，或因延遲落後播放前幾位動畫者）直接跳轉；**「正在播放最後一位動畫」判斷條件（live 路徑 vs 重連路徑分開說明）**：

**live 路徑**（廣播送達時客戶端已在連線中）：收到不帶 `revealAll` 的 `REVEAL_INDEX` k=N 廣播時，此廣播同時觸發 startColumn=N-1 的動畫開始播放（觸發條件：startColumn == k−1 == N−1）。**live 路徑一律等待此動畫完畢後才跳轉**——k=N 廣播到達即代表動畫正在啟動（或即將啟動），直接跳轉將跳過最後一位玩家的走線動畫，不符合設計意圖。例外：若客戶端因網路延遲未及時收到 k=1 到 k=N-1 等廣播（極端情況），當 k=N 到達時客戶端本地從未播放任何動畫（revealIndex 從未遞增）——此情形下客戶端本地沒有 startColumn=N-1 的動畫要播，**直接跳轉**（不進入等待狀態）。客戶端以**本地是否曾觸發過 startColumn=N-1 的動畫**作為判斷依據（即判斷此廣播前是否已收到過 k=N-1 廣播）；此判斷可用 `lastReceivedRevealIndex`（見下方說明）：**此比較必須使用收到 k=N 廣播前（更新前）的 `lastReceivedRevealIndex` 值——判斷順序為「先比較，再更新為 N」；若先更新至 N 再比較，`lastReceivedRevealIndex` 已為 N，兩個分支均不匹配，跳轉邏輯靜默失效**；若 `lastReceivedRevealIndex < N-1` 時收到 k=N，代表 N-1 動畫尚未被觸發，**立即中止任何進行中的動畫（若有），直接跳轉**（行為等同收到 `REVEAL_ALL` 時的中止語意：客戶端不等待當前正播放的早期玩家動畫完成，直接跳轉結算頁）；若 `lastReceivedRevealIndex == N-1`，代表動畫即將被此廣播觸發，等待動畫完畢後跳轉。**N=2 邊界說明**：N=2 時 N-1=1，唯一的前置廣播 k=1 同時是「第 1 位玩家動畫廣播」與「N-1 廣播」，但通用公式依然成立——k=2=N 到達時，若 `lastReceivedRevealIndex == 1`（k=1 已收到，startColumn=0 動畫已觸發），此廣播觸發 startColumn=1 動畫，等待完畢後跳轉；若 `lastReceivedRevealIndex == 0`（k=1 未收到），直接跳轉；工程師無需為 N=2 添加特殊分支。

**重連路徑**（快照中 revealIndex = R）：客戶端依 R 值判斷：**若 R = N（或快照 status = `finished`）**，直接跳轉至結算頁，不等待任何動畫；**若 R < N**，顯示揭曉畫面（見 §8.3 `revealing` 重連行為），startColumn < R 的玩家（含快照時可能仍在其他客戶端上播放動畫中的 startColumn = R−1）一律靜態顯示，不重播動畫；startColumn ≥ R 的玩家顯示等待進度；後續新 `REVEAL_INDEX` 廣播依觸發條件正常播放動畫（此為正常播放，非補播，見 §8.3 `revealing` 快照說明）。

**`lastReceivedRevealIndex` 的定義與初始化**：此變數記錄客戶端迄今收到的最新 revealIndex 廣播值，主要用於**動畫觸發**計算（觸發條件：**`startColumn == lastReceivedRevealIndex - 1`**——k=j+1 廣播到達後 `lastReceivedRevealIndex` 更新至 j+1，需播放 startColumn=j 的玩家動畫；等同 §7.5 規格「myPlayer.startColumn == k − 1」）：live 路徑初始值 = 0（客戶端收到 `ROOM_STATE_FULL` 時 revealIndex=0）；重連路徑初始值 = 快照 R（不從 0 重新開始，否則後續動畫觸發判斷以錯誤基底計算）；每次收到 `REVEAL_INDEX` k 廣播時更新為 k；**收到 `REVEAL_ALL` 廣播時同樣更新為 N**（一鍵全揭後若因網路重送又收到後續廣播，狀態變數需反映最終值）；**`lastReceivedRevealIndex` 的主要用途是動畫觸發**，jump 決策以「是否曾收到 k=N-1 廣播」（即上方 live 路徑判斷）為準，不直接等同於 `localPlayingColumn == N-1` 公式（此公式在 check-before-update 語意下對 live 路徑存在 off-by-one 問題，應使用本段的分路徑判斷代替）；**重連時**若快照顯示 revealIndex = N（或 status = `finished`）則直接顯示結算頁，不等待動畫；轉換時 Server 取消自動輪播計時器（若正在運作），autoReveal 欄位值保留（不重置），直到「再玩一局」時才重置為 false |

#### 房間規則

- 若客戶端嘗試存取不存在的 Room Code，Server 回傳 404；客戶端顯示「此房間不存在或已過期」並導回首頁
- **玩家人數上限（50 人）**：Server 在 `waiting` 狀態處理無 playerId 的加入請求時，若 players.length 已達 50，拒絕加入並回傳 `ROOM_FULL` 錯誤（見 §14）；客戶端顯示「房間已滿（50 人上限），無法加入」；此限制僅適用於新玩家加入，帶有已知 playerId 的重連請求不受上限限制
- 遊戲開始後不可再加入新玩家；若**不帶 playerId** 的新玩家加入請求到達 Server 時 Room 已處於 `running` 或 `revealing` 狀態，Server 回傳 `ROOM_NOT_JOINABLE` 錯誤，客戶端顯示「此房間遊戲已開始，無法加入」並停留在加入頁面；若房間狀態為 `finished`，Server 回傳 `ROOM_FINISHED` 錯誤（見 §14），錯誤提示改為「此房間遊戲已結束，請等待主持人開啟下一局後再加入」，客戶端依 §14 `ROOM_FINISHED` 流程以**訪客身分在同一條 WebSocket 連線上建立匿名監聽 session**（無需 playerId；**不重新建立連線**——Server 在現有 WebSocket 連線上直接建立匿名 session，見 §14 升級協定：「Server 回傳 `ROOM_FINISHED` 錯誤並在同一條 WebSocket 連線上建立匿名監聽 session」）監聽房間廣播，收到 `waiting` 廣播後自動恢復加入頁面可操作狀態，並使用該 WebSocket 連線提交加入請求取得 playerId；**帶有已知 playerId** 的重連請求在所有房間狀態下均允許，不受此限制；若 playerId 不在 players 陣列且不在 kickedPlayerIds 中，視為已過期前局玩家，Server 回傳 `PLAYER_NOT_IN_ROOM` 錯誤；**客戶端行為依房間當前狀態分三種路徑**（詳見 §14 `PLAYER_NOT_IN_ROOM` 錯誤碼說明）：① `waiting` 狀態：清除 localStorage，顯示可操作的加入頁（房間可加入，使用者可直接填寫暱稱加入）；② `running`/`revealing` 狀態：清除 localStorage，**顯示靜態等待頁**（「遊戲進行中，請等待下一局後加入」），**不顯示可操作的加入頁**——Server 在同一 WebSocket 連線上自動建立匿名監聽 session，等待 `status=waiting` 廣播後恢復加入頁可操作狀態；③ `finished` 狀態：清除 localStorage，提示「你的記錄不存在（可能來自上一局），請等待主持人開啟新局後加入」，Server 建立匿名監聽 session 等待 `waiting` 廣播
- Host 可在 `waiting` 狀態下踢除**其他**玩家；Server 拒絕 Host 踢除自身（回傳 `CANNOT_KICK_HOST` 錯誤）；若踢除請求到達 Server 時 Room 狀態非 `waiting`，Server 回傳 `KICK_NOT_ALLOWED_IN_STATE` 錯誤，客戶端不顯示錯誤（踢除按鈕在非 `waiting` 狀態下應已隱藏或禁用）
- 玩家離線後可嘗試重連（帶 playerId）
- MVP：Host 離線後房間停止操作；進階版可移交 Host 權限
- **`running` 狀態斷線保護**：玩家在 `running` 狀態下斷線不影響其在本局的 startColumn 與 endColumn 分配；Server 原子寫入時不跳過任何玩家，isOnline=false 的玩家結果照常計算與揭曉

### 7.2 等待室（Lobby）

**顯示內容**（`waiting` 狀態）：
- 房間名稱（若 title 未填則顯示 Room Code 作為替代）與 Room Code
- 目前加入玩家名單（含 Host 身分標記，依 `joinedAt` 由早到晚排序，joinedAt 相同時以 playerId 字典序升冪為次要排序鍵；再玩一局後留存玩家維持原加入順序，新加入玩家附加於末尾（**此排序效果由 joinedAt 純排序自然實現**——留存玩家的 joinedAt 保留自原局加入時間，必然早於新局新加入玩家的 joinedAt；客戶端不需特殊插入邏輯，統一按 joinedAt 升冪排序即可得到此結果）；isOnline=false 的斷線玩家以灰色或離線徽章標示，仍顯示於名單中，計入 N）
- 中獎名額（**玩家端顯示規則**：winnerCount = null 時顯示「等待主持人設定中獎名額」或等效提示文字，不顯示空白；winnerCount 為有效整數時正常顯示數值；再玩一局後 winnerCount 保留上局值，玩家端直接顯示，不需特殊處理）
- 玩家人數不足 2 人時顯示「人數不足，至少需要 2 位玩家才能開始」

**Host 控制**：
- 修改中獎名額（僅限 1 ≤ W ≤ N-1，N 為當前 players 陣列長度，含 isOnline=false 的斷線玩家）；中獎名額輸入框初始為空（winnerCount = null 時），「開始遊戲」按鈕禁用並顯示提示「請先設定中獎名額」；每當 N 發生變化（玩家加入或被踢除），輸入框立即以當前 N 重新計算 W 合法性並更新 UI 狀態（disabled / error 樣式），若輸入框有未提交的值，不清空但即時重新評估其合法性；**再玩一局後 Server 不接受將 winnerCount 設回 null 的更新請求**（winnerCount 已為整數，清空屬無效操作）；UI 層輸入框不應允許提交空值，Server 若收到此類請求回傳無效參數錯誤並忽略，winnerCount 維持原整數值不變
- 踢除玩家（踢除後若 N 降至 1，「開始遊戲」因「人數不足」優先禁用；中獎名額輸入框同時禁用且以錯誤樣式標示（保留現有 W 數值，不清空），提示文字顯示「人數不足，請等待更多玩家加入」；當新玩家加入使 N ≥ 2 後，輸入框恢復可用：若現有 W 落在合法範圍 1 ≤ W ≤ N-1 則直接恢復，若 W 仍越界則顯示無效標記但可編輯，Host 需重新設定 W；若 W 為 null（僅首局可能），輸入框恢復可用但保持空白，「開始遊戲」維持禁用並顯示「請先設定中獎名額」）
- **再玩一局後 W 越界的 Lobby 初始 UI**：Host 按「再玩一局」後進入 `waiting` 狀態，若此時 W 越界（W > 新 N-1 或 W ≤ 0），Lobby 初始顯示即套用 §7.6 越界提示規格：「中獎名額不合法，請重新設定（目前 W={W}，人數 N={N}）」，輸入框以錯誤樣式標示，「開始遊戲」按鈕保持禁用；N < 2 時人數不足提示優先於 W 越界提示（見下方優先序規則）
- **按鈕禁用提示優先序**：N < 2 時優先顯示「人數不足」提示，其次才判斷 W 是否合法（此優先序適用於所有情境，含初始進入等待室時 Host 為唯一玩家的狀態，以及再玩一局後 W 越界的情境）
- 開始遊戲（當 N ≥ 2 且 1 ≤ W ≤ N-1 時啟用；W 為 null 或越界時按鈕禁用）
- **autoReveal 與 autoRevealInterval 不在 `waiting` 狀態控制項範圍**——兩者僅可在 `revealing` 狀態調整（見 §7.5）；`waiting` 狀態 Lobby 不顯示自動輪播設定介面，工程師不應在等待室 UI 實作此控制項
- **Host 斷線時的 `waiting` 狀態顯示（防禦性情境）**：若 Host isOnline=false（Host 斷線），Host 在玩家名單中同樣顯示離線徽章（與其他斷線玩家顯示規格一致），但 Host 身分標記維持顯示，不因斷線而移除；**Host 控制面板（「開始遊戲」按鈕及踢除操作）在 Host 斷線期間不可操作**——Host 已斷線，其本人客戶端無法送出請求，其他玩家客戶端不顯示 Host 控制項；Host 重連後 Server 廣播 isOnline=true 更新，Host 端控制面板自動恢復可用，流程與一般玩家重連至 `waiting` 狀態完全一致

### 7.3 樓梯生成

- Host 點擊「開始遊戲」後，**由 Server 端** 生成隨機種子並一次性產生完整樓梯結構
- 所有端同步使用同一份 ladderMap（從 DB 讀取，不在 client 重算）
- ladderMap 一旦生成即不可修改

**生成規則**：
- 橫槓（LadderSegment）只連接相鄰欄位（`to = from + 1`，保證 `from < to`）
- 同 row 不可產生衝突橫槓（同一行中各橫槓的欄位範圍不重疊；**衝突定義**：兩條橫槓 (a, a+1) 與 (b, b+1) 衝突當且僅當它們共用任何欄位索引，即 `b == a` 或 `b == a+1` 或 `b+1 == a`，等同 `|a - b| <= 1`；端點接觸（如 (0,1) 與 (1,2) 共用欄位 1）視為衝突，不合法；生成演算法中「from 值與已放置橫槓重疊」的判斷使用此定義）
- row 數 = clamp(N × 3, 20, 60)（Server 端生成時強制套用此公式）
- 橫槓密度：每 row **目標生成**（嘗試放置）max(1, round(N/4)) 條橫槓（N 為凍結後玩家人數（**含 isOnline=false 的斷線玩家**，players 陣列全部長度，與 §9 rowCount 定義及 §6.2 步驟 5 驗證所用 N 一致）；此公式在 N ≥ 2 的前提下使用，與開局驗證規則一致；**`round` 採「四捨五入（.5 進位）」語意**，即 0.5 進位（如 N=6 時 round(1.5) = 2），對應 JavaScript `Math.round()`；事後驗算實作（如 Python）必須對應採用相同捨入語意而非銀行家捨入，否則跨語言重現時橫槓目標密度可能偏差，進而導致 PRNG 消耗總次數不一致），確保不與同 row 其他橫槓重疊；**每條橫槓各自獨立嘗試最多 N×10 次隨機放置**，若嘗試耗盡仍無法放置，跳過該條橫槓繼續放置下一條，最終以成功放置的橫槓數量為準（不補足），繼續生成下一 row；**PRNG 消耗與重現性**：每次嘗試放置橫槓所抽取的亂數（無論成功或失敗）均視為正式 PRNG 消耗，計入 PRNG 序列狀態；**每次嘗試恰好消耗 1 個 PRNG 值**（用於從 [0..N-2] 中以均勻分布隨機選取橫槓起點欄位 from；欄位 to = from + 1 為確定性計算，不額外消耗 PRNG；若選出的 from 值與同 row 已放置橫槓重疊，視為失敗嘗試，但該 PRNG 消耗照常計入，不重抽）；此確保相同 seed 在不同環境中的 ladderMap 生成結果完全一致（同樣的嘗試次數、失敗次數均消耗相同 PRNG 序列），事後驗算可精確重現；實作時不可採用「僅成功放置才消耗 PRNG」的策略，否則跨環境重現性無法保證；橫槓數少於目標值的 row 屬合法 ladderMap，客戶端按實際橫槓數渲染，不顯示錯誤；N=2 時欄位間僅有 1 個可能橫槓位置，每 row 恰好放置 1 條橫槓（目標條數與唯一合法位置均為 1，屬公式自然結果），屬合法生成結果

### 7.4 結果槽位配置

- 底部共有與玩家數相同的結果槽位
- 依中獎名額 W，從 N 個欄位中隨機選取 W 個標記為「中獎」；結果槽位的 W 個中獎欄位選取使用與 ladderMap 生成相同的 seed，以確定性演算法延續同一 PRNG 序列計算，可用 seed 重現完整結果；**⚠️ 阻塞警告：W 個欄位的選取演算法（如 Fisher-Yates shuffle 取前 W 個 vs 逐次無放回抽樣等）需在 PRD 技術規格中明確指定後才可實作（§16 開放問題）——不同演算法消耗的 PRNG 次數不同，若未對齊，各環境的 resultSlots 結果可能靜默不一致且無法跨語言驗算；此阻塞等級與 §11.1 PRNG 演算法阻塞警告相同，工程師不可先行實作**
- resultSlots 陣列恰好包含 N 筆記錄，欄位索引 0 至 N-1 各出現一次，其中 W 筆 type = "win"，其餘 N-W 筆 type = "lose"
- 進階版可支援固定獎項配置

### 7.5 路徑揭曉

**揭曉順序**：依 startColumn 由左至右（索引 0 → N-1）逐一揭曉。Host 不可手動調整揭曉順序（維持公平性）。進入 `revealing` 狀態時 revealIndex = 0，不自動觸發任何揭曉；Host 需主動點擊「下一位」（手動模式）或啟動自動輪播後，才開始首位玩家（startColumn = 0）的揭曉動畫。**揭曉畫面欄位標頭顯示順序**：Host 端聚焦揭曉模式與玩家端個人視角揭曉畫面的頂部欄位槽位，依 startColumn 索引由左至右排列（欄位 0 至 N-1），與 joinedAt 加入順序無關；玩家自身欄位位置對應其 startColumn，不依加入先後排序。

**揭曉動畫**：
- 依序播放每位玩家從上到下的路徑動畫
- 路徑走到終點後顯示：中獎 / 未中獎

**揭曉節奏控制（Host）**：
- 手動下一位（預設）：Host 點擊後，Server 將 revealIndex +1 並廣播至所有端
- 自動輪播：間隔秒數範圍 1~30 秒，預設 3 秒；**autoRevealInterval 僅在 `revealing` 狀態下可由 Host 調整（Host 揭曉控制面板），`waiting` 狀態不提供此設定入口**；Host 修改後 Server 立即更新 autoRevealInterval 並透過 `ROOM_STATE` 廣播至所有端（下一輪倒數採用新值，進行中的倒數不受影響）；此廣播**必須攜帶 autoRevealInterval 欄位**（不論 `ROOM_STATE` 採增量或全量格式），確保所有客戶端的倒數顯示能即時同步更新；間隔計時從**上一個玩家動畫結束後**開始，不使用固定牆鐘週期。**v1 動畫等待機制**：Server 端使用固定動畫時長常數（預設 2 秒）作為等待時間，而非依賴客戶端回呼；Server 在廣播 revealIndex +1 後等待該常數時長，再啟動下一輪計時器倒數（工程評估時可調整此常數）。**動畫時長常數的規範位置**：此值為 Server 端工程配置常數（例如 `ANIMATION_DURATION_SECONDS = 2`），不是 DB 欄位，不寫入 Room 資料模型，不透過事件傳送至客戶端；客戶端的實際動畫播放時長應等於或短於此常數，以確保 Server 啟動下一輪倒數時客戶端動畫已完成（或接近完成）；兩者若不同步會導致玩家看到動畫尚未結束 Server 就開始下一輪倒數的視覺落差；具體數值待工程評估後寫入 PRD 技術規格；⚠️ **阻塞警告**：`ANIMATION_DURATION_SECONDS` 確切數值尚未確定，確認前 §8.3 `remainingSeconds` 計算公式中**`revealIndex > 0` 分支**的精確倒數模式無法完整實作（該公式含 `ANIMATION_DURATION_SECONDS`）；**`revealIndex = 0` 分支不受阻塞影響**——決策表第 1 列（首次啟動）的 autoRevealInterval 倒數公式為 `autoRevealInterval − elapsed`，不依賴此常數，可先行實作；**阻塞範圍**：僅限決策表第 2、3 列（revealIndex > 0 的中段啟動路徑）及 §8.3 `remainingSeconds` 的 revealIndex > 0 計算；此為類似 §11.1 PRNG 演算法的跨系統共享常數阻塞點，Server 與 Client 工程師應在 PRD 確認此值後方可實作中段啟動路徑的精確倒數功能；**阻塞期間過渡行為**：在數值確認前，Server 對 `revealIndex > 0` 分支的 `remainingSeconds` 計算應回傳 `null`（不使用臨時佔位數值，如 `2`），原因：（1）使用佔位數值可能讓工程師誤以為已實作完畢而跳過後續更新，（2）客戶端顯示「自動輪播進行中」指示器（`remainingSeconds = null` 路徑）是此階段的安全降級行為，與 `lastRevealBroadcastAt` 遺失路徑一致；**阻塞期間 TODO 標記要求**：工程師在 Server 端實作決策表第 2、3 列（及 §8.3 revealIndex>0 計算分支）的對應程式碼時，必須加入 `// TODO: replace null with formula after ANIMATION_DURATION_SECONDS is confirmed (see PDD §7.5 阻塞警告 & §16)` 的 TODO 標記，確保常數確定後此分支不被遺漏——阻塞期間回傳 null 與 Server 重啟後 `lastRevealBroadcastAt` 遺失的 null 回傳在客戶端視角完全相同，缺少 TODO 標記時工程師無法區分「尚未實作（待確認常數）」和「已實作（Server 重啟降級）」兩種 null 來源；客戶端實作應使用相同數值作為動畫時長上限；**`ANIMATION_DURATION_SECONDS` 為 Server 與 Client 的跨系統共享常數，必須從單一來源取得**（例如共用配置檔案、monorepo 共享套件，或在 PRD 中明確指定確定值後 Server 與 Client 工程師使用同一硬編碼數值）；不應由 Server 與 Client 各自獨立設定，否則雙方更新時容易靜默分歧，造成動畫未完成 Server 已開始下一輪倒數的視覺落差。**間隔語意**：autoRevealInterval 指動畫等待時長常數結束後的額外等待秒數（非兩次揭曉之間的總時間差）；Host 端 UI 標示應說明「動畫播放完畢後再等 N 秒」；自動輪播模式進行中 Host 端顯示倒數計時（若工程成本過高可改為輪播進行中指示器，作為 MVP 簡化）。**首次揭曉特例**：Host 啟動自動輪播時若 revealIndex = 0（首位玩家尚未揭曉），Server 直接啟動 autoRevealInterval 倒數（無需先等待動畫時長常數），倒數結束後觸發第一次 revealIndex +1；若 Host 先啟動後取消再重新啟動（仍在 revealIndex = 0），重新啟動時與首次啟動相同邏輯（直接啟動 autoRevealInterval 倒數），不受先前已取消的計時器影響；**實作順序要點**：Server 處理 enable 請求時，須**先**記錄（或更新）in-memory `autoRevealStartedAt`，**再**評估決策表——此順序確保決策表評估時 `autoRevealStartedAt` 必然已存在，進入第 1 列（正常路徑）而非誤判為第 5 列（Server 重啟竟態分支）；詳見下方決策表第 1 列說明。**中段啟動自動輪播（revealIndex > 0）**：若 Host 在 revealIndex > 0 時啟動自動輪播，Server 等待**剩餘時間補足 2 秒**（從 **Server 最近一次送出 revealIndex +1 廣播的時間點**起計算）後，再啟動 autoRevealInterval 倒數；若 mode-switch 訊息到達時距上次廣播已超過 2 秒（剩餘時間 ≤ 0），Server 跳過等待、直接啟動 autoRevealInterval 倒數（即決策表第 2、3 列）；此設計為近似同步而非精確同步，屬可接受的 UX 誤差（網路延遲下客戶端動畫可能尚未結束，Server 即開始下一輪倒數）；若動畫時長常數等待期間 Host 又切換回手動，視為一般切換流程（取消計時器，按鈕狀態依 mode-switch ack broadcast 恢復）。**最後一位（revealIndex=N-1→N）的計時器行為**：自動輪播模式下，revealIndex=N-1 廣播後，Server 仍執行完整的「等 2 秒動畫常數 → 啟動 autoRevealInterval 倒數 → 倒數結束後廣播 revealIndex=N（同時觸發 `finished` 轉換）」序列；**不存在任何針對最後一步的計時器截短或特殊跳過邏輯**；2 秒動畫等待確保最後一位玩家的動畫可在客戶端播放完畢後，Server 才廣播 `finished` 狀態，讓客戶端依§7.1「最後一位動畫等待跳轉」邏輯正常處理。

**啟動自動輪播「跳過動畫等待」統一決策表**（實作者可用此表取代分散的特例描述）：

| 列 | 條件 | 行為 |
|----|------|------|
| 1 | revealIndex = 0 且 autoRevealStartedAt 已記錄（正常流程，涵蓋**兩種情境**：① 首次啟動（autoReveal false→true，**含 disable→enable 情境**：即 Host 先啟動後取消，再重新啟動，autoReveal 從 false→true 再度觸發；此路徑與首次啟動完全相同，非第三種獨立情境）：Server 處理 enable 請求時**在決策表評估前即設置** in-memory `autoRevealStartedAt`，故決策表評估時此欄位必然已存在；② 冪等重啟（autoReveal **已為 true**，Host 重送 enable；與情境 ① 的關鍵區別：情境 ① 為 false→true，情境 ② 為 true→true）：同樣先重置 `autoRevealStartedAt` 再評估；若 autoRevealStartedAt 遺失（Server 重啟竟態窗口），見第 5 列） | 直接啟動 autoRevealInterval 倒數（無動畫等待）；**評估順序（在 enable handler 已先寫入 autoRevealStartedAt 之後）：檢查 autoRevealStartedAt 是否存在，存在則走本列（首次或冪等均適用），不存在（Server 重啟竟態窗口：寫入操作因重啟而失效）則走第 5 列** |
| 2 | revealIndex > 0 且（當前時間 − 上次 revealIndex 廣播時間）< `ANIMATION_DURATION_SECONDS` | 等待剩餘時間補足 `ANIMATION_DURATION_SECONDS` 後，啟動 autoRevealInterval 倒數 |
| 3 | revealIndex > 0 且（當前時間 − 上次 revealIndex 廣播時間）≥ `ANIMATION_DURATION_SECONDS` | 跳過 `ANIMATION_DURATION_SECONDS` 等待，直接啟動 autoRevealInterval 倒數 |
| 4 | revealIndex > 0 且「上次 revealIndex 廣播時間戳」遺失（Server 重啟後 in-memory 清除） | 跳過 `ANIMATION_DURATION_SECONDS` 等待，直接啟動 autoRevealInterval 倒數（保守處理：動畫極可能已完成）；重連快照回傳 `remainingSeconds = null`（見 §8.3） |
| 5 | revealIndex = 0 且 autoReveal 啟動時間戳遺失（**Server 重啟後特殊竟態，非正常流程**：正常流程下 enable 請求必會記錄時間戳，此列僅在 Server 重啟後 startup eager write 尚未完成而 Host 已重送 enable 請求的極短窗口中發生） | Server 收到 enable 請求後：直接啟動 autoRevealInterval 倒數（同第 1 列），**同時記錄 in-memory 啟動時間戳**；**注意：此處「Server 啟動倒數」與「重連快照回傳 null」並不矛盾**——Server 在記錄時間戳後立即開始倒數（行為等同第 1 列），但若有重連請求在時間戳記錄**之前**到達（因竟態窗口極短），Server 尚無時間戳可計算 remainingSeconds，故回傳 `remainingSeconds = null`（見 §8.3 revealIndex=0 公式末段）；時間戳一旦記錄，後續重連快照即可正常計算 remainingSeconds；**路徑判斷優先序**：Server 處理 enable 請求時，先檢查 in-memory 時間戳是否存在——若存在（正常流程，含冪等路徑）走冪等重啟邏輯（見「enable 冪等性」說明）；若不存在（Server 重啟竟態窗口）走本列邏輯（記錄時間戳並啟動）；此兩條路徑最終行為相同（均啟動倒數），但冪等路徑需額外取消舊計時器，本列不需要（in-memory 無計時器）；**此列是 Server 重啟後的防禦性分支，不是 revealIndex=0 的第二個正常分支** |

> **Server 廣播時間戳記錄（in-memory）**：Server 每次執行 revealIndex +1 廣播時，必須在記憶體中記錄該廣播的時間戳（即「上次 revealIndex 廣播時間」）；此時間戳僅用於上表 revealIndex > 0 分支的「跳過動畫等待」決策，**不持久化至 DB，也不傳送給客戶端**。Server 重啟後時間戳遺失（revealIndex > 0 分支因此無法計算剩餘時間），此情形下對應 remainingSeconds = null 的處理（見 §8.3 autoReveal 重連快照說明）。

以上規則覆蓋所有啟動情境（含首次啟動、重啟、中段啟動；**前三列為正常情境，第 4、5 列為 Server 重啟後的防禦性分支，均需實作**），工程師以此表實作統一入口即可。**revealIndex 從 0 變為 1 的時間戳切換**：Server 廣播 revealIndex=1（首次遞增）的同時，記錄「上次 revealIndex 廣播時間戳」；此後 remainingSeconds 計算一律使用 revealIndex>0 分支的廣播時間戳公式（「autoReveal 啟動時間戳」僅用於 revealIndex=0 分支的計算，revealIndex>0 後不再使用）。Host 可在揭曉過程中隨時切換為手動；切換時 Server 立即取消當前進行中的倒數計時器（若計時器已在同一訊息處理週期內觸發並生成 revealIndex +1 事件，則該遞增照常執行，autoReveal 切換在下一次遞增前生效）。**訊息處理順序**：Server 以 FIFO（先入先出）順序處理所有來源（Host 操作訊息與計時器觸發事件）的訊息，兩者不交叉執行；此保證「切換為手動」訊息與計時器觸發的遞增事件之間的執行先後確定，符合上述規則。**「取消計時器」的 FIFO 語意**：「切換為手動」的 disable 訊息在 FIFO 佇列中按序執行；FIFO 保證確保 disable 被處理時，所有在 disable 之前排入佇列的計時器觸發事件均已先行處理完畢（先入先出，不跳過）；「取消計時器」僅作用於尚未排入佇列的未來觸發（計時器尚未到期、尚未生成事件的部分）；因此 disable 完成後，FIFO 佇列中不存在任何由本輪 autoReveal 週期遺留的計時器事件，客戶端收到 `ROOM_STATE`（autoReveal=false）後解鎖「下一位」按鈕是安全的。邊界情況：若計時器恰在 disable 訊息到達前一刻排入佇列（即計時器事件在 FIFO 中先於 disable），該計時器事件將先執行（revealIndex+1 照常），disable 在其後處理——此為「若計時器已在同一訊息處理週期內觸發」的情境，revealIndex 多遞增一次為預期行為（已見上文說明）。**autoReveal 切換的原子性**：每次 autoReveal 切換請求（enable 或 disable）在 FIFO 處理中依序完成 DB 寫入，後一個切換請求到達時前一個必已完成（不存在兩個切換請求交錯執行的情況）；Host 快速連續送出「關閉→開啟」時，Server 依序處理：先完成 disable 的持久化與廣播，再完成 enable 的持久化與廣播，最終狀態確定為 autoReveal=true，不存在計時器重複啟動的情況。**enable 請求的冪等性**：若 Server 收到 enable 請求時 autoReveal 已為 true（計時器已在運作），Server 將此視為「重新啟動」：取消舊計時器、重置 in-memory 啟動時間戳（**此步驟必須在決策表評估前完成**，確保決策表第 1 列的前提條件「autoRevealStartedAt 已記錄」成立；若先評估再重置，第 1 列可能誤判為存在有效時間戳的舊值，導致決策邏輯不一致；**此前置寫入規則適用於正常流程（決策表第 1–4 列）；第 5 列（Server 重啟竟態窗口）為例外：重啟後前置寫入步驟已失效，第 5 列觸發時 Server 尚無時間戳，timestamp 作為第 5 列行動的一部分寫入，而非前置條件**）、重新啟動倒數，並**在 DB 寫入 autoReveal = true 確認後才廣播 `ROOM_STATE`（autoReveal=true）作為 ack**（「寫入 DB 後廣播」保證與 disable 路徑對稱：確保若 Host 在 ack 廣播送達前重連，重連快照的 autoReveal 值已反映 enable 操作，不出現「廣播到達但快照仍為 false」的競態）；**Server 不靜默忽略重複 enable**，因為客戶端可能因頁面刷新等原因重送 enable 請求，重新啟動倒數比保持舊計時器更符合使用者預期（等待時間可預測）；重複 disable 時（autoReveal 已為 false）靜默忽略（不廣播）。自動輪播計時器由 Server 端維護。**Server 重啟後 v1 行為**：計時器不恢復，揭曉模式自動重置為手動（autoReveal 寫回 false）；**`running` 狀態房間 Server 重啟後處理**：`running` 狀態的 10 秒回退計時器存放於 in-memory（不持久化），Server 重啟後遺失；startup hook 須同時掃描所有 **`running` 狀態**的房間，將其 status 回退為 `waiting` 並廣播（執行與 §7.1 rollback 相同的清理邏輯：清除 ladderMap、resultSlots、seed 等中間寫入欄位），確保房間不永久卡在 `running` 狀態；客戶端重連至 `running` 後若 Server 已完成 rollback，將收到 `waiting` 快照，等待室重新顯示。**autoReveal 重置的觸發時機**：Server 啟動時（startup hook）主動掃描所有 **`revealing` 狀態**的房間（**不包含 `running` 狀態的房間**——`running` 狀態下 autoReveal 不可更改，值必然為 false，無需 startup hook 重置；`running` 房間的處理見同段落「`running` 狀態房間 Server 重啟後處理」說明）（**不包含 `finished` 狀態的房間**——`finished` 房間的計時器已隨 `revealing→finished` 轉換取消，autoReveal 欄位雖可能仍為 true（DB 值保留），但無任何計時器在運作，無需啟動時重置；`finished` 房間快照的 autoReveal 值客戶端應忽略，見 §8.3 `finished` 行），將 autoReveal 批次寫回 false 並廣播 `ROOM_STATE`（autoReveal = false）至各 `revealing` 房間已連線的客戶端；採用 eager write 而非 lazy write（等第一次重連才寫），確保重啟後殘留的已連線客戶端也能收到更新，不顯示誤導的「自動輪播進行中」狀態；Host 重連後取得的快照中 autoReveal = false，若客戶端先前顯示自動輪播進行中，應在收到快照後比對並顯示提示「伺服器已重啟，自動輪播已停止，請手動繼續揭曉」（見 §16 開放問題：v2 是否需要計時器持久化）。**快照原子性保證**：startup eager write 必須在 Server 開始接受重連請求之前完成（即 eager write DB 寫入確認後，Server 才進入就緒狀態接受 WebSocket 連線）；若實作上無法保證（如分散式環境），Server 在生成快照時若 autoReveal=true 但 in-memory 啟動時間戳已遺失（竟態窗口），應回傳 `remainingSeconds = null`，客戶端以此值直接顯示「自動輪播進行中」指示器，不嘗試精確倒數。**Host 斷線期間 v1 行為**：自動輪播計時器繼續在 Server 端運作，revealIndex 照常遞增並廣播至所有連線中的端；Host 重連後自動輪播計時器維持原狀繼續運作，Host 可隨時切換為手動，不需手動補按
- 一鍵全揭：Server **以單一原子操作**將 revealIndex 設為 N 並將 Room.status 設為 `finished`（原子性保證與逐步揭曉 k=N 時相同：「revealIndex = N 與 status = `finished` 的 DB 寫入為不可分割的原子操作，若任一寫入失敗則整批回退，Server 重試或回傳錯誤，不存在 revealIndex = N 但 status 仍為 revealing 的中間態」），所有端直接顯示完整結果（不播放逐一動畫）；**REVEAL_ALL 的計時器取消在 FIFO 佇列中執行**：`REVEAL_ALL` 請求到達 FIFO 佇列後，任何在其之前排入佇列的計時器事件均已先行處理（FIFO 保證）；`REVEAL_ALL` 執行時取消的是尚未排入佇列的未來計時器觸發；`REVEAL_ALL` 執行後 revealIndex = N，即使佇列中有遺留計時器事件（邊界情況），其嘗試執行時 revealIndex 已為 N，Server 冪等邏輯（§7.5「一鍵全揭」冪等）確保不重複處理

**revealIndex 遞增規則**：由 Server 端驅動。Host 點擊「下一位」或自動輪播計時到期時，Server 執行 revealIndex +1（k → k+1）並廣播新值；客戶端收到 revealIndex = k 後播放 startColumn == k-1 的玩家動畫，不由客戶端寫入 revealIndex。重連至 `revealing` 狀態的客戶端不播放任何補間動畫，所有 startColumn < revealIndex 的玩家（含當前正在其他客戶端上播放動畫中的 startColumn == revealIndex - 1）均直接顯示靜態最終結果。Server 端以冪等方式處理重複或遲到的「下一位」請求：「下一位」訊息需攜帶客戶端當下的 revealIndex 值作為期望值（expectedRevealIndex = k），**Server 必須先驗證 Room.status == `revealing`（前置狀態守衛）**，再檢查 revealIndex == k；若 Room.status 非 `revealing`，直接靜默忽略（不執行遞增，不回傳錯誤）；**若只依賴 revealIndex == k 而不驗證 status，`waiting` 狀態下 revealIndex 同為 0，一個 expectedRevealIndex=0 的請求將通過冪等檢查並觸發非法遞增**；通過前置守衛後，若 revealIndex 已 > k 則同樣靜默忽略。**揭曉控制請求非 `revealing` 狀態的統一規則**：「下一位」、autoReveal enable/disable、「一鍵全揭」、autoRevealInterval 調整等揭曉控制類請求，若在 `waiting`、`running`、`finished` 狀態下到達 Server，一律靜默忽略（不回傳錯誤）；客戶端在非 `revealing` 狀態下應已隱藏揭曉控制 UI，若因競態送出請求，Server 靜默處理即可。**「一鍵全揭」同樣以冪等方式處理**：若 revealIndex 已為 N 或 Room status 已為 `finished`，Server 忽略重複的「一鍵全揭」請求。**客戶端去重**：若客戶端已收到 `REVEAL_INDEX`（k=N，攜帶 status=finished）後，因網路重送又收到 `REVEAL_ALL` 廣播，客戶端應忽略此廣播（status 已為 `finished`，不重複執行跳轉或動畫中止）；判斷依據為 status == `finished` 或 revealIndex == N，任一條件成立即可忽略後續重送的揭曉廣播。

**「下一位」按鈕防連點規則**：手動模式下進入 `revealing` 時，「下一位」按鈕**初始為 enabled**（revealIndex = 0，Host 可立即點擊觸發第一位玩家揭曉）。動畫播放期間按鈕呈 disabled 狀態，動畫結束後才重新啟用；防止 revealIndex 超前動畫進度導致畫面跳序。手動模式下，Host 點擊「下一位」後按鈕立即呈 disabled（樂觀禁用）；自動輪播模式下，Server 端計時器觸發後至客戶端開始播放動畫的間隙期間，按鈕同樣維持 disabled（客戶端收到 revealIndex 廣播後立即鎖定，動畫結束後才重新啟用）。**自動輪播首次觸發期間按鈕狀態**：Host 啟動自動輪播後至首次 revealIndex +1 廣播前（即 autoRevealInterval 倒數期間），「下一位」按鈕應維持 disabled 狀態，防止手動插入觸發導致重複遞增。**啟動自動輪播後按鈕 disabled 的觸發時機**：Host 送出 enable 請求後，客戶端應**等待 Server ack**（即收到 `ROOM_STATE` 廣播 autoReveal=true 後）才將「下一位」按鈕設為 disabled——與切換回手動後等 ack 才解鎖的策略對稱；不採樂觀禁用（本地點擊後立即 disabled），因為若 enable 請求因競態被 Server 拒絕，樂觀 disabled 會造成按鈕永久無法恢復；若網路延遲導致 ack 未及時到達，按鈕在等待期間保持 enabled，Host 仍可手動點擊（此為可接受的 UX 行為，等 ack 到達後再禁用）。**切換為手動時的按鈕狀態**：**「下一位」按鈕初始狀態決策入口說明**：① live 首次進入揭曉畫面（收到 `ROOM_STATE_FULL` 廣播）：此廣播 autoReveal 恆為 false（保證，見 §14 `ROOM_STATE_FULL` payload 說明），因此按鈕初始為 **enabled**，套用 §7.5 規則；② 重連至 `revealing` 狀態：按鈕狀態由 §8.3 快照的 autoReveal 值決定（autoReveal=true→disabled；autoReveal=false→enabled），套用 §8.3 規則；兩條路徑使用不同觸發時機，工程師應分別實作，不可統一用同一判斷邏輯處理。Host 切換為手動模式後，Server **立即以原子方式持久化 autoReveal = false（寫入 DB 後廣播）**，確保 Host 在 ack 廣播送達前重連時，重連快照中的 autoReveal 已反映切換後的值；Server 送出 **`ROOM_STATE` 事件**（包含 autoReveal = false）作為 mode-switch ack（文件其他段落如提及「mode-switch ack broadcast」均指此 `ROOM_STATE` 事件）；客戶端收到此廣播後才恢復「下一位」按鈕 enabled 狀態，不應僅憑本地取消倒數顯示即提前解鎖，以防 FIFO 佇列中尚有計時器觸發事件未執行完畢而導致重複遞增。

**「一鍵全揭」與動畫衝突規則**：「一鍵全揭」不受動畫鎖影響，可在 `revealing` 狀態任意時刻點擊；點擊後立即中止當前播放中的動畫（含最後一位玩家的動畫），所有端直接跳至完整結果畫面（`finished`）。所有玩家的結果（含動畫被中止的最後一位）均在 `finished` 結算頁上完整顯示，不補播未完成的動畫。**「一鍵全揭」廣播識別**：Server 廣播中需攜帶 `revealAll: true` 旗標（有別於一般 revealIndex +1 廣播），客戶端收到 `revealAll: true` 時立即中止當前動畫並跳轉結算頁，不執行「等待最後一位動畫完畢」邏輯；一般逐步揭曉至 revealIndex = N 的廣播不帶此旗標，live 客戶端若正在播放最後一位動畫，依正常動畫等待邏輯（待動畫完畢後跳轉）。**此規則僅適用於逐步揭曉路徑**（不帶 `revealAll`）；`revealAll: true` 路徑一律立即跳轉，無動畫等待。

**高人數顯示策略**：

| 模式 | 說明 | 適合 |
|------|------|------|
| 總覽模式 | 顯示完整樓梯縮圖 | 看整體結構 |
| 聚焦揭曉模式 | 強調當前玩家路徑，其他淡化 | 多人活動主場景 |
| 個人視角模式 | 玩家裝置只看自己走線結果 | 玩家端體驗 |

MVP 採：Host 端使用聚焦揭曉模式；玩家端使用個人視角模式。Host 端與玩家端為兩個不同的前端畫面。

**玩家端揭曉畫面行為規格**：
1. **尚未輪到自己時**：顯示進度文字，分母 = N（live 路徑：N 在 `waiting→running` 廣播（名單凍結）後即已確定，客戶端可從 `waiting→running` 廣播的 players 陣列長度或隨後到達的 `ROOM_STATE_FULL` 廣播的 players 陣列長度取得，兩者必然一致；**建議以 `ROOM_STATE_FULL` 為初始化時機**，因其為正式進入揭曉畫面的觸發廣播，時序明確；重連路徑取自重連快照中的 players 陣列長度），分子依當前揭曉狀態分兩種情況：①　**動畫播放期間**（revealIndex = k，startColumn = k-1 的玩家動畫尚在播放），顯示「正在揭曉第 k / N 人」；②　**動畫結束後至下一次觸發前，以及初次進入揭曉畫面（revealIndex = 0，尚無任何動畫曾播放）**（等待 Host 手動點擊或自動輪播倒數期間），顯示「等待揭曉第 k+1 / N 人」（k = 當前 revealIndex，k=0 時顯示「等待揭曉第 1 / N 人」）或等效文字（具體措辭前端可微調，但語意須反映「已完成 k 人，下一個為第 k+1 人」）；不顯示其他玩家的走線動畫；玩家端需在重連快照中確保取得 N 值；**分母 N 在整個 `revealing` 過程中固定不變**——`revealing` 狀態下玩家不可加入或移除（isOnline 變更不影響 players 陣列長度），N 於進入 `revealing` 時確定後保持不變直至 `finished`；客戶端**不應**在每次收到 `ROOM_STATE` 廣播（isOnline 更新）後重新從 players 陣列計算 N，應沿用初次取得的 N 值
2. **輪到自己時**：動畫自動播放（不需玩家點擊觸發）；**觸發條件**：收到 `REVEAL_INDEX` 事件 k，且 `myPlayer.startColumn == k − 1`；玩家端不應使用 `k == myPlayer.startColumn` 作為判斷（差一），否則動畫播放時機將落後一輪
3. **自己揭曉完畢後**：停留在個人結果畫面（顯示「中獎」或「未中獎」），等待所有人揭曉完畢後自動跳轉結算頁；跳轉時機為 Room 狀態變為 `finished`；**autoReveal 倒數 UI 清除時機**：收到 `REVEAL_INDEX`（k=N，攜帶 status=`finished`）後應**立即**清除 autoReveal 倒數 UI 顯示，**不等待最後一位玩家動畫播放完畢**——動畫等待期間倒數 UI 繼續顯示會誤導玩家以為遊戲仍在輪播（§14 `REVEAL_INDEX` payload 說明亦有相同要求，玩家端揭曉畫面在此步驟需與 §14 規範對齊）
4. **收到 `revealAll: true` 廣播時**：無論目前處於第 1/2/3 步的哪個階段，**同樣立即清除 autoReveal 倒數 UI 顯示**（與步驟 3 收到 `status=finished` 時相同）；立即中止當前動畫（若有）並直接跳轉結算頁，不補播未完成的動畫；結算頁完整顯示所有玩家結果

**玩家端無需額外 UI 鎖定邏輯**：玩家端揭曉畫面沒有主動觸發揭曉的互動按鈕（動畫由收到 `REVEAL_INDEX` 事件自動觸發，見第 2 點），不存在需要在動畫期間禁用的揭曉控制元件；離開房間等通用互動可依產品設計決定，PDD 不強制要求。

**Host 本人揭曉行為**：Host 同時是抽獎玩家。揭曉進行到 Host 自己的 startColumn 時，Host 端（聚焦揭曉模式）正常顯示自己的路徑動畫，與其他玩家的揭曉呈現方式一致；Host 不需切換至個人視角模式。**揭曉控制面板（含「下一位」按鈕）在 Host 自身動畫播放期間維持 disabled 狀態**，動畫結束後按鈕重新啟用，Host 可繼續控制下一位；「仍可操作」意指控制面板不因輪到 Host 自身而隱藏或永久禁用，而非動畫播放期間可點擊——動畫期間 disabled 的防連點規則（見本節上方「下一位按鈕防連點規則」）對 Host 自身動畫同樣適用。

### 7.6 結算頁

**Host 端顯示**：
- **得獎名單**（**僅中獎者**名稱，依 startColumn 由小到大排序；與玩家端得獎名單一致）
- **所有玩家結果列表**（全部玩家名稱 + 最終結果標記（中獎 / 未中獎），依 startColumn 由小到大排序；含未中獎者；此為 Host 專屬顯示，玩家端不顯示此清單）
- 中獎統計（格式：「W / N 人中獎」）
- 再玩一局按鈕

**玩家端顯示**：
- 自己的最終結果（大字顯示「中獎」或「未中獎」）
- 本局得獎名單（僅顯示中獎者名稱，依中獎者的 startColumn 由小到大排序）
- 統計（「W / N 人中獎」）

**再玩一局語意**：

**Live 客戶端收到 `finished→waiting` 廣播的行為**：所有留在結算頁的客戶端（Host 端與玩家端）收到 status=`waiting` 的 `ROOM_STATE` 廣播後，自動導航至等待室 Lobby（不需使用者手動操作）；留存玩家（isOnline=true，未被 pruning 移除）直接以原 playerId 和暱稱顯示在 Lobby 名單中（無需重新填寫暱稱）；被 pruning 移除的玩家（isOnline=false）不在新局 players 陣列，若其客戶端仍在線且收到 `waiting` 廣播，因 playerId 已不在 players 陣列，後續 Server 將以 `PLAYER_NOT_IN_ROOM` 回應，客戶端清除 localStorage 並顯示加入頁（視同新訪客）；**雙 session 邊界情境**：若同一玩家在 `finished` 狀態下既有 isOnline=false 的 ghost 槽位，同時又以無 playerId 身分建立了匿名監聽 session（見 §14 匿名 session 升級協定），且該匿名 session 在「再玩一局」前斷線——「再玩一局」時 ghost 槽位依 pruning 規則移除（isOnline=false），斷線的匿名 session 同樣廢棄；玩家需在新局 `waiting` 後重新連線並填寫暱稱加入，屬預期行為，不需特殊處理；Host 端在 Lobby 立即顯示「再玩一局」後的新等待室狀態（含更新後的 players 名單與保留的 winnerCount）。

**Server 端前置驗證**：收到「再玩一局」請求時，Server 必須驗證：①　請求的 playerId == Room.hostId（§11.2 授權驗證）；②　Room.status == `finished`（狀態驗證）；③　送出請求的連線對應的 Host 玩家 isOnline=true（**Host 必須在線才能觸發**，與 §7.1「MVP：Host 離線後房間停止操作」一致；若 isOnline=false，Server 回傳 `UNAUTHORIZED`，此情況在 MVP 下不應發生，因為 Host 離線後客戶端失去連線無法送出請求，屬防禦性驗證；**此驗證確保 MVP 下「Host isOnline=false 進入新局」的路徑實際上不觸發**——§9 Player.isOnline 末段說明此情境的防禦性行為定義，係為未來寬鬆化預留；兩處說明語意一致：此驗證確保「當前不觸發」，§9 定義確保「若未來寬鬆化後觸發，行為有明確定義」）。**前置驗證使用即時 isOnline 值**：①②③ 三項驗證均使用**請求到達時的即時 DB 值**（非後續原子操作的快照值）；特別地，③ isOnline 檢查在原子操作執行前進行，若驗證通過後 Host 在原子操作期間斷線，Host 仍被保留（符合「Host 即使 isOnline=false 亦不移除」規則，詳見下方 pruning 規則），屬預期行為。若 status 非 `finished`（如 `waiting`、`running`、`revealing`），Server 回傳 `PLAY_AGAIN_NOT_ALLOWED_IN_STATE` 錯誤，客戶端靜默忽略（按鈕在非 `finished` 狀態應已隱藏）；若發生競態（客戶端送出請求時房間仍為 `finished`，但 Server 處理前已轉換），同樣回傳此錯誤，客戶端靜默忽略並等待下一個狀態廣播。

Host 點擊「再玩一局」後：
- 保留相同 Room ID 與 Room Code
- Room 狀態重置為 `waiting`
- 移除 isOnline=false 的玩家，僅保留連線中（isOnline=true）的玩家；Host（Room.hostId 對應的玩家）即使 isOnline=false 亦不移除，確保 Room 始終有有效的 hostId；若被踢除玩家的 WebSocket session 仍在連線中（導回頁面延遲），Server 不主動補發重連許可，被踢除玩家需主動重新訪問加入頁面並填入暱稱才視為新局加入；**pruning 快照時機**：pruning 使用**原子操作執行時的 DB 讀取值**（即原子事務中第一次讀取 players 陣列的那一刻），若某玩家在此讀取之後、原子寫入完成之前斷線，其在原子操作開始時已讀到的 isOnline 值（為 true）決定其是否保留——保留為預期行為；此規則與前置驗證 ③ isOnline 檢查（「請求到達時的即時值」）的時間點不同，但兩者之間的窗口極短且行為差異可接受（前置驗證 ③ 僅針對 Host，pruning 針對一般玩家）
- 清空 ladderMap、resultSlots、revealIndex（設為 0）、seed（設為空字串）、rowCount（重置為 0）、autoReveal（重置為 false）、autoRevealInterval（重置為 3）、所有玩家的 **startColumn**、endColumn 與 result（均重置為 null）
- 每位玩家的 startColumn **不在此時分配**，待新局 Host 點擊「開始遊戲」時由 Server 端與 ladderMap 同一原子操作中分配
- 歷史局次結果不保留（MVP 不設多局記錄）
- **原子性保證**：以上所有重置欄位與玩家名單修剪以單一原子操作完成；重置完成後廣播新的 `waiting` 狀態；重置操作完成前不廣播中間狀態，客戶端無需處理過渡狀態
- 離開房間的玩家（isOnline = false）不自動計入新局；如需加入須重新連線
- **離線玩家移除（pruning）後 W 越界處理**：移除 isOnline=false 玩家後，若保留的 winnerCount W > 新 N-1（主要越界情境）或 W ≤ 0（防禦性檢查；理論上不可能觸發，因再玩一局時 winnerCount 保留前局整數值，而前局開局驗證已保證 W ≥ 1；若觸發視為 Server bug，應記錄 error log），則 W 值保留原整數不變，但標記為無效狀態（由 Server/客戶端實時判斷 W 合法性），Lobby 顯示「中獎名額不合法，請重新設定（目前 W={W}，人數 N={N}）」，「開始遊戲」按鈕保持禁用，直到 Host 修改 W 至合法範圍。**N=1 特殊邊界**：若 pruning 後僅剩 Host 一人（N=1），合法 W 範圍為 1 ≤ W ≤ 0 = 空集合——不存在任何合法的 W 值；此時 winnerCount 輸入框應完全禁用（不允許輸入），提示文字顯示「人數不足，請等待更多玩家加入」（**與 §7.2 踢除後 N=1 的 winnerCount 輸入框行為保持一致**；兩個觸發路徑（踢除 vs pruning 後 N=1）呈現相同 UI，不因觸發來源而異），「開始遊戲」按鈕禁用並優先顯示「人數不足」提示（§7.2 按鈕禁用優先序）；Host 提交任何 W 值均無效，Server 同樣回傳 `INVALID_WINNER_COUNT`

### 7.7 即時同步

**必須同步的資料**：
- 房間狀態（status）
- 玩家名單（players）
- Host 設定（winnerCount）
- **房間名稱（title）**（Host 修改時即時廣播至所有端；見 §7.1 title 修改規則與 §14 `ROOM_STATE` 觸發條件）
- ladderMap（遊戲開始後）
- resultSlots（遊戲開始後）
- 當前揭曉進度（revealIndex，由 Server 端驅動遞增，廣播至所有端）
- 玩家線上狀態（isOnline）

**同步特性**：
- 所有玩家看到的房間名單一致
- ladderMap 與 resultSlots 由 Server 寫入後推送至所有端，不由 client 計算
- 結果不可因延遲或重連而改變

---

## 8. 使用者流程

### 8.1 Host Flow

1. Host 填寫暱稱（必填）並建立房間；Server 同步生成 Host 的 playerId 並將 Host 加入 players 陣列（取得 Room Code）
2. 設定中獎名額
3. 分享 Room Code / 連結
4. 觀察玩家加入（等待室即時更新）
5. 確認人數 ≥ 2 且中獎名額合法後，按「開始遊戲」
6. Server 生成樓梯與獎位；Host 端顯示「遊戲開始中，請稍候…」過渡畫面（與 §8.3 `running` 重連畫面邏輯相同），**同時啟動 15 秒逾時計時器**（與 §8.2 步驟 4 玩家端規則相同，見 §8.3）；收到 **status=`revealing` 或 status=`waiting` 的廣播**後取消計時器並自動跳轉（**注意：`running` 狀態中可能收到 isOnline 更新的 `ROOM_STATE` 廣播，這類廣播 status 仍為 `running`，不應取消計時器**；僅 status 轉換至 `revealing` 或 `waiting` 才取消；**`running→revealing` 轉換的廣播使用 `ROOM_STATE_FULL` 事件**（非 `ROOM_STATE`），客戶端需同時監聽 `ROOM_STATE` 和 `ROOM_STATE_FULL` 兩種事件以偵測 `revealing` 狀態，否則若只監聽 `ROOM_STATE`，計時器永不被 `revealing` 觸發取消；詳見 §14）；若 15 秒內未收到任何狀態廣播，顯示「連線逾時，請重新整理頁面」
7. 進入揭曉畫面，依序控制揭曉節奏
8. 顯示最終中獎名單（結算頁）
9. 可選擇「再玩一局」（重置房間）或結束

### 8.2 Player Flow

1. 點入 Room URL
2. 輸入暱稱，取得 playerId 並存入 localStorage
3. 進入等待室（看到玩家名單與「等待主持人開始」提示）
4. Host 開始後，若 Server 原子寫入尚未完成，客戶端先顯示「遊戲開始中，請稍候…」過渡畫面（與 §8.3 `running` 重連畫面邏輯相同）；客戶端進入 `running` 狀態時啟動 15 秒逾時計時器（僅在 `running` 狀態有效），收到 `revealing` 或 `waiting` 廣播後取消計時器並跳轉（**`running→revealing` 廣播使用 `ROOM_STATE_FULL` 事件，需同時監聽 `ROOM_STATE` 和 `ROOM_STATE_FULL`**，見 §8.1 及 §14）；若 15 秒內未收到任何狀態廣播，顯示「連線逾時，請重新整理頁面」；收到 `revealing` 廣播後自動跳轉至個人視角揭曉畫面
5. 觀看自己路徑動畫，查看是否中獎
6. 進入結算頁，看到自己結果與得獎名單
7. 等待下一局或離開

### 8.3 重連流程

**快速參考：各狀態重連快照欄位對照表**（詳細說明見下方各狀態描述）

| 狀態 | 必含欄位 | 可省略欄位 | 不含欄位 |
|------|---------|-----------|---------|
| `waiting` | status、hostId、title、winnerCount、autoReveal(=false)、autoRevealInterval(=3)；players：playerId、name、joinedAt、isOnline | startColumn/endColumn/result（均為null） | kickedPlayerIds、ladderMap、resultSlots、rowCount、revealIndex、seed |
| `running` | status、hostId、title、winnerCount、autoReveal(=false)、autoRevealInterval(=3)；players：playerId、name、isOnline | joinedAt（可省略，後續廣播補全）；startColumn/endColumn/result（均為null） | ladderMap、resultSlots、revealIndex、rowCount、seed |
| `revealing` | status、hostId、title、winnerCount、ladderMap、resultSlots、rowCount、revealIndex（當前值）、autoReveal、autoRevealInterval；players：playerId、name、joinedAt、isOnline、startColumn、endColumn、result；若autoReveal=true：額外含remainingSeconds（可null） | — | seed |
| `finished` | status、hostId、title、winnerCount、ladderMap、resultSlots、rowCount、revealIndex(=N)；players：playerId、name、isOnline、startColumn、endColumn、result | autoReveal、autoRevealInterval（**包含即忽略**：客戶端在 `finished` 狀態下必須忽略這兩個欄位，見 §8.3；DB 值可能殘留 true，傳送後若客戶端覆蓋快取可導致誤顯示自動輪播 UI；實作可省略這兩個欄位）；seed（可選，見§11.1） | joinedAt（`finished`格式不含）；kickedPlayerIds |

**注意**：各狀態快照必須使用獨立的序列化路徑，不得重用 `ROOM_STATE_FULL` 廣播序列化器（詳見下方「重連快照序列化路徑獨立性」說明）。

**`running` 狀態 `joinedAt` 設計決定（快照 vs 廣播不對稱說明）**：`running` 狀態快照中 `joinedAt` 可省略（見上表），但 §14 `running` 狀態 `ROOM_STATE` live 廣播的 players 陣列必須含 `joinedAt`——兩者使用**不同序列化路徑**（快照允許省略是因過渡畫面不依賴排序且後續廣播必然補全；廣播必須含 `joinedAt` 是為確保 live 客戶端的本地 players 快取能在 `ROOM_STATE_FULL` 到達前補全排序資訊）；工程師若共用序列化路徑，可能一邊省略一邊又要求包含，造成矛盾——這正是「各狀態快照使用獨立序列化路徑」原則的設計理由之一（見 §8.3「重連快照序列化路徑獨立性」）。

| 重連時的房間狀態 | 玩家看到的畫面 |
|-----------------|----------------|
| `waiting` | 等待室（現有名單與設定）；**`waiting` 狀態重連快照欄位**：Server 需包含 status（= `waiting`）、hostId、title、players（含每位玩家的 **playerId**、name、**joinedAt**、isOnline；startColumn / endColumn / result 均為 null，可包含或省略；playerId 供客戶端與 hostId 比對判斷自身是否為 Host；joinedAt 供客戶端依加入時間排序 Lobby 玩家名單，見 §7.2）、winnerCount、**autoReveal（= false）、autoRevealInterval（= 3）**（`waiting` 狀態下兩者為固定值，但明確包含於快照確保客戶端進入等待室時有完整基底狀態，與 `running` 快照欄位規格保持一致）；**`kickedPlayerIds` 不傳送給客戶端**——此清單為 Server 端驗證資料（Server 在處理重連請求時從 DB 查詢 kickedPlayerIds 進行比對），傳送給客戶端會暴露哪些玩家被踢除（隱私問題），且客戶端不需要此清單（重連時 Server 直接回傳 `PLAYER_KICKED` 錯誤）；**此快照規格同樣適用於 rollback 後的 `waiting` 快照**——`running→waiting` rollback 後 Room status 回到 `waiting`，重連至此狀態的客戶端需收到符合本規格的完整快照（payload 結構與正常 `waiting` 快照一致，kickedPlayerIds 的 Server 端查詢驗證同樣適用）；**此快照規格亦適用於 `finished→waiting`（再玩一局）後的 `waiting` 快照**：`finished→waiting` 重置為原子操作（§7.6），重連快照必然反映完整重置後的狀態（autoReveal=false、autoRevealInterval=3、revealIndex=0 等），不存在讀取到半完成重置狀態的風險；`waiting` 快照中 autoReveal=false、autoRevealInterval=3 為再玩一局後的固定值，不因讀取時序不同而有差異（§8.3 `running` 原子寫入的快照排隊保證對此轉換同樣適用，確保重連請求序列化於原子操作完成後） |
| `running` | 過渡等待畫面（顯示「遊戲開始中，請稍候…」）；畫面持續監聽房間狀態廣播：收到 `revealing` 自動跳至揭曉畫面，收到 `waiting`（生成失敗回退）自動跳回等待室；收到 **status=`revealing` 或 status=`waiting` 的廣播**後立即取消 15 秒逾時計時器（收到 status=`running` 的 isOnline 更新等廣播不取消計時器）；若 15 秒內未收到 status 轉換廣播，顯示錯誤提示「連線逾時，請重新整理頁面」。此 15 秒逾時邏輯同時適用於初次進入（Host 點擊開始後）與重連兩種場景。**重連路徑的計時器起點為重連快照到達時**（即客戶端收到 `running` 快照的那一刻視為「進入 `running` 狀態」，計時器從此刻開始）；與初次進入路徑（Host 點擊開始後收到 `waiting→running` 廣播時啟動）的語意一致——兩種路徑均以「收到 `running` 狀態的第一則訊息時」啟動計時器。**重連快照欄位**：`running` 狀態快照至少需包含 status（= `running`）、hostId、players（含每位玩家的 **playerId**、**name**、**isOnline**；playerId 供客戶端與 hostId 比對判斷自身是否為 Host；name 供過渡畫面及後續揭曉畫面顯示；joinedAt 在 `running` 快照中**可省略**，因過渡畫面不依賴排序，且 `ROOM_STATE_FULL` 或 rollback `ROOM_STATE` 將很快到達並攜帶完整資料；**此省略與 §14 `running` 狀態 `ROOM_STATE` 廣播規格不矛盾**：`running` 狀態中送出的 isOnline 更新 `ROOM_STATE` 廣播的 players 陣列含 `joinedAt`（§14 規格），客戶端收到後應補足本地 `joinedAt` 快取；在快照到達後、首次含 `joinedAt` 廣播到達前若需顯示玩家排序，可暫以 playerId 字典序作為 fallback 排序（過渡畫面期間此情境出現機率極低）；若後續 `ROOM_STATE` 廣播到達補足 `joinedAt`，客戶端應依 §7.2 重新排序（允許名單突然重排），不應為「避免跳動」而固守 playerId 字典序——正確排序的一致性優先於過渡畫面名單穩定性；**（注意：`running` 過渡畫面不顯示玩家名單（見 §6.2），此排序邏輯主要為 rollback 後重返等待室 Lobby 時的正確排序做準備）**；**若在任何含 `joinedAt` 的廣播到達前便收到 rollback 廣播（`running→waiting`），rollback 廣播本身亦攜帶含 `joinedAt` 的完整 players（§14 `ROOM_STATE` waiting 格式），rollback handler 應更新完整 players 快取（含 `joinedAt`），確保等待室 Lobby 依正確 joinedAt 排序**；**`joinedAt` 補全來源彙整**：① 正常路徑：`running` 快照（joinedAt 可省略）→ `ROOM_STATE` isOnline 廣播補足（§14 running 廣播規格含 joinedAt）→ 或 `ROOM_STATE_FULL` 廣播補足；② rollback 路徑：`running` 快照（joinedAt 可省略）→ rollback `ROOM_STATE` 廣播補足（必然攜帶含 joinedAt 的完整 players）；兩條路徑均可在 Lobby 排序需要前補全，`running` 快照不強制包含 joinedAt；startColumn / endColumn / result 在 `running` 狀態為 null，可省略）、**winnerCount**（**`running` 快照必須包含 winnerCount**：`running` 重連客戶端已錯過 `waiting→running` 廣播，且 `ROOM_STATE_FULL` 不含 winnerCount（設計如此，見 §14），因此 `running` 重連快照是此客戶端取得 winnerCount 的主要途徑（`running` 狀態中如有 isOnline 更新廣播亦攜帶 winnerCount，但此類廣播可能未到達；快照是確保取得 winnerCount 的可靠途徑）；若此快照省略 winnerCount，客戶端在 `revealing` 前均無法顯示 W 值）、title、**autoReveal（= false）、autoRevealInterval（= 3）**（`running` 期間兩者不可更改，值必然為預設值——`autoReveal` 僅可在 `revealing` 狀態切換，`finished→waiting` 再玩一局時已重置為 false 與 3（見 §7.6 reset 清單）；明確包含於快照可讓客戶端在接收後續 `ROOM_STATE_FULL` 廣播前有完整的基底狀態，避免客戶端以舊值或未初始化值處理後續廣播）；ladderMap / resultSlots / revealIndex / rowCount 在 `running` 狀態尚未原子寫入，不包含於此快照（rowCount 同樣在 `running→revealing` 原子寫入時才計算並儲存，快照中不回傳此欄位或回傳 0 表示尚未計算；**`running` 快照 rowCount=0 與「再玩一局」後 `waiting` 快照 rowCount=0 語意相同——均代表「尚未計算」**，客戶端統一以「rowCount 不可用，等待 `ROOM_STATE_FULL` 補全」處理，不需區分兩種來源；**`revealIndex` 不含於 `running` 快照——客戶端在 `running` 狀態無需使用 `revealIndex`，亦不應初始化本地 `lastReceivedRevealIndex`；`lastReceivedRevealIndex` 應於收到 `ROOM_STATE_FULL` 廣播時以 payload 中的 `revealIndex = 0` 初始化（見 §14 `ROOM_STATE_FULL` payload 說明），而非從 `running` 快照推算；若實作以 0 作為 `running` 快照的隱含 revealIndex 預設值，效果相同，但不應視為「快照攜帶 revealIndex=0」**）。**rollback 後客戶端 15 秒計時器到期情境**：若 Server `waiting` rollback 廣播遺失導致客戶端 15 秒先到期，客戶端顯示逾時提示；玩家手動重整後以 playerId 重連，此時 Room.status 已為 `waiting`（rollback 已完成），快照為 `waiting` 狀態，客戶端依 §7.2 正常顯示等待室（players 陣列為原凍結名單，isOnline=false 玩家以灰色標示），流程與正常重連完全一致 |
| `revealing` | 個人視角揭曉畫面，顯示當前 revealIndex 進度；**「不重播動畫」的精確語意**：重連快照 startColumn < revealIndex 的玩家一律顯示靜態最終結果（revealIndex 包含當前正播放中的 startColumn = revealIndex − 1）——「正在其他客戶端播放中的動畫」對重連客戶端而言同樣歸入「已完成」類，直接顯示靜態結果；**重連後收到的第一個新 `REVEAL_INDEX` 廣播不屬於補播**：設快照中的 revealIndex = R，重連後第一個廣播攜帶新值 R+1；此廣播對應 startColumn = R 的玩家（觸發條件：startColumn == (R+1) − 1 = R）；此玩家在重連客戶端上首次播放此動畫，是正常播放而非補播，應按觸發條件正常播放，此為設計預期行為；若尚未觸發（startColumn ≥ revealIndex）則顯示等待進度；**Host 重連另見下方「Host 重連至 `revealing` 狀態」散文補充說明**（聚焦揭曉模式、autoReveal 剩餘倒數恢復等 Host 特有行為）。**`revealing` 狀態重連快照欄位**：Server 需包含 status（= `revealing`）、hostId、players（含每位玩家的 **playerId**、name、**joinedAt**、isOnline、startColumn、endColumn、result；**joinedAt 須包含**以與 `ROOM_STATE_FULL` players 格式保持一致，確保重連快照的 players 快取完整，避免後續 `ROOM_STATE_FULL` 未到達時 joinedAt 永久為 null；playerId 供客戶端識別 myPlayer，用於 §7.5「觸發條件：myPlayer.startColumn == k − 1」比對）、winnerCount、ladderMap、resultSlots、rowCount、revealIndex（當前值）、autoReveal、autoRevealInterval、title；**不含 seed**（見 §11.1）；若 autoReveal=true，額外包含 remainingSeconds（Server 即時計算的剩餘倒數秒數，可為 null；**null 情境同時涵蓋 revealIndex>0 分支（`lastRevealBroadcastAt` 遺失）與 revealIndex=0 分支（`autoRevealStartedAt=null`，含 disable-then-reconnect 競態）**，兩個分支均可能回傳 null，詳見下方「Host 重連至 `revealing` 狀態」及 §7.5 決策表第 5 列說明） |
| `finished` | 結算頁；**`finished` 狀態重連快照欄位**：Server 需包含 status（= `finished`）、hostId、players（含每位玩家的 **playerId**、name、result、isOnline、startColumn、endColumn；playerId 供玩家端識別自己的最終結果（§7.6「自己的最終結果」）；**`finished` 狀態格式不含 `joinedAt`**——結算頁依 startColumn 排序中獎者（§7.6），不需 joinedAt；live 客戶端在 `finished` 狀態收到不含 `joinedAt` 的 `ROOM_STATE` isOnline 廣播（§14）後，本地 players 快取將遺失 `joinedAt`；此為預期行為——結算頁無需 joinedAt 排序，`finished→waiting` 廣播（§14）必然攜帶含 `joinedAt` 的完整 waiting 格式 players，等待室 Lobby 排序不受影響；客戶端不應在 `finished` 狀態 ROOM_STATE handler 中嘗試保留或合併 `joinedAt`（結算頁不依賴此欄位））、winnerCount、ladderMap、resultSlots、rowCount、revealIndex（= N）、title；**seed 可選擇性公開**（見 §11.1）；autoReveal、**autoRevealInterval** 欄位**可省略（實作可包含或省略，見快速參考表「包含即忽略，實作可省略」標注）**——兩個欄位無客戶端效果（結算頁不顯示揭曉控制項，客戶端應忽略這兩個值）；**注意：快照包含 autoReveal/autoRevealInterval，但 §14 `finished` 狀態 live ROOM_STATE 廣播不攜帶這兩個欄位——兩者使用不同序列化路徑（快照從 DB 完整讀取，live ROOM_STATE 只傳送有效更新欄位）；快照中包含的 autoReveal 值客戶端應忽略（上方已說明），live ROOM_STATE 不攜帶這兩個欄位是為了避免以可能為 `true` 的 DB 值意外覆蓋客戶端快取；工程師需確認這兩條序列化路徑不共用同一組裝邏輯**；**客戶端在收到 `finished→waiting` 廣播後，應以廣播攜帶的 `autoReveal=false` 覆蓋本地快取，不沿用 `finished` 狀態遺留的 `autoReveal` 值（DB 可能保留 true）渲染等待室初始 UI——`finished→waiting` 廣播強制攜帶 `autoReveal=false`（見 §14），客戶端收到此廣播即完成快取重置，無需在 status 切換時手動清除** |

**重連快照原子性**：Server 返回的房間快照必須反映重連請求被處理瞬間的最新 revealIndex；重連握手與 revealIndex 讀取須在同一個原子操作或讀屏障之後完成，避免客戶端收到的快照落後於此時已廣播的最新值。若重連請求到達時 Server 正在執行任何 `running` 狀態的原子寫入（包含成功路徑 `running → revealing` 與回退路徑 `running → waiting`），重連請求應排隊等待原子操作完成後再返回快照，確保客戶端不會先收到 `running` 快照後又立即收到原子寫入廣播（`ROOM_STATE_FULL` 或 `waiting` 廣播）（詳見 §14 事件目錄）。**快照傳送優先序保證**：Server 在處理重連請求時，應在同一處理週期內優先將快照寫入該客戶端的 WebSocket 傳送佇列，再允許後續廣播進入佇列；此「快照先於廣播到達」保證確保客戶端不會先收到後發的廣播（如 Host 在重連期間送出 disable autoReveal 所觸發的 `ROOM_STATE(autoReveal=false)`）再收到快照——若廣播先到，快照晚到時會以較舊的 `autoReveal=true` 覆蓋已套用的 `autoReveal=false`，造成 UI 狀態迴退；若 Server 架構無法在同一週期保證此傳送順序（如非同步廣播架構），應在 PRD 技術規格中說明替代保序機制（如快照攜帶 serverSequence 序號，客戶端以序號判斷廣播是否比快照更新，僅套用序號較新的值）。

**重連快照序列化路徑獨立性**：各狀態的重連快照組裝**必須使用獨立的 Server 端程式碼路徑**，直接從 DB 讀取完整欄位集合，**不得重用 `ROOM_STATE_FULL` 廣播序列化器**——兩者的欄位集合在各狀態下均有差異（例如：`running` 快照含 winnerCount/title/autoReveal/autoRevealInterval，不含 ladderMap/resultSlots/revealIndex/rowCount；`ROOM_STATE_FULL` 廣播含 ladderMap/resultSlots 但不含 winnerCount；`finished` 快照含 autoReveal/autoRevealInterval，`ROOM_STATE_FULL` 亦不包含）；若複用同一序列化器，任何為廣播路徑新增或移除的欄位都可能意外影響快照內容，且這類欄位集合漂移難以在 code review 時被察覺；工程師應為各狀態重連快照建立獨立的快照組裝函式，各函式分別對照本節欄位規格維護，修改廣播序列化邏輯時不影響快照路徑。

**Host 重連至 `revealing` 狀態**：Host 端顯示聚焦揭曉畫面；startColumn < revealIndex 的玩家顯示靜態已揭曉結果（不重播動畫，含正在動畫中的 startColumn == revealIndex - 1 的玩家）；startColumn ≥ revealIndex 的玩家顯示等待進度；Host 可立即繼續操作揭曉控制（下一位 / 自動輪播 / 一鍵全揭）；**若 autoReveal=true（不論 revealIndex 為何），重連後「下一位」按鈕必須立即呈 disabled 狀態**——Server 已在自動執行倒數，Host 無法手動觸發揭曉，「切換為手動」按鈕仍可點擊以停止自動輪播；特別是 revealIndex=0 時（首位尚未揭曉），Server 已啟動 autoRevealInterval 倒數，「下一位」同樣不可點擊；若 autoReveal=true，Server 在房間狀態快照中包含當前倒數計時剩餘秒數，客戶端以此值恢復倒數顯示（若工程成本過高可改顯示「自動輪播進行中」指示器）。**若 autoReveal=false（手動模式），重連後「下一位」按鈕初始為 enabled**——重連時不重播任何動畫（所有 startColumn < revealIndex 玩家直接顯示靜態結果），因此不存在「動畫播放中」狀態，按鈕無需等待動畫結束；Host 可立即點擊繼續揭曉下一位。**此剩餘秒數為 Server 端在生成快照時即時計算的暫態值**，非持久化 DB 欄位，不寫入 Room 資料模型；Room 模型中僅有 autoReveal（boolean）與 autoRevealInterval（固定配置值），工程師不應嘗試從 DB 讀取剩餘秒數。**正確計算公式**（依目前 revealIndex 狀態而異）：
- **revealIndex > 0**（已揭曉至少一位）：Server 時序為「廣播後等 2 秒 + autoRevealInterval 倒數」，故剩餘 = `max(0, (ANIMATION_DURATION_SECONDS + autoRevealInterval) − (當前時間 − 上次 revealIndex 廣播時間))`；**若「上次 revealIndex 廣播時間戳」遺失（如 Server 重啟，in-memory 時間戳清除），回傳 `remainingSeconds = null`**，客戶端直接顯示「自動輪播進行中」指示器，不嘗試精確倒數（此規則與 §7.5「Server 廣播時間戳記錄（in-memory）」一致）；**邊界情境**：若 Host 曾連續快速 enable→disable→enable，`lastRevealBroadcastAt` 可能指向較早的廣播時刻，公式產生 `max(0, 0) = 0`；客戶端顯示 0 秒後即收到下一次 +1 廣播，屬視覺瑕疵，不影響遊戲邏輯，可接受；**disable-then-reconnect 競態對此分支的影響**：此競態為「Host 已 disable autoReveal，但 DB 寫入尚未完成；重連快照讀到 `autoReveal=true`（舊值）但計時器已停止」；此時 `lastRevealBroadcastAt` 可能仍存在（其值與 autoReveal enable/disable 操作無關，為最近一次 revealIndex 廣播的時間戳），公式將計算出一個正值並顯示「剩餘 N 秒」——但實際上計時器已不在運作，此顯示為錯誤值；**修正策略**：Server 在 disable 廣播（ROOM_STATE autoReveal=false）到達客戶端時，客戶端須立即清除倒數 UI；詳見下方「客戶端顯示『自動輪播進行中』指示器時，須持續監聽 ROOM_STATE 廣播」說明——此機制同樣適用於此競態的修正（收到 autoReveal=false 廣播後清除倒數 UI 並解鎖按鈕）；若 Server 重啟導致 `lastRevealBroadcastAt=null`，則回傳 `remainingSeconds=null`（與 Server 重啟原因無關的 disable-then-reconnect 不導致 null）；**客戶端顯示「自動輪播進行中」指示器時，須持續監聽 `ROOM_STATE` 廣播——若後續收到攜帶 `autoReveal=false` 的廣播，應立即清除自動輪播 UI 並解鎖「下一位」按鈕（不應等待下一次重連快照），與 revealIndex=0 分支收斂路徑一致（見下方 revealIndex=0 說明）**
- **revealIndex = 0**（首位尚未揭曉，autoReveal 剛啟動）：Server 直接啟動 autoRevealInterval 倒數（無動畫等待），剩餘 = `max(0, autoRevealInterval − (當前時間 − autoReveal 啟動時間))`；此情境需記錄 autoReveal 啟動時間戳（Server in-memory，**不寫入 DB，不傳送原始時間戳至客戶端**）；**此時間戳在每次 Host 切換為自動輪播（enable）時重置**（不沿用前一次啟動的時間，否則第二次啟動的剩餘秒數計算將以前一次啟動時間為基準，偏差過大）；**Host 切換回手動（disable）時，此 in-memory 時間戳亦應清除（設為 null）**，確保後續若 Host 再次 enable 時，時間戳從 enable 瞬間重新計算，不受前一次 enable 的殘留值影響；**若 autoReveal 啟動時間戳遺失（如 Server 重啟後竟態窗口中 Host 重新送出 enable 請求、eager write 尚未完成），或 disable-then-reconnect 競態（Host 已 disable 使 `autoRevealStartedAt` 清為 null，但 DB 中 `autoReveal` 尚未反映 disable write，快照讀到 `autoReveal=true` 但 `autoRevealStartedAt=null`），回傳 `remainingSeconds = null`；統一規則：`autoRevealStartedAt = null` 時一律回傳 `remainingSeconds = null`，不需分情境判斷；客戶端直接顯示「自動輪播進行中」指示器，不嘗試精確倒數；**客戶端顯示此指示器時仍須繼續監聽 `ROOM_STATE` 廣播——若後續收到攜帶 `autoReveal=false` 的 `ROOM_STATE`，應立即清除自動輪播 UI 並解鎖「下一位」按鈕（不應等待下一次重連快照），此路徑對應 disable-then-reconnect 競態的最終收斂**；重連時 Server 以此時間戳計算已過秒數，將剩餘秒數作為預算值（整數或浮點秒）寫入快照 payload 傳送，客戶端以此值直接恢復倒數顯示，不需自行計算時間差；或改顯示「自動輪播進行中」指示器（工程成本較低）

注意：PDD 已標注「若工程成本過高可改顯示指示器」；若選擇精確倒數實作，必須使用上述正確公式，否則倒數顯示將系統性偏差。

**異常狀態處理**：若重連時 status == `revealing` 且 revealIndex == N（可能因 Server 異常中斷導致 status 未更新為 `finished`），客戶端視同 `finished` 狀態，直接顯示結算頁。

---

## 9. 資料模型

### Room

```
roomId        : string       // 系統生成唯一 ID
roomCode      : string       // 6 碼唯一識別碼，唯一索引，跨局保留不變
hostId        : string       // Host 的 playerId（Host 同時也是 players 陣列中的一員）；**所有重連快照及 ROOM_STATE / ROOM_STATE_FULL 事件 payload 均必須包含 hostId**，客戶端以此欄位與本地 localStorage 中的 playerId 比對，判斷當前使用者是否為 Host，以控制 Host 專屬按鈕的顯示與禁用；**此要求僅適用於重連快照及 ROOM_STATE / ROOM_STATE_FULL 事件，輕量廣播事件（`REVEAL_INDEX`、`REVEAL_ALL`）不重複攜帶 hostId**（見 §14 `REVEAL_ALL` 及 `REVEAL_INDEX` k=N payload 說明）；hostId 不需加密或隱藏（playerId 本已由 Server 分配且 UUID 不可偽造）
title         : string       // 房間名稱（選填；建立房間時初始值 `""`（空字串）；若未填則顯示時以 Room Code 替代）
status        : RoomStatus   // waiting | running | revealing | finished
winnerCount   : number | null  // 中獎名額 W；建立房間時初始為 null；Host 開局前須設定（1 ≤ W ≤ N-1）；再玩一局時保留上局整數值不變；「無效」狀態由 Server/客戶端實時判斷（W > N-1 或 W ≤ 0），不將 winnerCount 改寫為 null
players       : Player[]     // 活躍玩家陣列（含 Host；再玩一局時移除 isOnline=false 的玩家，僅保留連線中的玩家）
ladderMap     : LadderSegment[]  // 樓梯橫槓資料（開始遊戲時原子寫入）
resultSlots   : ResultSlot[] // 底部獎位配置（開始遊戲時原子寫入）
revealIndex   : number       // 已觸發揭曉的玩家數量（建立房間時初始值 0 = 無人觸發；再玩一局時重置為 0，見 §7.6）；Host 每次點擊「下一位」或自動輪播時 Server 將 revealIndex +1（k → k+1），客戶端收到 revealIndex = k（k ≥ 1）後播放 startColumn == k-1 的玩家動畫；二態語意（重連用）：startColumn < revealIndex = 已觸發（顯示靜態最終結果）；startColumn ≥ revealIndex = 待觸發（顯示等待進度）；= N 時全員完成，觸發 finished
seed          : string       // 隨機種子（開始遊戲時生成，供事後驗算）；建立房間時初始值 `""`；再玩一局後重置為 `""`；**具體字串格式**（如 hex、base64 或 UUID 等編碼方式）與 PRNG 初始化方式一併待 PRD 技術規格確認（見 §16 開放問題與 §11.1 PRNG 阻塞警告）；確定前工程師應避免先行實作 seed 序列化邏輯，以免格式更改後需重寫
rowCount      : number       // 建立房間時初始值 0；= clamp(N × 3, 20, 60)（開始遊戲原子寫入時計算並儲存；此 N = 凍結後 players 陣列全部長度，**不論 isOnline 狀態，含斷線玩家**，與 §6.2 步驟 5 驗證所用的 N 定義相同）；供客戶端渲染底部槽位與終止行走演算法使用；再玩一局時重置為 0，新局開始後重新計算
kickedPlayerIds : string[]  // 本局被踢除的 playerId 清單；建立房間時初始值 []；再玩一局時重置為 []；**此陣列無硬性長度上界**：`waiting` 期間同一物理玩家可在被踢後以新 playerId 重新加入，若再次被踢，kickedPlayerIds 將包含同一人的多個不同 playerId 條目，使列表長度略超 N-1；N-1（最大 49）僅為「每位玩家各被踢一次」情境下的理論參考值，**工程師實作防禦邏輯時不應以此為硬性上界**；此為預期行為——開局驗證以「當前 players 陣列長度」為基準，kickedPlayerIds 長度不納入開局 N 的計算；Server 比對重連 playerId 時以線性搜尋此陣列，長度在合理範圍內無需額外索引；**此陣列保證唯一性（集合語意）**：Server 在新增前需確認 playerId 不已存在，防止 Host 重複踢除請求（如快速雙擊）寫入重複條目；**此唯一性約束僅針對同一 playerId**（即同一 UUID 不可重複出現）；同一物理玩家在被踢後以新 playerId 重新加入並再次被踢，其每次取得的不同 playerId 均為合法獨立條目，均可加入此陣列，不受唯一性約束限制（此為 §7.1 描述的「lists 長度略超 N-1」情境）；實作建議使用 Set 或寫入前先線性搜尋確認
autoReveal    : boolean      // 揭曉模式（false = 手動；true = 自動輪播）；初始值 false；再玩一局時重置為 false；**`finished` 狀態下此欄位 DB 值可能保留 true**（`revealing→finished` 轉換不重置此欄位——Server 在轉換時取消計時器但不寫回 false，見 §7.5「轉換時 Server 取消自動輪播計時器，autoReveal 欄位值保留（不重置）」；`finished→waiting` 廣播時 Server 在「再玩一局」原子操作中重置為 false，同時廣播明確攜帶 `autoReveal=false`，見 §14 `ROOM_STATE` `finished→waiting` 廣播說明）；此為預期行為（無計時器在運作）；`finished` 狀態下客戶端應忽略此值（見 §8.3 `finished` 快照）；再玩一局時重置為 false；**TTL 過期時房間整行刪除**（非個別欄位重置），autoReveal=true 的殘留 DB 值隨整行刪除一併清除，無需在 TTL 清理邏輯中額外重置此欄位——若 TTL 機制改為 soft delete（標記刪除而非整行移除），需額外確認此欄位的殘留值不影響分析查詢邏輯，但 MVP 採整行刪除，接受此設計
autoRevealInterval : number  // 自動輪播間隔秒數（動畫常數後的額外等待）；建立房間時初始值 3；範圍 1~30；再玩一局時重置為 3
createdAt     : timestamp
```

**In-memory 欄位（非持久化 DB 欄位，Server 進程重啟後遺失）**：

```
lastRevealBroadcastAt : timestamp | null
  // Server 最近一次送出 revealIndex +1 廣播的時間點（Server 端送出時刻）
  // 初始值 null；每次 revealIndex +1 廣播時更新；Server 重啟後遺失（= null）
  // 用途：§7.5 決策表「revealIndex > 0 中段啟動自動輪播」計算剩餘等待時間；§8.3 remainingSeconds 公式
  // 再玩一局時重置為 null（新局 revealIndex 從 0 開始，無上次廣播時間戳）
  // **隱含假設**：此時間戳為 Server 端送出時刻，非客戶端收到時刻；§7.5 決策表與 §8.3 remainingSeconds 公式均以 Server 時間計算，
  //   隱含假設「Server 送出到客戶端收到的網路延遲遠小於 ANIMATION_DURATION_SECONDS」——若延遲接近 ANIMATION_DURATION_SECONDS，
  //   Server 計算的剩餘等待時間可能過短，客戶端動畫尚未開始播放時 Server 已啟動下一輪倒數；
  //   MVP 接受此限制（正常網路環境下延遲通常 < 100ms，遠小於動畫常數 TBD 秒）

autoRevealStartedAt : timestamp | null
  // Server 最近一次處理 autoReveal enable 請求的時間點（計時器啟動時刻）
  // 初始值 null；每次處理 enable 請求時（含重新啟動）更新；Server 重啟後遺失（= null）
  // 用途：§8.3 remainingSeconds 公式（revealIndex = 0 分支：remainingSeconds = autoRevealInterval − elapsed）
  // 再玩一局時重置為 null（autoReveal 重置為 false，計時器不存在）
  // 注意：revealIndex 從 0 變為 1 後，後續計算改用 lastRevealBroadcastAt，此欄位不再參與計算
```

工程師實作 Server Room 物件時需包含上述兩個 in-memory 欄位。兩者均不寫入 DB，不傳送至客戶端，亦不出現在 §7.6「再玩一局 reset 欄位清單」（DB 欄位清單）——但應在再玩一局的 Server 端重置邏輯中一併清除。

**廣播動態欄位（非 DB 欄位、非 in-memory 欄位，僅出現在特定事件 payload 中）**：

```
reason : "ROLLBACK_TIMEOUT" | "ROLLBACK_ERROR"
  // 僅在 `running→waiting` rollback 廣播的 ROOM_STATE payload 中動態添加
  // 不寫入 DB，不需要在 Room 物件中定義；Server 在構建 rollback 廣播時即時填入
  // 其他 ROOM_STATE 廣播（如 isOnline 更新、waiting→running）不含此欄位
  // 客戶端依此字串決定顯示「生成超時，請稍後再試」或「生成失敗，請稍後再試」
  // 字串值定義：§7.1 rollback 規則中明確指定 "ROLLBACK_TIMEOUT" 與 "ROLLBACK_ERROR"
```

### Player

```
playerId      : string              // Server 生成 UUID，存入客戶端 localStorage
name          : string              // 暱稱（同局唯一）
joinedAt      : timestamp           // Host 的 joinedAt 設為建立房間的 Server 時間戳（保證為 players 中最早值，Lobby 中排列首位）；一般玩家設為加入時的 Server 時間戳；再玩一局時所有留存玩家（含 Host）保留原值（不重置）；再玩一局後新加入的玩家設為加入時的 Server 時間戳。**格式與精度**：Unix epoch millisecond timestamp（64-bit 整數，單位毫秒）；不帶時區（epoch 本質無時區）；排序比較以整數值大小為準；精度選用毫秒，同時保持跨語言一致性；**毫秒碰撞屬預期情況**（多玩家同一毫秒加入時可能發生）——PDD 已為此設計次要排序鍵（playerId 字典序升冪）確保排序確定性（見 §7.2），不需要更高精度來「避免」碰撞，碰撞會被確定性地解決
isOnline      : boolean             // 連線狀態（連線維度）；玩家加入時初始值 true（加入即視為連線中）；**MVP：WebSocket `close` / `disconnect` 事件觸發時 Server 立即設為 false 並廣播 `ROOM_STATE`**（不設 grace period；重連建立後立即設回 true 並廣播）；v2 可改為 heartbeat 超時機制；**再玩一局時：留存玩家（通過 §7.6 pruning 的玩家）的 isOnline 保留現值，不重置**——pruning 本身已移除所有 isOnline=false 的非 Host 玩家（見 §7.6），因此留存玩家中只有 Host 可能以 isOnline=false 進入新局（Host 例外）；Host isOnline=false 進入新局時，`finished→waiting` 廣播的 players 陣列中 Host 的 isOnline 即為 false，其他客戶端的 Lobby 將以灰色標示 Host 離線，此為預期行為（Host 重連後 Server 設回 true 並廣播）
startColumn   : number | null       // 玩家加入時初始值 null；開始遊戲時由 Server 原子寫入賦值；再玩一局重置為 null 直到新局開始
endColumn     : number | null       // 玩家加入時初始值 null；開始遊戲後由 Server 原子寫入填入；再玩一局重置為 null
result        : "win" | "lose" | null  // 玩家加入時初始值 null；開始遊戲後由 Server 原子寫入填入（冗餘儲存欄位）；再玩一局重置為 null
```

**說明**：`isOnline` 與 `result` 為獨立維度，斷線玩家（isOnline = false）的 result 在遊戲開始後照常計算與揭曉，不因斷線而跳過。

### LadderSegment

```
row           : number  // 第幾行（從 0 開始；合法範圍 [0, Room.rowCount-1]；此約束在 ladderMap 非空（rowCount > 0）時有效；rowCount = 0 時 ladderMap 必為 []，row 合法範圍約束不適用）
// 資料不變性：rowCount = 0 ↔ ladderMap = [] ↔ resultSlots = []；三者必須同時為空或同時有值，rollback 與再玩一局均維持此不變性
from          : number  // 欄位索引，合法範圍 [0, N-2]（N 為玩家人數；from = N-1 不合法，因 to = from+1 = N 越界）；保證 from < to
to            : number  // = from + 1（僅連接相鄰欄位）；合法範圍 [1, N-1]
```

**唯一性約束**：同一 row 中 (from, to) 組合不重複，且各橫槓的欄位範圍不重疊（即同 row 中不存在兩條橫槓共用相同的欄位索引）；此約束由生成演算法保證，驗算時亦可作為合法性檢查條件。

**說明**：橫槓為雙向（bidirectional）。行走演算法遇到此 segment 時，無論玩家當前在 `from` 欄或 `to` 欄，均移動至對面欄。

### ResultSlot


```
column        : number           // 欄位索引
type          : "win" | "lose"   // 中獎或未中獎
```

**result 判定規則**：Player.result 由 Player.endColumn 查找 resultSlots 決定——若 resultSlots 中 column == endColumn 的那筆 type 為 "win"，則 result = "win"，否則 result = "lose"。result 不獨立計算，endColumn 是唯一來源。

**再玩一局 reset 欄位清單**（參照 §7.6）：

| 欄位 | 再玩一局後的值 |
|------|--------------|
| status | `waiting` |
| ladderMap | `[]` |
| resultSlots | `[]` |
| revealIndex | `0` |
| seed | `""` |
| winnerCount | 保留上局值（因 §6.2 驗證，此時 winnerCount 必為整數，不可能為 null；若越界則標記為無效，見 §7.6） |
| players | 移除 isOnline=false 者（Host 除外）；其餘玩家的 startColumn、endColumn、result 清空為 null；joinedAt 保留原值（不重置） |
| Player.isOnline（留存玩家） | 保留現值（一般玩家均為 true，因 pruning 已移除 isOnline=false 者；**Host 例外**：Host 即使 isOnline=false 亦不移除，但 §7.6 前置驗證③要求 Host isOnline=true，因此實際上 Host 亦為 true——Host 例外規則屬防禦性設計，覆蓋未來 isOnline 檢查寬鬆化的情況）；pruning 原子操作以快照時的 isOnline 值為準（若 pruning 執行期間有玩家恰好斷線，以原子寫入時的快照值決定是否保留，不補寫）；**此快照規則不適用於 Host**——Host 例外規則優先（Host 無論快照 isOnline 為何值均不移除）；工程師應先套用 Host 例外，再套用快照值規則篩選一般玩家，避免「快照值」邏輯誤覆蓋 Host 的保留語意 |
| rowCount | `0`（新局開始時重新計算） |
| kickedPlayerIds | `[]`（踢除禁令解除） |
| autoReveal | `false` |
| autoRevealInterval | `3` |
| lastRevealBroadcastAt（in-memory） | `null`（新局 revealIndex 從 0 開始，無上次廣播時間戳） |
| autoRevealStartedAt（in-memory） | `null`（autoReveal 重置為 false，計時器不存在） |
| hostId | 保留（不重置） |
| title | 保留（不重置） |
| roomCode | 保留（不重置） |
| createdAt | 保留（不重置）——代表整個 Room 的建立時間，而非本局的開始時間；TTL 計算基準為此欄位（房間存活時間從建立時起算，不因「再玩一局」重置；TTL 策略待 §16 開放問題確認）；**注意：TTL 設計採建立時間基準（非活動時間基準）——工程師不應採用「最近活動時間（updatedAt/lastActivityAt）更新 TTL」策略，此設計已明確採 `createdAt` 為固定計算基準；具體 TTL 時長（如 24 小時）待 §16 確認，但不論時長為何，計算公式均為 `createdAt + TTL_DURATION`，而非以最後操作時間滾動延長** |

---

## 10. 狀態機設計

### 房間狀態轉換

```
waiting ──[Host 按開始，Server 驗證通過]──→ running ──[Server 寫入完成]──→ revealing ──[revealIndex=N 或一鍵全揭]──→ finished
   ↑                                               │                                                                      │
   │                                     [生成失敗或逾時 10 秒]                                                   [Host 按「再玩一局」]
   │                                               ↓                                                                      │
   └───────────────────────────────────────── waiting ◀─────────────────────────────────────────────────────────────────┘
```

各狀態下 Host 允許操作：

| 狀態 | Host 可執行操作 |
|------|-----------------|
| `waiting` | 修改中獎名額、踢除玩家、開始遊戲 |
| `running` | 無操作（此欄指 **Host 主動觸發的操作**均禁用——所有 Host 控制按鈕禁用或隱藏；UI 顯示「遊戲開始中，請稍候…」過渡畫面；Server 仍正常處理非操作請求（如 winnerCount 更新請求到達時靜默回傳 `WINNER_COUNT_UPDATE_NOT_ALLOWED_IN_STATE`），以及系統自動觸發的 `running→waiting` rollback（若原子寫入逾時 10 秒或拋出異常）——rollback 為 Server 自動行為，非 Host 主動操作） |
| `revealing` | 下一位、自動輪播、一鍵全揭、調整自動輪播間隔（autoRevealInterval） |
| `finished` | 再玩一局（揭曉控制按鈕隱藏，不顯示於 UI） |

### 玩家狀態（兩個獨立維度）

**連線維度**：
```
online ⇄ offline（斷線後重連可切換）
```

**遊戲進度維度**：
```
waiting（等待揭曉）→ revealed（已揭曉）
```

---

## 11. 公平性設計

### 11.1 隨機種子與結果生成

- Host 點擊「開始遊戲」後，**由 Server 端** 生成隨機種子（seed）
- Server 使用 seed 計算 ladderMap、resultSlots 及每位玩家的 endColumn，原子寫入 DB
- seed 本身存入 Room 記錄，供事後驗算（選配：在結算頁公開 seed 供玩家驗算公平性；注意：公開 seed 同時揭露 ① startColumn 分配、② 完整樓梯結構、③ 中獎欄位，三者同時可重現，屬預期行為）
- 客戶端無法影響 seed 生成，Host 重新整理頁面不會觸發重新生成
- **seed 安全性**：seed 在 `finished` 前不得傳送至任何客戶端；seed 提前洩漏可讓知情者在開局前推算 startColumn 分配與 resultSlots 中獎位置，破壞抽獎公平性；seed 熵值至少需達 128 位元（由密碼學安全亂數源生成），避免暴力猜測攻擊；**熵值要求的適用層次**：128 位元 CSPRNG 要求僅適用於 seed 的**生成階段**（確保 seed 不可預測）；以 seed 初始化後用於確定性重現（計算 ladderMap、resultSlots 等）的 PRNG 演算法不要求 CSPRNG 等級，使用高品質確定性演算法（如 xoshiro256\*\*、Mulberry32）即可，重點是「相同 seed → 相同結果」的確定性，而非輸出不可預測性
- **PRNG 消耗順序**（使用同一份 seed 之確定性演算法，順序固定）：① startColumn 洗牌（將 [0..N-1] 隨機排列後依序指派；**洗牌演算法（如 Fisher-Yates）及每步 PRNG 消耗數量待 PRD 技術規格指定**，見 §16 開放問題；實作時必須保證洗牌演算法確定性——相同 seed 跨語言跨環境產生相同排列，此為 startColumn 指派可重現的前提）→ ② ladderMap 橫槓生成（逐 row、每 row 逐條橫槓消耗亂數）→ ③ resultSlots W 個中獎欄位選取；此順序保證以相同 seed 重現時三個步驟結果完全一致；具體 PRNG 演算法名稱、初始化方式及步驟間狀態傳遞方式待 PRD 技術規格中指定（見 §16 開放問題）

  > ⚠️ **PRNG 演算法阻塞警告（核心功能 + 驗算）**：步驟 ① 洗牌演算法（名稱、每步 PRNG 消耗數量）為 §16 開放問題，尚未確定。此問題**不僅影響驗算功能，也是核心遊戲邏輯的阻塞問題**：由於 ② ladderMap 生成與 ③ resultSlots 選取的 PRNG 序列起始位置均依賴 ① 洗牌消耗的 PRNG 次數，三個步驟共享同一 PRNG 序列——演算法一旦選定後若更改，相同 seed 將產生不同的 startColumn、ladderMap 及 resultSlots，歷史局次的結果重現能力受影響。工程師可先實作 Room 管理、Lobby、狀態機等不依賴 PRNG 的功能，但**應避免將任何遊戲結果（startColumn / ladderMap / resultSlots）寫入生產資料庫**，直到 §16 開放問題中的洗牌演算法、PRNG 演算法名稱及初始化方式完全確定為止，以避免存量資料在演算法調整後無法正確重現。

### 11.2 防作弊需求

- 遊戲開始後不可新增玩家（Server 端驗證 Room status）
- Host 在 `running` 狀態後不可更改中獎名額
- ladderMap 與 resultSlots 一旦寫入不可修改
- 玩家重連後只能讀取既有結果，不觸發重算
- 只有 Host 的 playerId 可觸發下列核心操作（Server 端驗證，比對請求的 playerId == Room.hostId）：「開始遊戲」、「揭曉控制（下一位 / 自動輪播 / 一鍵全揭 / autoRevealInterval 調整）」、**「再玩一局」**（再玩一局觸發 kickedPlayerIds 清空、玩家名單修剪等高影響力操作，必須驗證 hostId）、「踢除玩家」、「修改 title 與 winnerCount」；非 Host 送出上述請求一律回傳授權錯誤並忽略
- playerId 由 Server 分配，客戶端無法偽造
- **Host localStorage 清除後的已知 MVP 限制**：若 Host 清除 localStorage，其原 playerId 以 ghost player（isOnline=false）身分保留在 players 陣列中，且仍為 Room.hostId；新訪問的 Host 無法通過 hostId 驗證，房間實際上進入無法操作的凍結狀態（等同 Host 離線後的 MVP 行為，見 §7.1 房間規則）；此屬 MVP 已知限制，無自動恢復機制

---

## 12. 非功能需求

| 類型 | 需求 |
|------|------|
| 效能 | 設計上限 50 人同房；樓梯生成（從 Server 收到請求到 DB 原子寫入完成）< 1 秒（目標值）；超過 1 秒時客戶端繼續顯示「遊戲開始中，請稍候…」過渡畫面直到收到 `revealing` 廣播；超過 10 秒則 Server 回退至 `waiting`（客戶端 15 秒計時器為最終安全網，詳見 §8.3）；揭曉動畫：桌機 ≥ 30fps（Chrome 最新版），手機 ≥ 24fps（近 4 年內 mid-range Android Snapdragon 720G 等級及 iPhone 11 以上），詳見 §3.3 成功指標 |
| 同步延遲 | 房間狀態同步體感 < 2 秒 |
| 相容性 | Chrome / Firefox / Safari / Edge（現代版本）；手機 + 桌機均可使用 |
| 可用性 | 玩家 10 秒內可加入房間；Host 1 分鐘內可建立並開局 |
| 重連 | 玩家重整後帶 playerId 重連，可回到對應房間狀態的正確畫面 |
| 安全性 | playerId 由 Server 分配；Server 端驗證所有狀態轉換的合法性；所有傳輸均採用 HTTPS/WSS |

---

## 13. MVP 定義

### 必做（v1）

- 建立房間（含 Room Code 生成）
- 玩家輸入暱稱加入房間（取得 playerId，存入 localStorage）
- 等待室（顯示玩家名單、Host 控制區、人數不足提示）
- Host 設定中獎名額（帶邊界驗證）
- Host 開始遊戲（觸發 Server 端生成樓梯與獎位）
- 樓梯與獎位由 Server 端一次性生成（含隨機種子記錄）
- Host 端聚焦揭曉模式（依 startColumn 順序，由左至右）
- 玩家端個人視角揭曉畫面
- 結算頁（Host 端完整名單 + 玩家端個人結果）
- 重整後帶 playerId 重連，回到對應房間狀態畫面
- 再玩一局（同 Room Code，重置狀態與資料）

### 不做（v1 範圍外）

| 功能 | 原因 |
|------|------|
| 正式帳號系統 | 增加加入門檻，MVP 用 playerId + 暱稱即可 |
| 頭像（Avatar） | 資料存儲方式未定，列入 v2 |
| QR Code 掃描加入 | 便利功能，核心流程不依賴 |
| 語音 / 聊天 | 超出核心玩法範疇 |
| 複雜道具系統 | 增加複雜度，主玩法未驗證前不做 |
| 多輪淘汰制 | 進階玩法，MVP 先主打單輪抽獎 |
| 多房間列表 / 大廳 | MVP 不需要瀏覽其他房間 |
| 多局歷史記錄 | 再玩一局重置即可，歷史記錄列入 v2 |
| 移交 Host 權限 | Host 離線時 MVP 先凍結房間 |

---

## 14. 事件與錯誤碼目錄

Server → Client 推送事件（WebSocket 廣播，除特別標注外推送至房間全員）：

**「全員廣播」定義**：與該 roomId 關聯的所有 WebSocket session，**包含匿名 session**（`ROOM_FINISHED` 訪客建立的監聽連線，不在 players 陣列中）；Server 廣播時以 roomId 為鍵，推送至所有關聯 session，不以 players 陣列成員為限；若工程師以 players 陣列決定推送目標，匿名 session 將收不到 `waiting` 廣播，導致 `ROOM_FINISHED` 流程中等待中的訪客永久卡住。

**匿名 session 升級協定**：在 `finished` 狀態以無 playerId 身分到達的訪客，Server 回傳 `ROOM_FINISHED` 錯誤並在**同一條 WebSocket 連線**上建立匿名監聽 session（不需重新建立連線）。後續流程如下：
1. 客戶端以現有連線靜默等待 `waiting` 廣播（Host 點擊「再玩一局」後送出）；**等待期間收到任何非 status=`waiting` 的廣播（如 `REVEAL_INDEX`、`REVEAL_ALL`、`ROOM_STATE`（status≠waiting）、`ROOM_STATE_FULL` 等）均靜默忽略**，維持等待畫面；若 WebSocket 斷線，重連後依當時房間狀態判斷：狀態為 `waiting` 則直接進入加入頁（無需重建匿名 session），狀態仍為 `finished` 則重頭建立匿名 session
2. 客戶端收到 `waiting` 廣播後顯示加入頁面，玩家填寫暱稱後提交加入請求（透過**同一條 WebSocket 連線**以 WebSocket message 送出，而非新 HTTP request）
3. Server 收到加入請求後執行驗證：**成功路徑**：生成 playerId 並回傳給客戶端；客戶端將 playerId 存入 localStorage，該 WebSocket session 升格為正式玩家 session（Server 將此 session 與 playerId 關聯）。**失敗路徑（以下情境下匿名 session 繼續保留，等待使用者重試或等待下一輪）**：① 暱稱重複（`NAME_TAKEN`）——客戶端顯示錯誤提示，保留加入頁允許使用者修改暱稱後重試；② 人數已達上限（`ROOM_FULL`）——客戶端顯示「房間已滿，無法加入」，匿名 session 仍在線等待；③ 房間狀態在提交加入請求前已轉為 `running`/`revealing`（`ROOM_NOT_JOINABLE`）——客戶端顯示「遊戲已開始，請等待下一局」，匿名 session 繼續等待下一個 status=`waiting` 廣播（此情境實為 Host 在 `waiting` 廣播後立刻按開始，竟態窗口極短）；④ 名稱格式非法（`INVALID_NAME`）——客戶端顯示格式錯誤提示，保留加入頁。所有失敗路徑均**不關閉匿名 session**，讓使用者可在同一條連線上修正後重試。**加入請求 in-flight 期間收到 `running` 廣播（竟態）**：客戶端在步驟 2 送出加入請求後、收到 Server 回應前，若收到 `running` 廣播（Host 幾乎同時按下開始遊戲），客戶端應**繼續等待加入請求的 Server 回應，不因廣播而取消或丟棄請求**；若 Server 回應為 `ROOM_NOT_JOINABLE`（FIFO 保證：start-game 先被處理），按失敗路徑 ③ 處理；若回應為成功（FIFO 保證：加入先被處理，玩家正式進入房間），客戶端升格為正式 session，並依 `running` 狀態快照正常進入過渡等待畫面；**此 FIFO 保證針對 Server 端同一 roomId 的請求處理序列，Host 與訪客來自不同 WebSocket session——正確實作須依賴 DB 層事務序列化（如 optimistic lock 或 serializable transaction）而非 WebSocket 訊息佇列，詳見 PRD 技術規格**（行為同一般 `running` 狀態重連，見 §8.3）
4. **匿名 session 斷線重連**：若客戶端在升格前（步驟 3 完成前）斷線，由於 localStorage 中無 playerId，重連後以無 playerId 身分建立新的匿名 session；若此時 Room 仍為 `finished` 狀態，流程重頭開始；若已收到 `waiting` 廣播後才斷線，重連後帶空 playerId 訪問 `waiting` 狀態，視同新訪客，可直接填寫暱稱加入
5. **匿名 session 上限**：匿名 session 數量上限為獨立配置（預設無硬性上限，實作細節待 PRD 確認）；此上限與 players 陣列成員上限（50 人，見 §3.2 體驗目標）相互獨立，匿名訪客不占用 players 槽位

| 事件名稱 | 推送範圍 | 觸發時機 | 主要 Payload |
|---------|---------|---------|-------------|
| `ROOM_STATE` | 全員廣播 | **非揭曉相關**的 Room 狀態欄位變更（**players 陣列新增成員**（新玩家成功加入，playerId 賦予並加入 players）、**players isOnline 狀態變更**（玩家連線或斷線）——加入與離線為不同操作路徑，均須觸發廣播；winnerCount 更新、title 更新、**autoReveal** 切換、autoRevealInterval 更新、**players 被踢除**（踢除操作原子性地執行：Server 同時送出 `PLAYER_KICKED` 至被踢 session + `ROOM_STATE`（更新後的完整 players 陣列）至**所有非被踢玩家的 session**（被踢玩家的 WebSocket 連線在 `PLAYER_KICKED` 送出後立即關閉，見 §7.1 被踢除玩家規則）；兩個訊息須在同一事務中發出，避免其他客戶端短暫仍看到被踢玩家；**訊息順序保證**：`PLAYER_KICKED` 先送出至被踢玩家，`ROOM_STATE` 隨後送出至剩餘 session——由於被踢玩家的 WebSocket 連線隨即關閉，其不會收到此 `ROOM_STATE` 廣播，不存在「被踢玩家先看到自己不在名單中、才收到 `PLAYER_KICKED`」的亂序問題）、`waiting → running` 狀態切換（**此廣播使用 `ROOM_STATE` 事件，非 `ROOM_STATE_FULL`**，payload 為包含 status = `running` 的全量或增量快照，格式與其他 `ROOM_STATE` 廣播相同；**即使採增量格式，`status` 欄位必須包含**，否則客戶端無法偵測狀態變更、無法啟動 15 秒計時器並切換至過渡等待畫面）、`running → waiting` 回退）；**通用規則**：所有導致 Room 非揭曉相關欄位變更的事件均應觸發此廣播；以上清單為主要觸發情境的具體列舉，工程師以通用規則為判斷依據；revealIndex 變更**不**透過此事件傳遞；`running → revealing` 原子寫入使用專屬 `ROOM_STATE_FULL` 事件（見下方）；**`revealing → finished` 轉換不觸發 `ROOM_STATE`**——`finished` 狀態訊號由 `REVEAL_INDEX`（k=N）或 `REVEAL_ALL` 廣播攜帶（見下方），工程師不應為 `revealing→finished` 轉換額外發出 `ROOM_STATE(status=finished)` 廣播；**`revealing` 狀態中發送的 `ROOM_STATE` 不攜帶 revealIndex**——客戶端以初次重連快照（含 revealIndex）為基底，後續 revealIndex 變更僅透過 `REVEAL_INDEX` 或 `REVEAL_ALL` 事件追蹤；工程師不應在 `ROOM_STATE` handler 中讀取 revealIndex；**`running → waiting` 回退廣播**（見 §7.1 rollback 規則）的 `ROOM_STATE` payload 額外攜帶 `reason` 欄位（`"ROLLBACK_TIMEOUT"` 或 `"ROLLBACK_ERROR"`），客戶端依此顯示對應錯誤提示訊息（**字串值以 §7.1 所寫定為準，工程師直接實作時使用此兩個值**） | **通用規則：所有 `ROOM_STATE` 廣播（不論觸發情境）均必須攜帶 `status` 欄位**——`status` 唯一標識當前房間狀態，客戶端的 `ROOM_STATE` handler 依此值決定行為（如切換畫面、啟動/取消計時器、更新本地狀態快取）；省略 `status` 會導致客戶端 handler 無法判斷當前狀態；此規則適用於所有觸發情境（isOnline 更新、autoReveal 切換、踢除、狀態轉換等），不限於 `waiting→running` 廣播；變更欄位（標量欄位採增量或全量快照，待 PRD 技術規格確認；**`players` 陣列每次 `ROOM_STATE` 廣播均攜帶完整陣列，不採增量 diff**——陣列型欄位增量更新的 merge 邏輯複雜且易出錯，PDD 選擇始終傳送全量 players，客戶端直接覆蓋本地 players 快取；若未來效能問題突出可在 PRD 技術規格中評估升級為 patch 格式；**`waiting→running` 廣播必須攜帶 `winnerCount`**（不論採增量或全量格式）——剛加入的客戶端可能僅收到一次 `ROOM_STATE`（加入時的廣播），尚未累積先前的 winnerCount 更新；若 `waiting→running` 廣播省略 winnerCount，這類客戶端在 `running` 過渡畫面中將無 winnerCount 快取，後續 `ROOM_STATE_FULL` 不含 winnerCount（設計如此，見 §14 `ROOM_STATE_FULL` 說明），導致揭曉畫面缺少 W 值。**`waiting→running` 廣播亦必須攜帶 `title`**（不論採增量或全量格式）——Host 在 `waiting` 期間可能更改 title，剛加入的客戶端可能僅有舊 title 快取；`waiting→running` 廣播是進入 `running` 狀態前最後一次可攜帶完整欄位的機會；`running` 後 title 禁止更改（§7.1），故此廣播是 title 同步的最後機會。**`waiting` 狀態中發送的 `ROOM_STATE`（如新玩家加入或 isOnline 狀態變更）players 陣列每位玩家欄位使用 `waiting` 狀態格式：playerId、name、joinedAt、isOnline**（startColumn/endColumn/result 均為 null，可省略）——此為所有 `waiting` 狀態廣播（含 `waiting→running` 廣播、`finished→waiting` 廣播、`running→waiting` rollback 廣播）的基底 players 格式；joinedAt 必須包含，確保客戶端依 §7.2 按加入時間排序 Lobby 玩家名單，剛加入的玩家可正確插入排序位置；**`waiting→running` 廣播的 players 陣列**：此廣播包含完整 players 陣列（同所有其他 `ROOM_STATE` 廣播），每位玩家欄位包含 playerId、name、joinedAt、isOnline，startColumn / endColumn / result 在此時均為 null）；**`running` 狀態中發送的 `ROOM_STATE`（如 isOnline 變更）players 陣列每位玩家欄位使用 `waiting` 狀態格式：playerId、name、joinedAt、isOnline**（startColumn/endColumn/result 均為 null，可省略）——`running` 狀態尚未完成 startColumn 等賦值，且 running 可回退至 waiting，保持 joinedAt 確保客戶端 Lobby 排序邏輯不中斷；**`running` 狀態 `ROOM_STATE` 廣播必須攜帶 `winnerCount`**（mid-running isOnline 更新亦然）——`running` 狀態中客戶端需顯示 winnerCount 以準備揭曉畫面；**`running` 狀態 `ROOM_STATE` 廣播亦應包含 `autoReveal`（= false）與 `autoRevealInterval`（= 3）**（值雖為常數，明確包含可確保未收到 `running` 重連快照的客戶端有完整基底狀態，與 §8.3 `running` 重連快照規格保持一致）；**`revealing` 狀態中發送的 `ROOM_STATE`（如 isOnline 變更）players 陣列每位玩家欄位必須包含 playerId、name、isOnline、startColumn、endColumn、result**——與 `ROOM_STATE_FULL` 的 players 格式一致；若僅送出 `waiting` 狀態格式（只含 playerId/name/isOnline），客戶端覆蓋本地快取後將遺失 startColumn/endColumn/result，揭曉邏輯崩潰；**`revealing` 狀態中發送的 `ROOM_STATE` 亦必須攜帶 `winnerCount`**（與 `running` 狀態 `ROOM_STATE` 廣播的要求一致）——`ROOM_STATE_FULL` 不含 winnerCount，若 `revealing` 狀態 isOnline 更新廣播省略 winnerCount，重連至 `revealing` 後僅收到此廣播的客戶端將無 winnerCount 快取，揭曉畫面 W 值顯示為空；**`revealing` 狀態中發送的 `ROOM_STATE` 亦應攜帶 `autoReveal` 與 `autoRevealInterval`（當前值）**（與 `running` 狀態 `ROOM_STATE` 廣播的要求對稱）——`revealing` 狀態中 autoReveal 可能為 true；若 isOnline 更新廣播省略這兩個欄位，重連至 `revealing` 後僅收到此廣播（未收到 `ROOM_STATE_FULL` 或 autoReveal 切換廣播）的客戶端將無 autoReveal 快取，自動輪播 UI 狀態顯示錯誤；**`hostId` 不論採增量或全量格式均必須包含**（見 §9 Room model `hostId` 欄位說明）；**`finished→waiting` 廣播（再玩一局）必須攜帶 `winnerCount`**（不論採增量或全量格式）——live 客戶端在結算頁僅有上局 winnerCount，重置後若 `winnerCount` 未隨廣播下發，Lobby 將顯示舊值或空值；**`finished→waiting` 廣播的 players 陣列每位玩家欄位使用 `waiting` 狀態格式：playerId、name、joinedAt、isOnline**（startColumn/endColumn/result 已重置為 null，可省略）；joinedAt 必須包含，供客戶端在 Lobby 依加入時間重排玩家名單（§7.2）；**`finished→waiting` 廣播必須明確攜帶 `autoReveal = false`**（不論採增量或全量格式）——`finished` 狀態下 DB 中的 autoReveal 值可能仍為 `true`（見 §9 Room 模型 autoReveal 欄位說明：`revealing→finished` 轉換不重置此欄位），再玩一局時 Server 雖在處理請求時重置為 `false`，但若廣播省略此欄位，live 客戶端無法得知 autoReveal 已被重置，等待室揭曉控制項將以錯誤初始狀態呈現；客戶端收到此廣播時須依新值更新本地 autoReveal 快取；**`finished→waiting` 廣播同樣必須明確攜帶 `autoRevealInterval`（值為重置後的 3）**（不論採增量或全量格式）——再玩一局時 autoRevealInterval 重置為 3（見 §9 資料模型），但 live 客戶端本地快取的 autoRevealInterval 可能仍為 Host 在上局設定的任意值（如 5 秒、10 秒）；若廣播省略此欄位，Lobby 若顯示任何自動輪播相關 UI 初始值將顯示舊值而非重置後的 3，形成資料模型與客戶端快取不一致；**`running→waiting` rollback 廣播必須攜帶 `winnerCount`**（不論採增量或全量格式）——rollback 後等待室 Lobby 需顯示 winnerCount，且此廣播是部分客戶端（如剛加入而 `waiting→running` 廣播因網路遺失未收到者）重建 winnerCount 快取的最後機會；與 `finished→waiting` 廣播強制攜帶 winnerCount 的規範保持一致；**`running→waiting` rollback 廣播亦應攜帶 `autoReveal`（必然為 false）**——`running` 期間 autoReveal 值必然為 false（不可在 `running` 狀態更改），但明確攜帶與 `finished→waiting` 廣播明確攜帶 `autoReveal = false` 的規範保持對稱，確保工程師實作 rollback 廣播時不遺漏此欄位；**`running→waiting` rollback 廣播亦必須攜帶 `title`**（不論採增量或全量格式）——部分客戶端可能因網路遺失未收到先前的 `waiting→running` 廣播（此廣播強制攜帶 `title`，見上方說明），rollback 廣播是這類客戶端取得 `title` 的唯一機會；與 `waiting→running` 廣播和 `finished→waiting` 廣播強制攜帶 `winnerCount` 的理由對稱——均解決「剛加入客戶端可能錯過先前廣播」的快取缺口；**`running→waiting` rollback 廣播的 players 陣列每位玩家欄位必須使用 `waiting` 狀態格式：playerId、name、joinedAt、isOnline**（startColumn/endColumn/result 均為 null，可省略）——與所有其他 `ROOM_STATE` 廣播對 `waiting` 狀態的 players 格式要求一致；§8.3 已指出「rollback `ROOM_STATE` 廣播必然攜帶含 joinedAt 的完整 players」，此條將該保證顯式寫入 §14 payload 規格，避免工程師組裝 rollback 廣播時沿用不含 `joinedAt` 的 `running` 快照格式；**（注意：以下 reason 欄位適用於 `running→waiting` 回退廣播，非此處的 `finished→waiting` 再玩一局廣播）`running→waiting` 回退廣播額外含 reason 欄位（字串值為 `"ROLLBACK_TIMEOUT"` 或 `"ROLLBACK_ERROR"`，見 §7.1）；`finished→waiting` 再玩一局廣播不含 reason 欄位**（再玩一局是正常操作，無需 reason）；**`finished` 狀態中發送的 `ROOM_STATE`（如 isOnline 變更）同樣觸發廣播**（**注意：此為 Room 仍在 `finished` 狀態時的變更廣播，status 欄位仍為 `finished`，非上方的 `finished→waiting` 廣播（status=`waiting`）；工程師需依 status 值選擇正確格式：status=`waiting` → waiting 格式；status=`finished` → finished 格式**），players 陣列每位玩家欄位使用 `finished` 狀態格式：playerId、name、isOnline、startColumn、endColumn、result——與重連快照格式一致（見 §8.3 `finished` 狀態快照）；若僅送出 waiting 格式將遺失結果資料，結算頁顯示空白；**`finished` 狀態中發送的 `ROOM_STATE` 廣播不應攜帶 `autoReveal`/`autoRevealInterval` 欄位**——`finished` 狀態下 DB 中 `autoReveal` 可能仍為 `true`（見 §9 Room 模型），傳送該值可能導致客戶端覆蓋本地快取並誤顯示自動輪播 UI 殘留狀態；若廣播架構上必須傳送全量欄位，客戶端的 `finished` 狀態 `ROOM_STATE` handler 必須明確略過 `autoReveal`/`autoRevealInterval` 欄位的快取更新（與 §8.3 `finished` 快照忽略指示保持一致） |
| `REVEAL_INDEX` | 全員廣播 | revealIndex +1（逐步揭曉）；不與 `ROOM_STATE` 重疊；不與 `ROOM_STATE_FULL` 重疊（`ROOM_STATE_FULL` 僅於 `running→revealing` 轉換時發出一次，`REVEAL_INDEX` 僅於 `revealing` 狀態發出，兩者互斥）；**當 k = N 時，payload 同時攜帶 status = `finished`**（與 §7.1 原子寫入一致）；**k = N 時 revealIndex 與 status = `finished` 必須在同一 WebSocket message frame 中攜帶，不可拆分為兩則訊息，確保客戶端不存在「revealIndex = N 但 status 仍為 revealing」的空窗期；若客戶端因網路異常僅收到 revealIndex = N 而未收到 status = `finished`，應在重連後依快照判斷最終狀態** | revealIndex（新值 k），無 revealAll 旗標；k = N 時加上 status = `finished`；**live 客戶端收到 status = `finished`（不論 k=N 逐步廣播或 `REVEAL_ALL` 廣播）後，應立即清除本地 autoReveal 倒數 UI 狀態**（不論本地快取的 autoReveal 值）——`revealing→finished` 轉換不觸發 `ROOM_STATE` 廣播（§14 ROOM_STATE 觸發條件未列此轉換），status = `finished` 廣播本身即為倒數 UI 終止訊號，客戶端不應等待後續 `ROOM_STATE` 更新本地 autoReveal 快取；**k = N 廣播同樣不攜帶 `hostId`**——與 `REVEAL_ALL` 一致（見 §14 `REVEAL_ALL` payload 說明），客戶端使用先前已快取的 `hostId` 值；工程師不應期待 `REVEAL_INDEX`（k = N）攜帶 `hostId` |
| `REVEAL_ALL` | 全員廣播 | 一鍵全揭；不與 `ROOM_STATE` 重疊 | revealIndex = N，`revealAll: true`，status = `finished`；**不重複攜帶 `hostId`**——客戶端使用先前 `ROOM_STATE_FULL` 或重連快照中已快取的 `hostId` 值，不在 `REVEAL_ALL` 廣播中重複下發；工程師不應期待此事件攜帶 `hostId` |
| `ROOM_STATE_FULL` | 全員廣播 | **`running → revealing` 原子寫入完成**時（§6.2 步驟 7）；payload 涵蓋本次原子寫入的完整資料，確保客戶端一次性收到所有欄位；**此為 live broadcast，非重連快照**：重連至 `revealing` 狀態的客戶端需由 Server 另外生成完整快照（包含 `ROOM_STATE_FULL` 所有欄位 + `winnerCount` + `players` 完整陣列 + `title` 等其他 Room 欄位），不可以 `ROOM_STATE_FULL` 的欄位列表作為重連快照的完整定義 | status = `revealing`，**hostId**，ladderMap，resultSlots，rowCount，revealIndex（= 0；**客戶端收到此事件時應以此值初始化本地 `lastReceivedRevealIndex`**，見 §7.1「`lastReceivedRevealIndex` 的定義與初始化」），autoReveal，autoRevealInterval，**完整 players 陣列**（含每位玩家的 playerId、name、joinedAt、isOnline、startColumn、endColumn、result；客戶端需以 isOnline 標示斷線玩家；name 欄位必須包含，否則揭曉畫面顯示空白名稱）；**不含 seed**（seed 在 `finished` 前禁止傳送給客戶端，見 §6.2 步驟 7 與 §11.1）；**不含 winnerCount**（live 客戶端已從 waiting 狀態同步，最遲從 `waiting→running` 廣播中取得（見 §14 `ROOM_STATE` payload 說明：`waiting→running` 廣播強制攜帶 winnerCount）；重連快照需另行補充——`revealing` 狀態重連快照必須額外包含 winnerCount 及其他 ROOM_STATE_FULL 未含欄位，見 §8.3 `revealing` 狀態快照欄位說明）；**Server 實作時應完全省略 winnerCount 欄位，不傳 `winnerCount: null`**——若傳 null 且客戶端 handler 採物件展開合併，將靜默覆蓋本地快取為 null；完全省略可確保任何合併策略均安全；**不含 `title`**——客戶端應保留先前快取的 `title` 值，**不應因收到此事件而清除本地 `title` 快取**（live 客戶端必然已從先前廣播取得 `title` 快取：`waiting→running` 廣播強制攜帶 `title`（見 §14 `ROOM_STATE` payload 說明），前提與 `winnerCount` 省略對稱；live 客戶端在收到 `ROOM_STATE_FULL` 前必然已有完整 `title` 快取）；**⚠️ 此省略規則僅適用於 live 路徑——重連至 `revealing` 狀態的重連快照須由 Server 另外補充 `title`（見 §8.3），勿以此 payload 欄位列表作為重連快照完整定義**；工程師在實作 `ROOM_STATE_FULL` handler 時，若 handler 覆寫所有欄位，需注意略過未列於此 payload 的欄位（`title`、`winnerCount`），保持本地已有快取值不變；**相反地，players 陣列欄位（含 `joinedAt`）應以此廣播的完整陣列覆寫本地快取**——`running` 重連快照可能省略 `joinedAt`（見 §8.3），`ROOM_STATE_FULL` 是 **live 路徑**補全此欄位的可靠保證（`running` 狀態 `ROOM_STATE` isOnline 更新廣播亦攜帶 `joinedAt`，可提前補全，但廣播可能未到達；`ROOM_STATE_FULL` 為 live 路徑必然到達的保證來源）；**注意：此「必然到達」僅適用於 live 路徑（始終在線的客戶端在 `running→revealing` 轉換時必然收到此廣播）；重連至 `revealing` 狀態的客戶端不會再收到 `ROOM_STATE_FULL`（此廣播僅在 `running→revealing` 轉換時發出一次），重連客戶端的 `joinedAt` 完全依賴重連快照（§8.3 明確要求 `revealing` 快照必須包含 `joinedAt`，不可省略）**；handler 不應僅寫入新增的 startColumn/endColumn/result 欄位而略過已有的 `joinedAt`；**autoReveal 在此 live broadcast 中必定為 false**（autoReveal 僅可在 `revealing` 狀態切換，`running` 狀態中不可更改；再玩一局時重置為 false；故 `running → revealing` 原子寫入廣播時 autoReveal 恆為 false，客戶端收到此事件時不應呈現自動輪播 UI）；**Server 應明確傳送 `autoReveal: false`（不省略欄位）**——此值用於重置客戶端本地快取，確保客戶端不沿用先前可能殘留的 autoReveal 狀態；與 winnerCount 省略策略不同（winnerCount 省略是因 null 值會破壞非空快取），autoReveal 傳送明確的 false（非 null），主動覆蓋本地快取是設計預期；**同理，`autoRevealInterval` 亦應明確傳送（不省略欄位）**——`running→revealing` 轉換時 autoRevealInterval 的當前值應一併下發，確保客戶端的 autoRevealInterval 快取被重置為 DB 中的值（payload 結構細節待 PRD 技術規格確認） |
| `PLAYER_KICKED` | **僅被踢玩家** | Host 踢除玩家時 | playerId |
| `SESSION_REPLACED` | **僅舊 session** | 同 playerId 的新連線建立時 | playerId；**客戶端收到此事件後應立即停止所有房間互動，顯示提示「此頁面的 session 已在其他分頁中開啟，即將自動導回首頁…」，並在 3 秒後**自動導回首頁**（選擇首頁而非靜態提示頁，因首頁讓使用者可立即採取下一個動作）；**提示文字不應說「請刷新頁面」**——刷新會重新搶奪 session，與「客戶端不應嘗試重新連線」的設計意圖相悖；客戶端不應嘗試重新連線（新 session 已接管），避免兩個分頁互相搶奪 session |

Server 回應錯誤碼（HTTP 或 WebSocket response）：

| 錯誤碼 | 觸發條件 | 客戶端行為 |
|--------|---------|-----------|
| `ROOM_CODE_GENERATION_FAILED`（HTTP 500） | 建立房間時 Room Code 碰撞重試超過 10 次仍失敗（見 §7.1）| 顯示「系統繁忙，請稍後再試」；保留在建立房間頁面（不清除已填入的暱稱）；使用者可手動重試 |
| `NAME_TAKEN` | 玩家加入時暱稱與現有 players 陣列中（含 isOnline=false 的斷線玩家，但**不含** kickedPlayerIds 中已被踢除的玩家——被踢除玩家暱稱已釋放）的暱稱重複 | 顯示「此暱稱已被使用，請換一個」；保留在加入頁面，不清除已輸入的暱稱；使用者可修改後重試 |
| `INVALID_NAME` | 暱稱或房間名稱格式不符規範（見 §7.1：1~20 碼（暱稱）/ 0~50 碼（title）、禁止換行符及 null 字元；playerId 建立時的暱稱；再玩一局前已通過驗證，此錯誤僅在初次加入與建立房間時觸發）；**payload 必須包含 `field` 欄位**（`"name"` 或 `"title"`）以區分違規來源——`"name"` 表示暱稱違規（停留加入頁），`"title"` 表示房間名稱違規（停留建立房間頁）；若缺少 `field`，客戶端無法判斷應保留哪個輸入框的焦點 | 依 `field` 決定行為：`field="name"` → 顯示「暱稱格式不符，請重新輸入」，保留在加入頁面，不清除暱稱輸入框；`field="title"` → 顯示「房間名稱格式不符，請重新輸入」，保留在建立房間頁面，不清除 title 輸入框 |
| `INVALID_TITLE_UPDATE` | `waiting` 狀態下 Host 送出 title 修改請求但格式不符規範（超過 50 碼、含換行符或 null 字元）；與 `TITLE_UPDATE_NOT_ALLOWED_IN_STATE` 語意不同（後者為狀態限制，此為格式限制） | 顯示「房間名稱格式不符」或等效提示；保留在輸入框，不清除已輸入的 title；**此為 Server 端防禦性規則**——客戶端輸入控制項應已限制合法格式（字數限制、禁止換行符），正常流程下不觸發此錯誤 |
| `ROOM_FULL` | **`waiting` 狀態**下加入時 players.length 已達 50（設計上限）；**此錯誤僅在 `waiting` 狀態觸發**——其他狀態（`running`/`revealing`）回傳 `ROOM_NOT_JOINABLE`，`finished` 回傳 `ROOM_FINISHED`，故無 playerId 的加入請求不可能在非 `waiting` 狀態觸發 `ROOM_FULL`；匿名 session 升格請求（§14 升級協定步驟 3）在收到 `waiting` 廣播後送出，到達 Server 時 Room 必然為 `waiting` 狀態（或已再次轉為 `running`，此時回傳 `ROOM_NOT_JOINABLE`），故 §7.1「僅 `waiting` 狀態觸發」限制與 §14 升級協定流程完全相容 | 顯示「房間已滿（50 人上限），無法加入」，停留加入頁；**若當前為匿名 session（`ROOM_FINISHED` 升級協定流程），客戶端繼續以匿名 session 在線等待並監聽下一個 `status=waiting` 廣播**（同 §14 升級協定步驟 3 失敗路徑 ②），下一局 `waiting` 廣播到達時恢復加入頁，讓使用者嘗試加入新局；一般訪客（非匿名 session）則停留在靜態加入頁 |
| `ROOM_NOT_JOINABLE` | 無 playerId 加入時 Room 狀態為 `running`/`revealing` | 顯示「**此房間**遊戲已開始，無法加入」，停留加入頁；**若當前為匿名 session（`ROOM_FINISHED` 升級協定流程中的競態窗口），客戶端繼續以匿名 session 監聽下一個 `status=waiting` 廣播**（同 §14 升級協定步驟 3 失敗路徑 ③），收到 `waiting` 廣播後恢復加入頁可操作狀態；一般訪客（非匿名 session）則停留在靜態加入頁無需監聽；**此為已知 UX 限制**：一般訪客（無 playerId）在 `running`/`revealing` 狀態無自動恢復路徑，須手動重新整理頁面——當遊戲進入 `finished` 再到下一個 `waiting` 時，此訪客不會自動感知狀態變更；客戶端可選擇性顯示「遊戲進行中，請稍後重新整理頁面」提示，但不強制要求建立 WebSocket 監聽（相比之下，抵達 `finished` 的訪客透過 `ROOM_FINISHED` 錯誤獲得匿名 session 自動恢復，兩者不對稱屬設計決定） |
| `ROOM_FINISHED` | 無 playerId 加入時 Room 狀態為 `finished` | 顯示「遊戲已結束，請等待下一局」；客戶端以訪客身分建立 WebSocket 連線監聽房間廣播（無需 playerId；Server 以匿名 session 關聯至 roomId，不加入 players），收到 `waiting` 廣播後自動恢復加入頁面可操作狀態；訪客提交加入請求（取得 playerId）後，匿名 session 升級為正式 session（使用同一條 WebSocket 連線，見 §7.1「使用該 WebSocket 連線提交加入請求取得 playerId」）。**匿名 session 斷線後的重連**：若訪客在收到 `waiting` 廣播並恢復加入頁面之前斷線（匿名 session 清除），訪客重新整理頁面後直接以 `waiting` 狀態的正常 WebSocket 連線加入（Server 不回傳 `ROOM_FINISHED`），無需再次建立匿名 session，可直接填入暱稱加入新局；若訪客在收到 `waiting` 後、提交加入請求之前斷線，重連後同上（直接連接 `waiting` 房間）。**匿名 session 生命周期**：客戶端斷線時立即清除；房間 TTL 到期時隨房間一併清除（見 §16 房間存活時間）；**匿名 session 數量上限為獨立配置**（預設無硬性上限，實作細節待 PRD 確認）；此上限與 players 陣列成員上限（50 人，見 §3.2）相互獨立——匿名訪客不占用 players 槽位，兩者為不同資源（見 §14「匿名 session 升級協定」第 5 點） |
| `PLAYER_NOT_IN_ROOM` | playerId 存在但不在 players 且不在 kickedPlayerIds；**payload 必須包含 `status` 欄位**（目前房間狀態值）——客戶端依此欄位決定走哪條分支（`waiting` / `running`/`revealing` / `finished`），`PLAYER_NOT_IN_ROOM` 是重連時客戶端收到的第一則訊息，此時尚未收到任何狀態快照，若 payload 缺少 `status` 則無法判斷應顯示可操作加入頁或靜態等待頁 | 清除 localStorage，顯示加入頁（視同新訪客）；`finished` 時提示「你的記錄不存在（可能來自上一局），請等待主持人開啟新局後加入」；**`finished` 狀態下客戶端應以訪客身分建立匿名 WebSocket session 靜默等待 `waiting` 廣播**（**Server 在回傳 `PLAYER_NOT_IN_ROOM` 錯誤的同一瞬間自動在此 WebSocket 連線上建立匿名 session，無需客戶端重新連線，升級協定與 §14 `ROOM_FINISHED` 完全相同**；詳見 §14 `ROOM_FINISHED` 升級協定說明），收到 `waiting` 廣播後自動恢復加入頁可操作狀態（使用者可直接填入暱稱加入新局）；`waiting` 狀態下的 `PLAYER_NOT_IN_ROOM` 則直接顯示加入頁（房間可加入，使用者可直接填入暱稱加入）；**`waiting` 狀態下的連線保留**：此路徑不需要匿名 session 升級——`waiting` 狀態下房間可直接加入，客戶端清除 localStorage 後，在同一 WebSocket 連線上以無 playerId 身分提交加入請求（填寫暱稱後送出），Server 分配新 playerId 並加入 players；與 `running`/`revealing`/`finished` 路徑不同，此路徑**無需建立匿名監聽 session**，也不需要等待廣播——客戶端可立即呈現可操作的加入頁並接受使用者輸入；**`running`/`revealing` 狀態下的 `PLAYER_NOT_IN_ROOM`**：清除 localStorage 後顯示靜態等待頁（「遊戲進行中，請等待下一局後加入」），**不顯示可操作的加入頁**——因為此時填寫暱稱送出後必然收到 `ROOM_NOT_JOINABLE`，二次錯誤體驗不佳；客戶端以匿名 session 監聽下一個 `status=waiting` 廣播，收到後恢復加入頁可操作狀態（**此匿名 session 在現有 WebSocket 連線上建立，不重新建立連線**——行為等同 §14 `ROOM_FINISHED` 升級協定：**Server 在回傳 `PLAYER_NOT_IN_ROOM` 錯誤的同一瞬間自動在此 WebSocket 連線上建立匿名監聽 session，不需客戶端送出額外請求**（升級機制等同 `ROOM_FINISHED`：Server 主動降級為匿名 session 並開始監聽，不等待客戶端額外 handshake）；玩家收到 `waiting` 廣播後透過同一連線提交加入請求；後續失敗路徑（`NAME_TAKEN`、`ROOM_FULL`、`ROOM_NOT_JOINABLE`）同 §14 升級協定步驟 3 規範；**特別說明 `ROOM_NOT_JOINABLE` 競態情境**：`waiting` 廣播與加入請求之間存在競態窗口——若客戶端收到 `status=waiting` 後嘗試加入，但 Server 已再次轉換為 `running`/`revealing`，加入回傳 `ROOM_NOT_JOINABLE`；此時客戶端**不顯示錯誤也不離開等待頁**，繼續以匿名 session 監聽下一個 `status=waiting` 廣播後再次嘗試加入，完全等同 §14 升級協定步驟 3 失敗路徑 ③）；**等待期間客戶端僅響應 `status=waiting` 廣播，其他廣播（`status=revealing`、`status=finished` 等）一律靜默忽略**——客戶端此時無 playerId 且無 result 資料，不得嘗試渲染揭曉畫面或結算頁，否則因缺少必要欄位而崩潰（行為等同 §14 升級協定步驟 1 的等待規則） |
| `PLAYER_KICKED` | 帶 playerId 重連但 playerId 在 kickedPlayerIds | **此檢查適用於所有房間狀態（`waiting`、`running`、`revealing`、`finished`）——不限於 `waiting` 狀態**；**payload 必須包含 `status` 欄位**（目前房間狀態值）——客戶端依此欄位決定走路徑 ① 或 ②，若缺少 `status` 則無法判斷應顯示可操作加入頁或靜態提示頁（理由與 `PLAYER_NOT_IN_ROOM` 要求 `status` 相同）；清除 localStorage；**依房間狀態分兩條路徑**：① `waiting` 狀態：顯示「你已被主持人移除，請使用新暱稱重新加入」，保留可操作加入頁（房間仍可加入）；**WebSocket 已被 Server 關閉，客戶端應自動重新建立新的 WebSocket 連線（無 playerId，不需頁面重載）**，重建連線後呈現可操作加入頁，玩家填寫新暱稱後透過新連線提交加入請求（Server 分配新 playerId），後續失敗路徑（`NAME_TAKEN`、`ROOM_FULL`）同正常加入流程；② `running`/`revealing`/`finished` 狀態：顯示「你已被主持人移除」靜態提示頁，**不顯示可操作加入頁**（因為 `running`/`revealing` 下提交加入請求必然收到 `ROOM_NOT_JOINABLE`，`finished` 下可視為提前知道「被踢且遊戲已開始」）；**Server 在回傳 `PLAYER_KICKED` 錯誤後立即關閉 WebSocket 連線（路徑 ① ② 均適用，與 live 踢除路徑一致）**；**Server 不為被踢玩家建立匿名監聽 session**（此為有意設計——被踢除行為係 Host 刻意操作，不提供與 `PLAYER_NOT_IN_ROOM` 同等的自動恢復路徑）——被踢玩家不接收後續廣播（如 `running`/`revealing` 廣播或 Host 再玩一局發出的 `finished→waiting` 廣播）；玩家需手動重新整理頁面後依當時狀態走對應流程：`running`/`revealing` → `ROOM_NOT_JOINABLE` 靜態等待；`finished`（kickedPlayerIds 未清空）→ 重新收到 `PLAYER_KICKED`，靜態提示頁需告知玩家**「請等待主持人開啟下一局後再重新整理頁面嘗試加入」**（避免玩家陷入不明原因的重整迴圈）；`finished`（Host 已再玩一局使 kickedPlayerIds 清空）→ `PLAYER_NOT_IN_ROOM`，玩家可填寫暱稱加入新局；**此為 MVP 已知 UX 限制**，接受此限制的設計決定應與 §7.1 被踢除流程說明對齊；**再玩一局後 kickedPlayerIds 清空，同一被踢玩家重連時改回傳 `PLAYER_NOT_IN_ROOM`（因 playerId 已不在 players 陣列，詳見 §7.1 被踢除禁令解除說明）** |
| `CANNOT_KICK_HOST` | Host 嘗試踢除自己 | 不顯示錯誤（按鈕應已禁用） |
| `KICK_NOT_ALLOWED_IN_STATE` | 踢除請求到達時 Room 非 `waiting` 狀態 | 不顯示錯誤（按鈕應已禁用）；若發生競態（客戶端點擊時按鈕已啟用，但 Server 處理前狀態已轉換），客戶端靜默忽略，等待下一個 `ROOM_STATE` 廣播後 UI 自然反映最新狀態（踢除按鈕應自動隱藏或禁用） |
| `TITLE_UPDATE_NOT_ALLOWED_IN_STATE` | title 修改請求到達時 Room 非 `waiting` 狀態 | 不顯示錯誤（輸入框應已隱藏或禁用）；若發生競態，客戶端靜默忽略 |
| `WINNER_COUNT_UPDATE_NOT_ALLOWED_IN_STATE` | winnerCount 修改請求到達時 Room 非 `waiting` 狀態 | 不顯示錯誤（輸入框應已隱藏或禁用）；若發生競態，客戶端靜默忽略 |
| `INVALID_WINNER_COUNT` | Host 提交無效 winnerCount（null 或超出 1≤W≤N-1 範圍，含 winnerCount=null 的清空請求，含 N=1 時任意 W 值）| 不顯示錯誤；UI 層應已禁止提交無效值；**此為 Server 端防禦性規則，非新增 UI 互動路徑**——N=1 時 UI 層完全禁用 winnerCount 輸入框（見 §7.6 N=1 特殊邊界），正常流程下不存在此提交路徑 |
| `INVALID_AUTO_REVEAL_INTERVAL` | Host 設定的 autoRevealInterval 超出 1~30 秒合法範圍 | 不顯示錯誤（輸入控制項應已限制合法範圍）；Server 拒絕更新，autoRevealInterval 維持原值；客戶端靜默忽略（見 §16 開放問題：具體錯誤碼值待技術規格確認） |
| `INSUFFICIENT_PLAYERS` | Host 點擊「開始遊戲」時 Server 驗證 N < 2；payload 含 Server 端驗證時的實際 N 值 | 顯示「人數不足（至少需要 2 位玩家）」；Room 維持 `waiting` |
| `WINNER_COUNT_INVALID_AT_START` | Host 點擊「開始遊戲」時 Server 驗證 winnerCount 不合法（W == null、W ≤ 0、或 W ≥ N）；payload 含 reason（`"NULL"` \| `"ZERO_OR_NEGATIVE"` \| `"TOO_LARGE"`）及 Server 端驗證時的實際 N 值；此錯誤與 `INVALID_WINNER_COUNT`（`waiting` 狀態 winnerCount 更新請求錯誤）語意不同，不可混用 | W == null：顯示「請先設定中獎名額」；W ≤ 0：顯示「中獎名額不合法（須大於 0），請設定 1 到 N-1 之間的值」（措辭使用「不合法（須大於 0）」而非「不得為 0」，避免誤導——`reason="ZERO_OR_NEGATIVE"` 涵蓋 W=0 與 W<0 兩種情況，W<0 的情境下「不得為 0」的措辭不準確；正常流程下客戶端 UI 已限制 W≥1，此訊息為 Server 端防禦性回應）；W ≥ N：顯示「中獎名額不合法，請重新設定後再開局」（提示文字含 Server 回傳的實際 N 值，見 §6.2 步驟 5）；Room 維持 `waiting` |
| `PLAY_AGAIN_NOT_ALLOWED_IN_STATE` | 「再玩一局」請求到達時 Room 非 `finished` 狀態 | 不顯示錯誤（按鈕在非 `finished` 狀態應已隱藏）；若發生競態，客戶端靜默忽略並等待下一個狀態廣播 |
| `UNAUTHORIZED` | 請求的 playerId 非 Room.hostId，嘗試觸發 Host 專屬操作（開始遊戲、揭曉控制、再玩一局、踢除玩家、title/winnerCount 修改等）；或再玩一局時 Host isOnline=false（見 §7.6 前置驗證） | 客戶端靜默忽略（相關按鈕在非 Host 客戶端應已隱藏或不存在）；若為競態觸發，等待下一個狀態廣播後 UI 自然還原 |

> **注意**：事件 Payload 詳細結構（含所有欄位）待 PRD 技術規格中定義。

---

## 15. 里程碑建議

> 前置條件（所有 Phase 均依賴）：§17 技術選型完成（Node.js + Redis + Vite + k8s 環境搭建）

| 階段 | 內容 | 預估工期 | 依賴 |
|------|------|----------|------|
| Phase 1 | Room 建立 + Lobby + 玩家加入（含 playerId 機制） | 3~5 天 | §17 環境搭建 |
| Phase 2 | Server 端 Ladder 生成 + 結果計算 + 狀態同步 | 5~7 天 | Phase 1 |
| Phase 3 | Host 端聚焦揭曉 + 玩家端個人視角 + 結算頁 | 5 天 | Phase 2 |
| Phase 4 | 重連機制 + 再玩一局 + 同步優化 + bug fix | 3 天 | Phase 3 |

---

## 16. 開放問題

- [x] **同步方案**：已決定 → 採用 **Redis（原子操作 + Pub/Sub）** 搭配 Node.js LTS（見 §17 技術選型）；不採用 Firebase Realtime Database 或 Supabase Realtime
- [x] **樓梯渲染**：已決定 → 採用 **HTML5 Canvas**（見 §17 技術選型）；不採用 SVG
- [ ] **Host 離線降級**：MVP 先凍結房間；移交 Host 邏輯及自動恢復機制列入 v2 規劃
- [ ] **公開隨機種子**：結算頁是否顯示 seed 供玩家驗算，待 UX 評估決定
- [ ] **房間存活時間**：finished 狀態的房間多久自動清除，待基礎設施成本評估決定
- [ ] **自動輪播計時器持久性**：Server 重啟後 `revealing` 狀態中的自動輪播計時器是否需要恢復；若不恢復，Host 需手動繼續，應補充對應的 UI 提示設計
- [x] **PRNG 演算法規格**：已決定 → 採用 **Mulberry32**（32-bit，純整數運算，跨語言移植性最佳）。seed 字串初始化：以 djb2 hash 將 Room seed 字串（UUID hex，去除連字號，共 32 字元）轉為 uint32 作為 Mulberry32 初始狀態（`state = djb2(seed_string) >>> 0`）。三步驟 PRNG 狀態傳遞：①②③ 共享同一 Mulberry32 實例，狀態連續傳遞不重置，確保整個生成流程使用同一序列。步驟 ① startColumn 指派：Fisher-Yates 洗牌 [0..N-1] 共消耗 N 次 PRNG（Knuth shuffle，i 從 N-1 到 1，每次取 `floor(mulberry32() * (i+1))`）。步驟 ② ladderMap 生成：每次嘗試放置消耗 1 次 PRNG（含失敗嘗試，見 §6.2 密度規則）。步驟 ③ resultSlots 中獎位置選取：Fisher-Yates 洗牌 [0..N-1] 取前 W 個位置作為中獎槽，共消耗 N 次 PRNG（與步驟 ① 相同洗牌演算法；取前 W 個元素作為中獎位置，其餘為未中獎）。事後驗算實作必須採用相同演算法、相同 PRNG 消耗順序，`Math.round` 語意使用 .5 進位（見 §6.2 橫槓密度）
- [x] **autoRevealInterval 越界處理**：已決定 → Server 拒絕並回傳 `INVALID_AUTO_REVEAL_INTERVAL` 錯誤（見 §14 錯誤碼目錄），不更新 autoRevealInterval；客戶端輸入控制應限制合法範圍（1~30 秒），正常流程下不觸發此錯誤
- [ ] **`finished` 狀態房間存活期間玩家體驗**：若 Host 從 `finished` 狀態關閉分頁未按「再玩一局」，玩家持續顯示「請等待主持人開啟下一局後再加入」直到房間 TTL 過期；TTL 設定見「房間存活時間」開放問題
- [x] **手機端揭曉動畫 FPS 目標**：已決定 → ≥ 24fps（見 §3.3 成功指標更新）；參考裝置：近 4 年內 mid-range Android（Snapdragon 720G 等級）及 iPhone 11 以上
- [x] **再玩一局後 winnerCount 越界**：已解決 → 見 §7.6「離線玩家移除（pruning）後 W 越界處理」規格

---

*文件版本：v2.2（PDD rev 4，對應產品 MVP v1）*  
*最後更新：2026-04-19*  
*狀態：Draft — PRNG 演算法、手機端 FPS 目標、同步方案（Redis）、樓梯渲染（Canvas）、autoRevealInterval 越界錯誤碼均已決定（見 §16、§17）；Host 離線降級、公開隨機種子、房間存活時間、自動輪播計時器持久性待 v2 / PRD 確認*

## 17. 技術選型（STEP-02 決定）

> 本節技術決定解決了 §16 中的兩個開放問題（「同步方案」→ Redis；「樓梯渲染」→ HTML5 Canvas），相關開放問題已於 §16 標記為 [x]。

| 層 | 技術 |
|----|------|
| 後端 Runtime | Node.js LTS (≥ 20) |
| 後端語言 | TypeScript (strict mode) |
| HTTP 框架 | Fastify |
| WebSocket | ws（原生，不用 Socket.IO） |
| 房間狀態儲存 | Redis（原子操作 + Pub/Sub） |
| 前端語言 | Vanilla TypeScript |
| 前端渲染 | HTML5 Canvas（樓梯動畫）|
| 前端建構 | Vite |
| 共享邏輯 | Mulberry32 PRNG、遊戲路徑計算（前後端共用 npm workspace） |
| 容器化 | Docker multi-stage（distroless runtime） |
| 基礎設施 | k8s（Rancher Desktop）+ HPA |
| CI/CD | GitHub Actions |
| 測試 | Vitest（unit）+ Supertest（integration）+ Playwright（E2E） |

*選型時間：2026-04-19*
