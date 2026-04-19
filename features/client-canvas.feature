# features/client-canvas.feature
Feature: 梯子 Canvas 渲染行為
  As a 玩家
  I want to 在各個遊戲階段看到符合狀態的 Canvas 畫面
  So that 我能清楚掌握遊戲進行狀況並正確辨識自己的結果

  Background:
    Given 我已加入房間 "EPS6"
    And Canvas 元素已掛載於頁面上

  # ---------------------------------------------------------------------------
  # waiting 狀態 — 佔位顯示
  # ---------------------------------------------------------------------------
  @canvas @waiting @P1
  Scenario: 房間狀態為 waiting 時 Canvas 顯示佔位畫面
    Given 房間狀態為 "waiting"
    And 尚未生成梯子資料
    When Canvas 完成初次渲染
    Then Canvas 顯示灰色佔位軌道，對應每位已加入的玩家
    And Canvas 上方顯示每位玩家的暱稱標籤
    And Canvas 不顯示任何橫槓（rung）或路徑
    And Canvas 底部不顯示結果標籤

  @canvas @waiting @P2
  Scenario: waiting 狀態下新玩家加入時 Canvas 即時新增軌道
    Given 房間狀態為 "waiting"，已有 2 名玩家
    When 第 3 名玩家加入房間
    Then Canvas 在不重新載入頁面的情況下新增第 3 條軌道
    And 新軌道對應第 3 名玩家的暱稱與顏色

  # ---------------------------------------------------------------------------
  # running 狀態 — 顯示完整梯子框架
  # ---------------------------------------------------------------------------
  @canvas @running @P0
  Scenario: 房間狀態切換為 running 時 Canvas 渲染完整梯子結構
    Given 房間狀態從 "waiting" 切換為 "running"
    And 伺服器廣播包含 ladderData 的 ROOM_STATE
    When Canvas 接收到新的梯子資料
    Then Canvas 顯示所有垂直軌道，數量等於玩家人數
    And Canvas 顯示所有水平橫槓（rung），位置與伺服器資料一致
    And 每條軌道以對應玩家的顏色繪製
    And 尚未揭曉的路徑不顯示彩色高亮

  @canvas @running @P1
  Scenario: running 狀態下 Canvas 隨視窗大小調整仍維持正確比例
    Given 房間狀態為 "running"，梯子已完整渲染
    When 使用者縮放瀏覽器視窗寬度
    Then Canvas 重新計算列間距與行間距
    And 梯子結構保持正確比例，不出現截斷或溢出

  # ---------------------------------------------------------------------------
  # revealing 狀態 — 揭曉動畫
  # ---------------------------------------------------------------------------
  @canvas @revealing @P0
  Scenario: 觸發揭曉時 Canvas 播放路徑動畫
    Given 房間狀態為 "running"，梯子已渲染
    When 主持人觸發揭曉，Canvas 接收到 REVEAL_INDEX 事件
    Then Canvas 沿對應玩家的行進路徑播放移動動畫
    And 動畫期間路徑以彩色高亮繪製
    And 動畫完成後路徑保持彩色高亮靜止顯示
    And 動畫時間約為 1.5 秒

  @canvas @revealing @P0
  Scenario: 我的路徑揭曉時顯示金色高亮以示區分
    Given 房間狀態為 "running"
    When 我的路徑（自身玩家）被揭曉
    Then Canvas 以金色（#ffd700）繪製我的路徑
    And 其他玩家的路徑以各自的指定顏色繪製

  @canvas @revealing @P1
  Scenario: 揭曉動畫進行中不允許重疊觸發第二條路徑
    Given 第一條路徑正在播放揭曉動畫
    When 第二個 REVEAL_INDEX 事件到達
    Then 第一條動畫繼續播放至完成
    And 第二條路徑於第一條動畫結束後開始播放

  @canvas @revealing @P1
  Scenario: 重連時房間已揭曉部分路徑，Canvas 直接顯示靜態結果不重播動畫
    Given 房間狀態為 "revealing"，已揭曉 3 條路徑
    When 我重新連線並接收 ROOM_STATE_FULL
    Then Canvas 直接以靜態方式繪製已揭曉的 3 條路徑
    And Canvas 不播放任何動畫

  # ---------------------------------------------------------------------------
  # finished 狀態 — 結果顯示
  # ---------------------------------------------------------------------------
  @canvas @finished @P0
  Scenario: 所有路徑揭曉完成後 Canvas 顯示最終結果標籤
    Given 所有玩家的路徑均已揭曉
    When Canvas 完成最後一條路徑的渲染
    Then Canvas 底部每條軌道終點顯示「中獎」或「未中獎」標籤
    And 中獎標籤以金色顯示
    And 未中獎標籤以灰色顯示

  @canvas @finished @P1
  Scenario: finished 狀態下我的結果欄位以明顯樣式標示
    Given 所有路徑均已揭曉，房間狀態為 "finished"
    When 畫面渲染完成
    Then 我的路徑終點標籤比其他玩家更加突出（粗框或額外標記）
