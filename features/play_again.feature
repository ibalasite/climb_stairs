# features/play_again.feature
#
# BDD Feature: 再玩一場（Play Again After Game Ends）
#
# 對應規格：
#   PRD §3 US-H08 (AC-H08-1 ~ AC-H08-5)
#   PRD §4 FR-12-1 ~ FR-12-3
#   API §2.10 POST /api/rooms/:code/game/play-again
#   API §3.6 WS PLAY_AGAIN
#
# 摘要：
#   遊戲結束（status=finished）後，房主可呼叫「再玩一場」重置房間，
#   所有在線玩家保留在房間並重新進入 waiting 狀態。

Feature: Play Again After Game Ends
  As a host
  I want to trigger "play again" after a game finishes
  So that I can start the next round using the same room without asking players to rejoin

  Background:
    # 前置條件：主持人已取得有效 hostToken，並於 finished 狀態下操作
    Given the host has a valid JWT token with role "host"
    And room "ROOM01" exists with status "finished"

  # ---------------------------------------------------------------------------
  # AC-H08-1：finished 狀態下房主呼叫 play-again → 剔除離線玩家 → 重置為 waiting
  # HTTP 路徑：POST /api/rooms/:code/game/play-again
  # WS 路徑：PLAY_AGAIN 訊息
  # ---------------------------------------------------------------------------

  # 測試 Happy Path：透過 HTTP REST 呼叫再玩一場
  @AC-H08-1 @P1 @http
  Scenario: Host calls play-again via HTTP and room resets to waiting with online players only
    # 房間有 5 名玩家，其中 1 名離線（isOnline=false）
    Given room "ROOM01" has 5 players:
      | nickname  | isOnline |
      | Alice     | true     |
      | Bob       | true     |
      | Carol     | true     |
      | Dave      | true     |
      | Offline1  | false    |
    When the host sends POST /api/rooms/ROOM01/game/play-again with valid token
    Then the HTTP response status is 200
    And the response body contains status "waiting"
    And the response body players list has 4 entries
    And "Offline1" is not in the response players list
    # 廣播 ROOM_STATE 給所有仍在線的玩家
    And a ROOM_STATE broadcast is sent to all connected clients with status "waiting"
    And the ROOM_STATE payload players count is 4

  # 測試 Happy Path：透過 WebSocket 訊息 PLAY_AGAIN 呼叫再玩一場
  @AC-H08-1 @P1 @websocket
  Scenario: Host sends PLAY_AGAIN via WebSocket and room resets to waiting with online players only
    # 房間有 5 名玩家，其中 1 名離線（isOnline=false）
    Given room "ROOM01" has 5 players:
      | nickname  | isOnline |
      | Alice     | true     |
      | Bob       | true     |
      | Carol     | true     |
      | Dave      | true     |
      | Offline1  | false    |
    When the host sends WebSocket message PLAY_AGAIN with payload {}
    Then a ROOM_STATE broadcast is sent to all connected clients
    And the ROOM_STATE payload status is "waiting"
    And the ROOM_STATE payload players list contains exactly 4 entries
    And "Offline1" is not included in the broadcast players list
    # Redis 中確認離線玩家已被剔除
    And the Redis room record for "ROOM01" has 4 players

  # ---------------------------------------------------------------------------
  # AC-H08-1 + FR-12-1：ladder、results 及 revealedCount 在新局中被清空
  # ---------------------------------------------------------------------------
  @AC-H08-1-RESET-DATA @P1
  Scenario: After play-again, game data is cleared and room is in clean waiting state
    # 確認梯子與結果資料在再玩一場後被清空
    Given room "ROOM01" has ladder data and results from the previous game
    And room "ROOM01" has revealedCount = 5
    When the host sends WebSocket message PLAY_AGAIN with payload {}
    Then the ROOM_STATE broadcast contains ladder = null
    And the ROOM_STATE broadcast contains results = null
    And the ROOM_STATE broadcast contains revealedCount = 0
    And the ROOM_STATE broadcast contains rowCount = null

  # ---------------------------------------------------------------------------
  # AC-H08-2 / FR-12-2：再玩一場後 winnerCount 越界時自動重設為 null
  # 當新 N <= 原 winnerCount 時，winnerCount 被重設並通知主持人
  # ---------------------------------------------------------------------------
  @AC-H08-2 @P1
  Scenario: winnerCount is reset to null when it becomes out of bounds after play-again
    # 原 winnerCount=4，剔除離線玩家後剩餘在線玩家 N=4，W >= N 故越界
    Given room "ROOM01" has winnerCount = 4
    And room "ROOM01" has 5 players:
      | nickname  | isOnline |
      | Alice     | true     |
      | Bob       | true     |
      | Carol     | true     |
      | Dave      | true     |
      | Offline1  | false    |
    # 剔除後新 N=4，winnerCount=4 >= N=4，故需重設
    When the host sends WebSocket message PLAY_AGAIN with payload {}
    Then the ROOM_STATE broadcast contains winnerCount = null
    # 主持人應收到需重新設定的提示
    And the host receives an ERROR event with code "WINNER_COUNT_RESET"
    And the error message contains "請重新設定中獎名額"

  # ---------------------------------------------------------------------------
  # AC-H08-3 / FR-12-1：在線玩家 < 2 時拒絕再玩一場
  # HTTP 路徑回傳 400 INSUFFICIENT_ONLINE_PLAYERS
  # WS 路徑回傳 ERROR 事件
  # ---------------------------------------------------------------------------

  # 透過 HTTP 呼叫時的拒絕
  @AC-H08-3 @P1 @http
  Scenario: play-again via HTTP is rejected when online players count is less than 2
    # 房間僅剩主持人 1 名在線
    Given room "ROOM01" has 3 players:
      | nickname  | isOnline |
      | HostUser  | true     |
      | Offline2  | false    |
      | Offline3  | false    |
    When the host sends POST /api/rooms/ROOM01/game/play-again with valid token
    Then the HTTP response status is 400
    And the response error code is "INSUFFICIENT_ONLINE_PLAYERS"
    And the room status remains "finished"

  # 透過 WebSocket 呼叫時的拒絕
  @AC-H08-3 @P1 @websocket
  Scenario: PLAY_AGAIN via WebSocket is rejected when online players count is less than 2
    # 房間僅剩主持人 1 名在線，無法滿足 N >= 2 的條件
    Given room "ROOM01" has 3 players:
      | nickname  | isOnline |
      | HostUser  | true     |
      | Offline2  | false    |
      | Offline3  | false    |
    When the host sends WebSocket message PLAY_AGAIN with payload {}
    Then the host receives an ERROR event with code "INSUFFICIENT_ONLINE_PLAYERS"
    And the error message contains "在線玩家不足（至少需要 2 位），無法開始新局"
    And no ROOM_STATE broadcast is sent
    And the room status remains "finished"

  # ---------------------------------------------------------------------------
  # AC-H08-5 / FR-12-2：再玩一場後 kickedPlayerIds 被清空
  # 前一局被踢者可在新局以全新 playerId 加入
  # ---------------------------------------------------------------------------
  @AC-H08-5 @P1
  Scenario: kickedPlayerIds is cleared after play-again and previously kicked player can rejoin
    # kickedPlayerIds 在再玩一場後必須清空
    Given room "ROOM01" has kickedPlayerIds = ["kicked-player-uuid-1", "kicked-player-uuid-2"]
    And room "ROOM01" has 3 players with 2 online
    When the host sends WebSocket message PLAY_AGAIN with payload {}
    Then the ROOM_STATE broadcast contains kickedPlayerIds = []
    And the Redis room record for "ROOM01" has kickedPlayerIds = []
    # 前次被踢的玩家可以用新暱稱重新加入
    And a new player with nickname "PreviouslyKicked" can join room "ROOM01"

  # ---------------------------------------------------------------------------
  # 非房主呼叫 play-again → 403 Forbidden（HTTP 與 WS 均適用）
  # API §2.10 PLAYER_NOT_HOST / WS §3.6 驗證：host only
  # ---------------------------------------------------------------------------
  @AC-PLAY-AGAIN-NON-HOST @P1 @http
  Scenario: Non-host player calling play-again via HTTP receives 403 Forbidden
    # 非房主使用一般玩家 token 呼叫時應收到 403
    Given room "ROOM01" exists with status "finished"
    And a player "Bob" has a valid JWT token with role "player"
    When "Bob" sends POST /api/rooms/ROOM01/game/play-again with player token
    Then the HTTP response status is 403
    And the response error code is "PLAYER_NOT_HOST"
    And the room status remains "finished"

  @AC-PLAY-AGAIN-NON-HOST @P1 @websocket
  Scenario: Non-host player sending PLAY_AGAIN via WebSocket receives PLAYER_NOT_HOST error
    # 非房主透過 WS 發送 PLAY_AGAIN 時應收到錯誤
    Given room "ROOM01" exists with status "finished"
    And a player "Bob" is connected via WebSocket with role "player"
    When "Bob" sends WebSocket message PLAY_AGAIN with payload {}
    Then "Bob" receives an ERROR event with code "PLAYER_NOT_HOST"
    And no ROOM_STATE broadcast is sent
    And the room status remains "finished"

  # ---------------------------------------------------------------------------
  # AC-H08-5：房間不在 finished 狀態下呼叫 → 400 / INVALID_STATE
  # API §2.10 INVALID_STATE / WS §3.6 驗證：status 必須為 finished
  # ---------------------------------------------------------------------------
  @AC-H08-5 @P1 @http
  Scenario Outline: play-again via HTTP is rejected with INVALID_STATE when room is not finished
    # 只有 finished 狀態允許再玩一場，其他狀態應被拒絕
    Given room "ROOM01" exists with status "<room_status>"
    When the host sends POST /api/rooms/ROOM01/game/play-again with valid token
    Then the HTTP response status is 409
    And the response error code is "INVALID_STATE"
    And the room status remains "<room_status>"

    Examples:
      | room_status |
      | waiting     |
      | running     |
      | revealing   |

  @AC-H08-5 @P1 @websocket
  Scenario Outline: PLAY_AGAIN via WebSocket is rejected with INVALID_STATE when room is not finished
    # WS 路徑同樣拒絕非 finished 狀態的再玩一場請求
    Given room "ROOM01" exists with status "<room_status>"
    When the host sends WebSocket message PLAY_AGAIN with payload {}
    Then the host receives an ERROR event with code "INVALID_STATE"
    And no ROOM_STATE broadcast is sent
    And the room status remains "<room_status>"

    Examples:
      | room_status |
      | waiting     |
      | running     |
      | revealing   |

  # ---------------------------------------------------------------------------
  # FR-12-3 / §3.5 ROOM_STATE：廣播包含所有在線玩家（WS broadcast 驗證）
  # 確保再玩一場後 ROOM_STATE 廣播給所有仍在線玩家（含重連玩家）
  # ---------------------------------------------------------------------------
  @AC-WS-BROADCAST @P1 @websocket
  Scenario: ROOM_STATE broadcast after PLAY_AGAIN reaches all online connected clients
    # 確認 ROOM_STATE 廣播給所有在線客戶端，包含重連回來的玩家
    Given room "ROOM01" exists with status "finished"
    And 4 players are connected via WebSocket to room "ROOM01"
    And 1 player "LostConn" is offline (isOnline=false, no active WebSocket)
    When the host sends WebSocket message PLAY_AGAIN with payload {}
    Then every active WebSocket connection in room "ROOM01" receives a ROOM_STATE message
    And the ROOM_STATE payload contains status = "waiting"
    And the ROOM_STATE payload players list does not contain "LostConn"
    # ROOM_STATE_FULL 為每位玩家 unicast 的完整狀態快照，含 selfPlayerId
    And each connected client receives their own ROOM_STATE_FULL with selfPlayerId set correctly

  # ---------------------------------------------------------------------------
  # 完整流程整合：finished → play-again → waiting → start next game
  # 驗證整個「再玩一場」到「下一局開始」的狀態機轉換
  # ---------------------------------------------------------------------------
  @AC-FULL-FLOW @P1 @integration
  Scenario: Full play-again flow from finished state to next game start
    # 完整流程：遊戲結束 → 再玩一場 → 等待 → 設定中獎名額 → 開始下一局
    Given room "ROOM01" exists with status "finished"
    And room "ROOM01" has 4 online players and 1 offline player
    And room "ROOM01" has kickedPlayerIds = ["kicked-uuid"]
    And room "ROOM01" has winnerCount = 2

    # Step 1: 主持人發起再玩一場
    When the host sends WebSocket message PLAY_AGAIN with payload {}
    Then a ROOM_STATE broadcast is sent with status "waiting"
    And the broadcast players count is 4
    And the broadcast kickedPlayerIds is []
    And the broadcast winnerCount is 2
    # winnerCount=2 < newN=4，保留不重設

    # Step 2: 主持人設定中獎名額並開始新一局
    When the host sets winnerCount to 1 for the new round
    And the host sends WebSocket message START_GAME with payload {}
    Then a ROOM_STATE broadcast is sent with status "running"
    And the broadcast rowCount equals clamp(4 * 3, 20, 60) which is 20
    # seed 與梯子資料在 finished 前不對客戶端公開
    And the broadcast does not contain seed or ladder data
