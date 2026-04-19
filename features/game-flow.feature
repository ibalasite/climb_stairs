# features/game-flow.feature
Feature: 遊戲流程控制
  As a 主持人
  I want to 設定中獎名額並在玩家就緒後開始遊戲
  So that 伺服器生成確定性樓梯結構並讓所有客戶端同步進入揭曉流程

  Background:
    Given 房間碼 "BETA23" 已存在且狀態為 "waiting"
    And 主持人已透過 hostToken 驗證身份

  # ---------------------------------------------------------------------------
  # AC-H02-1 — 設定合法 W，伺服器接受並廣播 ROOM_STATE
  # ---------------------------------------------------------------------------
  @AC-GAME-WIN-001 @P0
  Scenario: 主持人設定合法中獎名額
    Given 房間有 5 名玩家（N=5，含主持人）
    When 主持人設定中獎名額 W=2（1 ≤ W ≤ N-1=4）
    Then 伺服器接受設定
    And 所有在線玩家收到廣播的 ROOM_STATE
    And ROOM_STATE payload 中 winnerCount 為 2

  # ---------------------------------------------------------------------------
  # AC-H02-2 — W 超出範圍 → INVALID_PRIZES_COUNT
  # ---------------------------------------------------------------------------
  @AC-GAME-WIN-002 @P0
  Scenario Outline: 主持人設定非法中獎名額時收到 INVALID_PRIZES_COUNT 錯誤
    Given 房間有 <N> 名玩家（含主持人）
    When 主持人設定中獎名額 W=<W>
    Then 伺服器回傳錯誤碼 "INVALID_PRIZES_COUNT"
    And 錯誤訊息包含「中獎名額須介於 1 到玩家數減 1 之間」
    And 房間 winnerCount 維持不變

    Examples:
      | N  | W  | 說明              |
      | 5  | 0  | W=0，低於下限      |
      | 5  | -1 | W<0，負數          |
      | 5  | 5  | W=N，等於上限違規  |
      | 5  | 6  | W>N，超過玩家數    |

  # ---------------------------------------------------------------------------
  # AC-H03-1 — 成功開始遊戲：狀態轉為 running，廣播樓梯資料
  # ---------------------------------------------------------------------------
  @AC-GAME-START-001 @P0
  Scenario: 主持人滿足條件後成功開始遊戲
    Given 房間有 3 名玩家（N=3）且 winnerCount=1 已設定
    When 主持人點擊「開始遊戲」
    Then HTTP 回應狀態碼為 200
    And 回應包含 LadderData（含 seed、seedSource、rowCount、segments）
    And 伺服器廣播 ROOM_STATE，status 為 "running"
    And 所有客戶端收到完全一致的 ladderMap

  # ---------------------------------------------------------------------------
  # AC-H03-2 — W 未設定 → PRIZES_NOT_SET
  # ---------------------------------------------------------------------------
  @AC-GAME-START-002 @P0
  Scenario: W 尚未設定時主持人開始遊戲被拒絕
    Given 房間有 3 名玩家（N=3）且 winnerCount 尚未設定（為 null）
    When 主持人點擊「開始遊戲」
    Then 伺服器回傳錯誤碼 "PRIZES_NOT_SET"
    And 錯誤訊息包含「請先設定中獎名額」
    And 房間狀態維持 "waiting"

  # ---------------------------------------------------------------------------
  # AC-H03-4 — N < 2 → INSUFFICIENT_PLAYERS
  # ---------------------------------------------------------------------------
  @AC-GAME-START-003 @P0
  Scenario: 房間只有主持人一人時開始遊戲被拒絕
    Given 房間只有主持人一人（N=1）
    When 主持人點擊「開始遊戲」
    Then 伺服器回傳錯誤碼 "INSUFFICIENT_PLAYERS"
    And 前端顯示「人數不足（至少需要 2 位玩家）」
    And 房間狀態維持 "waiting"

  # ---------------------------------------------------------------------------
  # AC-H03-5 — rowCount 邊界值驗證（N=3→20, N=10→30, N=21→60）
  # ---------------------------------------------------------------------------
  @AC-GAME-START-004 @P0
  Scenario Outline: 遊戲開始後 rowCount 符合 clamp(N*3, 20, 60) 公式
    Given 房間有 <N> 名玩家且 winnerCount 已合法設定
    When 主持人成功開始遊戲
    Then 伺服器廣播的 ROOM_STATE 中 ladder.rowCount 為 <expected_rowCount>

    Examples:
      | N  | expected_rowCount | 說明                     |
      | 2  | 20                | clamp(6, 20, 60)=20      |
      | 3  | 20                | clamp(9, 20, 60)=20      |
      | 10 | 30                | clamp(30, 20, 60)=30     |
      | 20 | 60                | clamp(60, 20, 60)=60     |
      | 21 | 60                | clamp(63, 20, 60)=60     |
      | 50 | 60                | clamp(150, 20, 60)=60    |
