# features/room-lifecycle.feature
Feature: 房間生命週期
  As a 主持人
  I want to 建立並管理一個帶有唯一房間碼的房間
  So that 玩家能快速找到並加入我的抽獎活動

  # ---------------------------------------------------------------------------
  # AC-H01-1 — 建立房間：回傳合法 6 碼 Room Code
  # ---------------------------------------------------------------------------
  @AC-ROOM-001 @P0
  Scenario: 成功建立房間並取得合法 6 碼 Room Code
    Given 主持人送出 POST /api/v1/rooms 請求（含 hostNickname 及 winnerCount）
    When 系統處理請求成功
    Then HTTP 回應狀態碼為 201
    And 回應包含 6 碼 roomCode，字元集為大寫英數字（排除 O、0、I、1），符合正規表達式 [A-HJ-NP-Z2-9]{6}
    And Redis 中存在以 "room:{roomCode}" 為 key 的資料
    And 回應時間在 2 秒以內

  # ---------------------------------------------------------------------------
  # AC-H01-2 — 建立成功後主持人進入等待畫面
  # ---------------------------------------------------------------------------
  @AC-ROOM-002 @P0
  Scenario: 主持人建立房間後進入等待畫面
    Given 主持人已成功建立房間，取得 roomCode 及 hostToken
    When 主持人透過 WebSocket 連線至房間
    Then 主持人收到 ROOM_STATE_FULL 事件
    And 事件 payload 中 status 為 "waiting"
    And 玩家列表為空（不含主持人以外的玩家）
    And 頁面包含設定中獎名額的輸入框

  # ---------------------------------------------------------------------------
  # AC-H01-3 — 建立房間失敗時不產生孤立房間
  # ---------------------------------------------------------------------------
  @AC-ROOM-003 @P0
  Scenario: 建立房間因網路異常失敗時不產生孤立房間
    Given 後端模擬回應 HTTP 500 網路異常
    When 主持人送出 POST /api/v1/rooms 請求
    Then HTTP 回應狀態碼為 5xx
    And Redis 中不存在任何對應此請求的 "room:{*}" 孤立 key
    And 前端顯示「建立失敗，請重試」提示

  # ---------------------------------------------------------------------------
  # FR-01-2 — Room Code TTL 與碰撞重試
  # ---------------------------------------------------------------------------
  @AC-ROOM-004 @P0
  Scenario: Room Code 在 Redis 中設有 TTL 且碰撞時最多重試 10 次
    Given 系統正常運作中
    When 主持人成功建立房間
    Then Redis 中 "room:{roomCode}" 的 TTL 大於 0 且不超過 14400 秒（4 小時）

  @AC-ROOM-005 @P0
  Scenario Outline: Room Code 碰撞時系統重試並最終成功
    Given Redis 中已存在 <collision_count> 個佔用的 Room Code
    When 主持人送出建立房間請求
    Then 系統在重試不超過 10 次後成功回傳唯一 roomCode
    And HTTP 回應狀態碼為 201

    Examples:
      | collision_count |
      | 1               |
      | 5               |
      | 9               |

  # ---------------------------------------------------------------------------
  # AC-H01-4 — Room Code 碰撞超過 10 次 → ROOM_CODE_GENERATION_FAILED
  # ---------------------------------------------------------------------------
  @AC-ROOM-006 @P0
  Scenario: Room Code 碰撞超過 10 次後系統回傳 ROOM_CODE_GENERATION_FAILED
    Given Redis 中已存在超過 10 個碰撞的 Room Code，導致每次嘗試均重複
    When 主持人送出建立房間請求
    Then HTTP 回應狀態碼為 500
    And 回應錯誤碼為 "ROOM_CODE_GENERATION_FAILED"
    And 前端顯示「建立失敗，請重試」提示
    And Redis 中不存在任何孤立房間 key

  # ---------------------------------------------------------------------------
  # AC-H02-1 — waiting 狀態下 Host 可更新中獎名額（UPDATE_WINNER_COUNT）
  # ---------------------------------------------------------------------------
  @AC-WIN-001 @P0
  Scenario: 主持人在 waiting 狀態成功更新中獎名額
    Given 房間碼 "ALPHA2" 存在且狀態為 "waiting"
    And 房間有 5 名玩家（N=5）且 winnerCount 尚未設定
    When 主持人送出 UPDATE_WINNER_COUNT（winnerCount=2）
    Then 伺服器接受並廣播 ROOM_STATE 給所有在線玩家
    And ROOM_STATE payload 中 winnerCount 為 2

  @AC-WIN-002 @P0
  Scenario Outline: 主持人設定非法中獎名額時收到 INVALID_PRIZES_COUNT
    Given 房間碼 "ALPHA2" 存在且狀態為 "waiting"
    And 房間有 <N> 名玩家（N=<N>）
    When 主持人送出 UPDATE_WINNER_COUNT（winnerCount=<W>）
    Then 伺服器回傳錯誤碼 "INVALID_PRIZES_COUNT"
    And 房間 winnerCount 維持不變

    Examples:
      | N | W | 說明             |
      | 5 | 0 | W=0，低於下限     |
      | 5 | 5 | W=N，等於上限違規 |

  @AC-WIN-003 @P0
  Scenario: 主持人在非 waiting 狀態更新中獎名額時被拒絕
    Given 房間碼 "ALPHA2" 存在且狀態為 "running"
    When 主持人送出 UPDATE_WINNER_COUNT（winnerCount=1）
    Then 伺服器回傳錯誤碼 "UPDATE_WINNER_COUNT_NOT_ALLOWED_IN_STATE"
    And 房間狀態維持 "running"
