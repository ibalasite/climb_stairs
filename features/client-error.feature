# features/client-error.feature
Feature: 錯誤狀態的 UI 回饋行為
  As a 玩家或主持人
  I want to 在操作失敗時立刻看到清楚的錯誤提示
  So that 我能理解發生了什麼問題並採取正確的後續行動

  # ---------------------------------------------------------------------------
  # 加入房間 — 輸入驗證錯誤
  # ---------------------------------------------------------------------------
  @error @join @P0
  Scenario: 暱稱為空時送出加入請求，顯示 inline 錯誤提示
    Given 我在首頁的加入房間表單
    When 我未填寫暱稱直接點擊「加入房間」
    Then 暱稱欄位旁顯示「請輸入暱稱」錯誤提示
    And 不送出任何 HTTP 請求
    And 焦點移至暱稱輸入欄位

  @error @join @P0
  Scenario: 房間碼為空時送出加入請求，顯示 inline 錯誤提示
    Given 我在首頁的加入房間表單，已輸入暱稱 "Alice"
    When 我未填寫房間碼直接點擊「加入房間」
    Then 房間碼欄位旁顯示「請輸入房間碼」錯誤提示
    And 不送出任何 HTTP 請求

  @error @join @P0
  Scenario: 房間不存在時顯示 Toast 錯誤訊息
    Given 我在首頁輸入暱稱 "Bob" 與房間碼 "XXXX"
    When 我點擊「加入房間」，伺服器回傳錯誤碼 "ROOM_NOT_FOUND"
    Then 頁面顯示 error Toast「找不到此房間」
    And 頁面維持在首頁視圖

  @error @join @P0
  Scenario: 暱稱已被使用時顯示 Toast 錯誤訊息
    Given 房間 "EPS6" 中已有暱稱為 "Carol" 的玩家
    When 我以暱稱 "Carol" 嘗試加入房間 "EPS6"
    And 伺服器回傳錯誤碼 "NICKNAME_TAKEN"
    Then 頁面顯示 error Toast「此暱稱已被使用，請換一個」
    And 頁面維持在首頁視圖

  @error @join @P1
  Scenario: 房間已滿時顯示 Toast 錯誤訊息
    Given 房間 "EPS6" 已達玩家上限
    When 我嘗試加入房間 "EPS6"
    And 伺服器回傳錯誤碼 "ROOM_FULL"
    Then 頁面顯示 error Toast「房間已滿，無法加入」
    And 頁面維持在首頁視圖

  @error @join @P1
  Scenario: 房間狀態非 waiting 時玩家無法加入並看到提示
    Given 房間 "EPS6" 狀態為 "running"
    When 我嘗試加入房間 "EPS6"
    And 伺服器回傳錯誤碼 "ROOM_NOT_JOINABLE"
    Then 頁面顯示 error Toast「遊戲已開始，無法加入」
    And 頁面維持在首頁視圖

  # ---------------------------------------------------------------------------
  # 建立房間 — 輸入驗證錯誤
  # ---------------------------------------------------------------------------
  @error @create @P0
  Scenario: 暱稱為空時建立房間，顯示 inline 錯誤提示
    Given 我在首頁的建立房間表單
    When 我未填寫暱稱直接點擊「建立房間」
    Then 暱稱欄位旁顯示「請輸入暱稱」錯誤提示
    And 不送出任何 HTTP 請求

  # ---------------------------------------------------------------------------
  # 遊戲操作錯誤（主持人）
  # ---------------------------------------------------------------------------
  @error @host @P0
  Scenario: 人數不足時主持人開始遊戲，顯示 Toast 錯誤
    Given 等待大廳只有主持人一人
    When 主持人點擊「開始遊戲」
    And 伺服器回傳錯誤碼 "INSUFFICIENT_PLAYERS"
    Then 頁面顯示 error Toast「人數不足（至少需要 2 位玩家）」
    And 房間視圖維持在等待大廳

  @error @host @P0
  Scenario: 中獎名額未設定時主持人開始遊戲，顯示 Toast 錯誤
    Given 等待大廳有 3 名玩家但中獎名額尚未設定
    When 主持人點擊「開始遊戲」
    And 伺服器回傳錯誤碼 "PRIZES_NOT_SET"
    Then 頁面顯示 error Toast「請先設定中獎名額」
    And 房間視圖維持在等待大廳

  @error @host @P1
  Scenario: 主持人設定非法中獎名額，顯示 Toast 錯誤
    Given 等待大廳有 5 名玩家
    When 主持人設定中獎名額為 0
    And 伺服器回傳錯誤碼 "INVALID_PRIZES_COUNT"
    Then 頁面顯示 error Toast「中獎名額須介於 1 到玩家數減 1 之間」
    And 中獎名額欄位恢復可編輯狀態

  @error @host @P1
  Scenario: 非主持人嘗試操作主持人功能，顯示 Toast 錯誤
    Given 我是普通玩家
    When 我嘗試透過 WebSocket 發送主持人專屬指令
    And 伺服器回傳錯誤碼 "FORBIDDEN"
    Then 頁面顯示 error Toast，說明操作不被允許

  # ---------------------------------------------------------------------------
  # 被踢出房間
  # ---------------------------------------------------------------------------
  @error @kicked @P0
  Scenario: 被主持人踢出房間時顯示提示並返回首頁
    Given 我在房間 "EPS6" 的等待大廳
    When 主持人將我踢出，伺服器發送 PLAYER_KICKED 事件
    Then 頁面顯示 error Toast「你已被踢出房間」
    And 畫面切換至首頁（lobby 視圖）
    And localStorage 中的 token 被清除

  # ---------------------------------------------------------------------------
  # WebSocket 傳輸層錯誤
  # ---------------------------------------------------------------------------
  @error @ws @P1
  Scenario: WebSocket 未連線時嘗試送出訊息，顯示 Toast 錯誤
    Given 我的 WebSocket 連線已中斷
    When 我嘗試觸發任何需要 WebSocket 的操作
    Then 頁面顯示 error Toast「WebSocket not connected」或類似提示
    And 操作不被執行

  @error @ws @P1
  Scenario: 伺服器回傳通用 ERROR 事件時顯示錯誤訊息
    Given 我在遊戲頁面
    When 伺服器發送 ERROR 事件，其 payload 包含 message="Unexpected error occurred"
    Then 頁面顯示 error Toast 顯示 "Unexpected error occurred"

  # ---------------------------------------------------------------------------
  # Toast 行為規格
  # ---------------------------------------------------------------------------
  @error @toast @P1
  Scenario: Toast 錯誤訊息在 3.5 秒後自動消失
    Given 頁面顯示一條 error Toast
    When 3.5 秒後
    Then Toast 自動淡出並從畫面移除

  @error @toast @P2
  Scenario: 新 Toast 出現時取代舊 Toast（不堆疊）
    Given 頁面正在顯示第一條 Toast 訊息
    When 第二條 Toast 觸發
    Then 第一條 Toast 立即被第二條取代
    And 畫面上同時只顯示一條 Toast
