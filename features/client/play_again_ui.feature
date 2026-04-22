# features/client/play_again_ui.feature
#
# BDD Feature: 再玩一場 — Client 端 UI 流程
#
# 對應規格：
#   PDD §5.3 Game View — finished 狀態主持人控制面板（「再玩一局」按鈕 .btn-ghost）
#   PDD §5.4 Result View — finished 全螢幕結果頁主持人限定「再玩一局」按鈕
#   API §2.10 POST /api/rooms/:code/game/play-again
#   API §3.6 WS PLAY_AGAIN / ROOM_STATE(waiting) 廣播
#
# 摘要：
#   遊戲結束（status=finished）後，房主看到「再玩一場」按鈕（非房主不顯示/disabled）。
#   房主點擊後 → 呼叫 POST /api/rooms/:code/game/play-again → 成功則 UI 切換至 waiting room。
#   所有玩家收到 WS PLAY_AGAIN 或 ROOM_STATE(waiting) 後同步切換至 waiting room UI。
#   含載入狀態防重複送出、以及 API 錯誤時 Toast 回饋。

Feature: Play Again UI Flow
  As a host or player
  I want the UI to correctly render and handle the "Play Again" action
  So that the host can start a new round and all players transition back to the waiting room

  Background:
    # 前置條件：已有進行完畢的房間，所有玩家已透過 WS 連線
    Given room "ROOM01" exists with status "finished"
    And player "Alice" is the host of room "ROOM01"
    And players "Bob" and "Carol" are non-host members of room "ROOM01"
    And all three players have active WebSocket connections

  # ---------------------------------------------------------------------------
  # 1. Finished 頁面按鈕可見性
  # 主持人看到「再玩一場」按鈕；非主持人不顯示（或為 disabled）
  # 來源：PDD §5.3 finished 狀態控制面板、PDD §5.4 Result View
  # ---------------------------------------------------------------------------

  # 房主在 finished 頁面應看到「再玩一場」按鈕
  @play-again-ui @visibility @host @P0
  Scenario: Host sees "Play Again" button in the finished result view
    # finished 狀態結果頁 Sidebar 底部，主持人限定顯示「再玩一局」.btn-ghost 按鈕
    Given the game has finished and all players are viewing the result page
    When Alice (the host) views the finished result page
    Then Alice sees a "Play Again" button with class "btn-ghost"
    And the "Play Again" button is enabled and clickable

  # 非房主在 finished 頁面不應看到「再玩一場」按鈕
  @play-again-ui @visibility @non-host @P0
  Scenario: Non-host player does not see "Play Again" button in the finished result view
    # 普通玩家的結果頁 Sidebar 底部不渲染「再玩一局」按鈕
    Given the game has finished and all players are viewing the result page
    When Bob (a non-host player) views the finished result page
    Then Bob does not see a "Play Again" button
    And no "Play Again" element is present in Bob's DOM

  # ---------------------------------------------------------------------------
  # 2. 房主點擊「再玩一場」→ 呼叫 POST /api/rooms/:code/game/play-again
  # 來源：API §2.10
  # ---------------------------------------------------------------------------

  # 房主點擊按鈕後前端呼叫正確的 HTTP endpoint
  @play-again-ui @http-call @P0
  Scenario: Host clicks "Play Again" and the client sends POST play-again request
    # 點擊後前端送出 POST /api/rooms/ROOM01/game/play-again，帶上 Authorization Bearer token
    Given Alice is viewing the finished result page
    And the "Play Again" button is visible and enabled
    When Alice clicks the "Play Again" button
    Then the client sends a POST request to "/api/rooms/ROOM01/game/play-again"
    And the request includes "Authorization: Bearer <hostToken>" header
    And the request body is empty or "{}"

  # ---------------------------------------------------------------------------
  # 3. 成功回應 → 切換至 waiting room UI
  # 來源：API §2.10 200 OK、PDD §5.2 Waiting Room
  # ---------------------------------------------------------------------------

  # 伺服器回傳 200 OK，房主 UI 立即切換至等待室
  @play-again-ui @success @navigation @P0
  Scenario: Host UI transitions to waiting room after successful play-again response
    # HTTP 200 → 前端應立即切換至等待室視圖，顯示等待大廳元素
    Given Alice has clicked the "Play Again" button
    When the server responds with HTTP 200 and status "waiting"
    Then Alice's UI transitions to the waiting room view
    And Alice sees the room code "ROOM01" displayed
    And Alice sees the player list in waiting state
    And Alice sees the "Start Game" button (host control)
    And the "Play Again" button is no longer visible

  # ---------------------------------------------------------------------------
  # 4. 收到 WS PLAY_AGAIN 或 ROOM_STATE(waiting) → 所有玩家 UI 切換至 waiting room
  # 來源：API §3.6 WS PLAY_AGAIN、ROOM_STATE broadcast
  # ---------------------------------------------------------------------------

  # 非房主玩家收到 WS ROOM_STATE(waiting) 廣播後切換至等待室
  @play-again-ui @websocket @broadcast @P0
  Scenario: All players transition to waiting room upon receiving ROOM_STATE(waiting) broadcast
    # 伺服器廣播 ROOM_STATE(status="waiting") 後，所有連線玩家 UI 同步切換
    Given the host has triggered play-again and the server broadcasts ROOM_STATE with status "waiting"
    When Bob receives the ROOM_STATE WebSocket message with status "waiting"
    Then Bob's UI transitions from the finished result page to the waiting room view
    And Bob sees the waiting room with the player list
    And Bob sees "Waiting for host to start…" message

  # 收到 WS PLAY_AGAIN 事件（若前端實作 WS 路徑）也應觸發切換
  @play-again-ui @websocket @play-again-event @P1
  Scenario: All players transition to waiting room upon receiving PLAY_AGAIN WebSocket event
    # 前端若監聽 PLAY_AGAIN WS 事件，收到後同樣切換至等待室
    Given all players are viewing the finished result page
    When the server broadcasts a PLAY_AGAIN WebSocket event to all connected clients
    Then Alice's UI transitions to the waiting room view
    And Bob's UI transitions to the waiting room view
    And Carol's UI transitions to the waiting room view

  # 多人同步：所有在線玩家在同一廣播後同時切換
  @play-again-ui @websocket @sync @P1
  Scenario: All online players synchronously switch to waiting room view
    # 確保所有在線玩家（含主持人）在收到 ROOM_STATE(waiting) 後同步切換
    Given the host triggers play-again and the broadcast is sent
    When all connected clients receive the ROOM_STATE broadcast with status "waiting"
    Then Alice's view shows the waiting room
    And Bob's view shows the waiting room
    And Carol's view shows the waiting room
    And no player remains on the finished result page

  # ---------------------------------------------------------------------------
  # 5. 載入狀態：點擊後按鈕 disabled 防止重複送出
  # 來源：PDD §5.4 behaviour、PDD §8.4 Loading States
  # ---------------------------------------------------------------------------

  # 點擊後按鈕立即 disabled，防止重複請求
  @play-again-ui @loading @P0
  Scenario: "Play Again" button becomes disabled immediately after click to prevent duplicate submission
    # 點擊後立即設為 disabled（opacity: 0.4; cursor: not-allowed），不允許第二次點擊
    Given Alice is viewing the finished result page
    And the "Play Again" button is enabled
    When Alice clicks the "Play Again" button
    Then the "Play Again" button becomes disabled immediately
    And the button has attribute "disabled" or CSS class that prevents pointer events
    And no duplicate POST requests are sent if Alice clicks again while the request is pending

  # 請求進行中按鈕顯示載入中文字或樣式
  @play-again-ui @loading @in-progress @P1
  Scenario: "Play Again" button shows loading state while the request is in flight
    # 可選：按鈕文字改為「載入中…」或加上 spinner，提示使用者請求進行中
    Given Alice has clicked the "Play Again" button
    And the POST request to play-again is in progress
    Then the "Play Again" button is in a loading/pending state
    # （按鈕應顯示禁用樣式；文字可為「再玩一場」或「載入中…」依實作決定）

  # 請求完成（成功或失敗）後按鈕恢復可互動
  @play-again-ui @loading @recovery @P1
  Scenario: "Play Again" button returns to enabled state if the request fails
    # 請求失敗後按鈕應恢復啟用，讓房主可以重試
    Given Alice has clicked the "Play Again" button
    And the "Play Again" button is in disabled/loading state
    When the server responds with HTTP 403 "PLAYER_NOT_HOST"
    Then the "Play Again" button returns to enabled state
    And Alice can click the button again

  # ---------------------------------------------------------------------------
  # 6. 錯誤處理：API 回傳 400/403 → 顯示 Toast 錯誤訊息
  # 來源：API §2.10 Error Responses、PDD §4.5 Toast、PDD §8.3 錯誤 UI 層次
  # ---------------------------------------------------------------------------

  # HTTP 403 PLAYER_NOT_HOST → 顯示 Toast 錯誤，UI 不切換
  @play-again-ui @error @P0
  Scenario: API returns 403 PLAYER_NOT_HOST and the client shows an error toast
    # 若操作者 token 不是房主（理論上不應發生，但仍需防禦），顯示 error toast
    Given Alice's token unexpectedly returns PLAYER_NOT_HOST
    When Alice clicks the "Play Again" button and the server returns HTTP 403
    Then an error Toast is displayed with message containing "操作失敗" or "不是房主"
    And the Toast has class "toast-error"
    And the UI remains on the finished result page
    And the "Play Again" button returns to enabled state

  # HTTP 400 INSUFFICIENT_ONLINE_PLAYERS → 顯示 Toast 錯誤，UI 不切換
  @play-again-ui @error @P0
  Scenario: API returns 400 INSUFFICIENT_ONLINE_PLAYERS and the client shows an error toast
    # 在線玩家 < 2 時點擊「再玩一場」，server 回 400，前端顯示 toast 提示
    Given only Alice is online in room "ROOM01" at the moment
    When Alice clicks the "Play Again" button and the server returns HTTP 400 "INSUFFICIENT_ONLINE_PLAYERS"
    Then an error Toast is displayed with message containing "在線玩家不足" or "至少需要 2 位"
    And the Toast has class "toast-error"
    And the UI remains on the finished result page
    And the "Play Again" button returns to enabled state

  # HTTP 409 INVALID_STATE → 顯示 Toast 錯誤，UI 不切換（防禦性）
  @play-again-ui @error @P1
  Scenario: API returns 409 INVALID_STATE and the client shows an error toast
    # 若房間狀態已因競態條件改變，server 回 409，前端顯示 toast 提示
    Given room "ROOM01" status has changed unexpectedly before the request arrives
    When Alice clicks the "Play Again" button and the server returns HTTP 409 "INVALID_STATE"
    Then an error Toast is displayed with message containing "狀態錯誤" or "請重新整理"
    And the Toast has class "toast-error"
    And the UI remains on the current page
    And the "Play Again" button returns to enabled state

  # Toast 自動消失（3 秒後）且不堆疊
  @play-again-ui @error @toast-behavior @P1
  Scenario: Error toast from play-again failure auto-dismisses after 3 seconds
    # play-again 錯誤 toast 遵守全域 Toast 行為規範（PDD §4.5）
    Given an error toast was shown due to a play-again API failure
    When 3 seconds have elapsed
    Then the error Toast automatically fades out and is removed from the DOM

  # ---------------------------------------------------------------------------
  # 7. 手機版（< 768px）佈局：「再玩一場」按鈕位於底部固定控制欄
  # 來源：PDD §5.4 手機版 Result View layout
  # ---------------------------------------------------------------------------

  @play-again-ui @responsive @mobile @P1
  Scenario: On mobile viewport "Play Again" button appears in the bottom control bar
    # 手機版（< 768px）finished 頁面：Canvas 上方、得獎名單下方、底部顯示「再玩一局」
    Given the viewport width is 375px (mobile)
    And the game has finished
    When Alice (the host) views the finished result page on mobile
    Then the "Play Again" button is rendered in the bottom control bar area
    And the button is fully visible without requiring horizontal scroll

  # ---------------------------------------------------------------------------
  # 8. 整合流程：finished → play-again → waiting → 下一局可開始
  # 完整 UI 狀態機轉換驗證
  # ---------------------------------------------------------------------------

  @play-again-ui @integration @full-flow @P1
  Scenario: Full UI flow from finished result page through play-again back to waiting room
    # 完整流程：結果頁 → 點擊「再玩一場」→ 等待室 → 主持人可設定並開始新局
    Given the game has finished with 3 online players
    And all players are on the finished result page

    # Step 1: 按鈕點擊 → 載入狀態
    When Alice clicks the "Play Again" button
    Then the "Play Again" button becomes disabled
    And the client sends POST to "/api/rooms/ROOM01/game/play-again"

    # Step 2: 成功回應 → UI 切換
    When the server responds with HTTP 200 and ROOM_STATE(status="waiting")
    Then Alice's UI transitions to the waiting room view
    And Bob's UI transitions to the waiting room view
    And Carol's UI transitions to the waiting room view

    # Step 3: 等待室功能可正常使用
    And Alice sees the room code "ROOM01"
    And Alice sees "Bob" and "Carol" in the player list
    And Alice can set winnerCount and click "Start Game" to begin a new round
