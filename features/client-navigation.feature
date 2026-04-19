# features/client-navigation.feature
Feature: 頁面流程與視圖切換
  As a 玩家或主持人
  I want to 在不同遊戲階段被引導到對應的頁面
  So that 我能看到符合當前狀態的 UI，並依直覺完成每個操作步驟

  # ---------------------------------------------------------------------------
  # 首頁（Lobby）
  # ---------------------------------------------------------------------------
  @navigation @lobby @P0
  Scenario: 首次進入應用程式時顯示首頁
    Given 使用者開啟應用程式首頁
    When 頁面載入完成
    Then 顯示「建立房間」與「加入房間」兩個操作入口
    And 不顯示梯子 Canvas、玩家列表或結果列表

  @navigation @lobby @P0
  Scenario: 主持人填寫暱稱後建立房間，進入等待大廳
    Given 使用者在首頁輸入暱稱 "Alice"
    When 使用者點擊「建立房間」
    And 伺服器回傳房間碼 "EPS6" 與 hostToken
    Then 畫面切換至等待大廳視圖
    And 等待大廳顯示房間碼 "EPS6"
    And 玩家列表中顯示 "Alice"（主持人標記）

  @navigation @lobby @P0
  Scenario: 玩家輸入房間碼與暱稱後加入房間，進入等待大廳
    Given 使用者在首頁輸入暱稱 "Bob" 與房間碼 "EPS6"
    When 使用者點擊「加入房間」
    And 伺服器回傳 playerToken
    Then 畫面切換至等待大廳視圖
    And 等待大廳顯示房間碼 "EPS6"
    And 玩家列表中顯示 "Bob"

  # ---------------------------------------------------------------------------
  # 等待大廳（Waiting Room）
  # ---------------------------------------------------------------------------
  @navigation @waiting @P0
  Scenario: 等待大廳顯示目前已加入的玩家清單
    Given 我已進入房間 "EPS6" 的等待大廳
    When 等待大廳頁面渲染完成
    Then 顯示所有已加入玩家的暱稱與上線狀態
    And 顯示房間碼供玩家分享

  @navigation @waiting @P1
  Scenario: 等待大廳即時更新當其他玩家加入
    Given 我在等待大廳，目前房間有 2 名玩家
    When 第 3 名玩家加入房間，伺服器廣播 ROOM_STATE
    Then 玩家列表即時更新，顯示第 3 名玩家
    And 不需手動重新整理頁面

  @navigation @waiting @P0
  Scenario: 主持人點擊「開始遊戲」後所有人切換至遊戲頁面
    Given 等待大廳有 3 名玩家且中獎名額已設定
    When 主持人點擊「開始遊戲」
    And 伺服器廣播 ROOM_STATE（status="running"，含 ladderData）
    Then 主持人畫面切換至遊戲頁面
    And 所有玩家畫面同步切換至遊戲頁面
    And 遊戲頁面顯示完整梯子 Canvas

  # ---------------------------------------------------------------------------
  # 遊戲頁面（Game View）
  # ---------------------------------------------------------------------------
  @navigation @game @P0
  Scenario: 遊戲頁面顯示房間碼、狀態標籤、玩家列表與 Canvas
    Given 房間狀態為 "running"
    When 遊戲頁面渲染完成
    Then 頁面標題區域顯示房間碼
    And 顯示目前狀態標籤（例如「遊戲進行中」）
    And 右側或下方顯示玩家列表
    And 中央顯示梯子 Canvas

  @navigation @game @P1
  Scenario: 主持人在遊戲頁面看到揭曉控制按鈕，玩家不顯示
    Given 房間狀態為 "running"
    When 主持人的遊戲頁面渲染完成
    Then 主持人看到「揭曉下一個」等操作按鈕
    When 普通玩家的遊戲頁面渲染完成
    Then 普通玩家不看到任何揭曉控制按鈕

  # ---------------------------------------------------------------------------
  # 結果頁面 / 揭曉完成
  # ---------------------------------------------------------------------------
  @navigation @results @P0
  Scenario: 所有路徑揭曉完成後頁面顯示最終結果
    Given 房間狀態為 "revealing"，所有路徑逐一揭曉中
    When 最後一條路徑揭曉完成
    Then Canvas 顯示所有路徑的最終靜態結果
    And 結果列表顯示每位玩家的中獎或未中獎狀態
    And 我的結果以明顯方式標示

  @navigation @results @P1
  Scenario: 主持人可在結果頁面選擇返回首頁或結束房間
    Given 所有路徑已揭曉完成
    When 主持人查看結果頁面
    Then 顯示「返回首頁」或「結束房間」操作按鈕

  # ---------------------------------------------------------------------------
  # 頁面刷新與重新進入
  # ---------------------------------------------------------------------------
  @navigation @refresh @P1
  Scenario: 玩家刷新頁面後根據 localStorage 中的 token 恢復至正確視圖
    Given 我已加入房間 "EPS6" 且 localStorage 存有 myToken 與 myPlayerId
    When 我刷新瀏覽器頁面
    Then 前端以 localStorage 中的 token 重新建立 WebSocket 連線
    And 根據伺服器回傳的房間狀態自動切換至對應視圖（waiting 或 game）

  @navigation @refresh @P1
  Scenario: localStorage 無 token 時刷新頁面顯示首頁
    Given 瀏覽器 localStorage 中無任何 token 資料
    When 使用者開啟或刷新頁面
    Then 直接顯示首頁視圖
    And 不顯示任何載入中或錯誤訊息
