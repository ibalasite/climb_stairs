# features/client-reconnect.feature
Feature: 前端斷線重連 UI 行為
  As a 玩家
  I want to 在網路中斷時看到明確提示，並在重連後恢復遊戲畫面
  So that 我不會因短暫網路波動而感到困惑或失去遊戲進度

  Background:
    Given 我已加入房間 "EPS6" 並處於遊戲頁面

  # ---------------------------------------------------------------------------
  # 斷線時的 UI 提示
  # ---------------------------------------------------------------------------
  @reconnect @offline @P0
  Scenario: WebSocket 斷線時顯示連線中斷 overlay
    Given 我的 WebSocket 連線正常
    When WebSocket 連線意外中斷
    Then 頁面顯示連線中斷提示（例如灰色 overlay 或 Toast 訊息）
    And 提示文字說明「連線中斷，嘗試重連中…」
    And 連線狀態指示點變為灰色或紅色

  @reconnect @offline @P1
  Scenario: 斷線期間遊戲畫面保持顯示，不清空 Canvas
    Given 我在房間 "EPS6" 的遊戲頁面，梯子已渲染
    When WebSocket 連線中斷
    Then Canvas 繼續顯示已渲染的梯子畫面
    And 不切換至其他頁面或顯示空白畫面

  @reconnect @offline @P1
  Scenario: 斷線時其他玩家的上線狀態指示器更新為離線
    Given 玩家 "Bob" 在玩家列表中顯示為上線
    When 伺服器廣播 ROOM_STATE，其中 "Bob" 的 isOnline 為 false
    Then 玩家列表中 "Bob" 的上線指示器變為灰色或顯示離線標記

  # ---------------------------------------------------------------------------
  # 自動重連進度提示
  # ---------------------------------------------------------------------------
  @reconnect @retry @P0
  Scenario: 前端自動嘗試重連並顯示倒數提示
    Given WebSocket 連線已中斷
    When 前端開始自動重連流程（第 1 次嘗試）
    Then 頁面提示「正在嘗試重新連線（第 1 / 3 次）…」或類似文字
    And 使用者無需手動操作

  @reconnect @retry @P1
  Scenario: 達到最大重連次數後提示使用者手動重新整理
    Given WebSocket 連線已中斷且自動重連已嘗試 3 次
    When 第 3 次重連仍然失敗
    Then 頁面提示「連線失敗，請重新整理頁面」
    And 顯示「重新整理」按鈕或連結

  # ---------------------------------------------------------------------------
  # 重連成功後的 UI 恢復
  # ---------------------------------------------------------------------------
  @reconnect @restore @P0
  Scenario: 重連成功後 overlay 消失，UI 恢復正常
    Given 連線中斷 overlay 正在顯示
    When WebSocket 重新連線成功
    Then 連線中斷 overlay 自動消失
    And 連線狀態指示點變回綠色
    And 遊戲頁面恢復正常操作狀態

  @reconnect @restore @P0
  Scenario: 重連後接收 ROOM_STATE_FULL 並恢復至正確視圖
    Given 我斷線時房間狀態為 "running"
    When 重連成功，伺服器發送 ROOM_STATE_FULL（status="running"）
    Then 頁面維持在遊戲視圖
    And Canvas 重新渲染包含最新狀態的梯子畫面
    And 玩家列表更新為最新的上線狀態

  @reconnect @restore @P1
  Scenario: 重連時房間已進入 revealing 狀態，直接顯示靜態已揭曉結果
    Given 我斷線時房間狀態為 "running"
    When 重連成功，伺服器發送 ROOM_STATE_FULL（status="revealing"，revealedCount=3）
    Then Canvas 直接顯示 3 條已揭曉路徑的靜態畫面
    And 不播放已完成路徑的動畫
    And 結果列表顯示 3 筆已揭曉結果

  @reconnect @restore @P1
  Scenario: 重連後我的 isOnline 狀態更新，其他玩家可見
    Given 我已成功重連至房間 "EPS6"
    When 伺服器廣播 ROOM_STATE（我的 isOnline=true）
    Then 其他玩家的畫面中，我的玩家標籤顯示為上線

  # ---------------------------------------------------------------------------
  # Session 被替換時的 UI 提示
  # ---------------------------------------------------------------------------
  @reconnect @session-replaced @P0
  Scenario: 在同一 playerId 從其他裝置登入時，目前頁面顯示 SESSION_REPLACED 提示
    Given 我在裝置 A 上正在進行遊戲
    When 我在裝置 B 以相同帳號登入同一房間
    Then 裝置 A 的頁面顯示 Toast 訊息「你的帳號已在其他地方登入」
    And 裝置 A 的 WebSocket 連線被關閉
    And 裝置 A 的畫面切換回首頁（lobby 視圖）
    And 裝置 A 的 localStorage token 被清除或失效

  @reconnect @session-replaced @P1
  Scenario: SESSION_REPLACED 後使用者可重新輸入暱稱加入房間
    Given 裝置 A 已因 SESSION_REPLACED 被踢回首頁
    When 使用者在裝置 A 重新輸入暱稱並加入房間
    Then 使用者可正常加入或重新連接房間

  # ---------------------------------------------------------------------------
  # 主持人斷線時的 UI 提示
  # ---------------------------------------------------------------------------
  @reconnect @host-offline @P1
  Scenario: 主持人斷線時玩家頁面顯示主持人離線提示
    Given 我是普通玩家，主持人目前上線
    When 伺服器廣播 ROOM_STATE，主持人的 isOnline 為 false
    Then 頁面顯示提示「主持人暫時離線，等待重連中」
    And 揭曉操作按鈕（若存在）變為停用狀態

  @reconnect @host-offline @P1
  Scenario: 主持人重連後提示消失，操作恢復正常
    Given 主持人離線提示正在顯示
    When 伺服器廣播 ROOM_STATE，主持人的 isOnline 恢復為 true
    Then 主持人離線提示自動消失
    And 揭曉操作按鈕恢復啟用狀態
