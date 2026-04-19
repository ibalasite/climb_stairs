# features/host-actions.feature
Feature: 主持人管理操作
  As a 主持人
  I want to 踢除特定玩家並在一局結束後發起再玩一局
  So that 能移除不當參與者並用同一房間繼續下一輪抽獎

  Background:
    Given 主持人已透過 hostToken 驗證身份

  # ---------------------------------------------------------------------------
  # AC-H07-1 — waiting 狀態踢除玩家 → 廣播 PLAYER_KICKED
  # ---------------------------------------------------------------------------
  @AC-HOST-KICK-001 @P1
  Scenario: 主持人在 waiting 狀態踢除玩家後廣播 PLAYER_KICKED
    Given 房間碼 "DELTA5" 存在且狀態為 "waiting"
    And 房間內有玩家 "Tom"（playerId="player-tom-uuid"）
    When 主持人送出 KICK_PLAYER（targetPlayerId="player-tom-uuid"）
    Then 伺服器廣播 PLAYER_KICKED 事件給所有連線客戶端
    And PLAYER_KICKED payload 包含 kickedPlayerId="player-tom-uuid"
    And "Tom" 的客戶端收到後跳轉至「你已被主持人移出房間」頁面
    And 玩家列表即時更新，不再顯示 "Tom"

  # ---------------------------------------------------------------------------
  # AC-H07-2 — 被踢玩家嘗試重連 → PLAYER_KICKED 錯誤
  # ---------------------------------------------------------------------------
  @AC-HOST-KICK-002 @P1
  Scenario: 被踢玩家嘗試以相同 playerId 重連時被拒絕
    Given 房間碼 "DELTA5" 中 playerId="player-tom-uuid" 已存在於 kickedPlayerIds
    When "Tom" 嘗試以相同 playerId="player-tom-uuid" 重新建立 WebSocket 連線
    Then WS Upgrade 被伺服器以 close code 4003 拒絕
    And 前端顯示「你已被移出此房間，無法重新加入」

  # ---------------------------------------------------------------------------
  # AC-H07-3 — running 或之後狀態踢除玩家 → INVALID_STATE
  # ---------------------------------------------------------------------------
  @AC-HOST-KICK-003 @P1
  Scenario Outline: 非 waiting 狀態踢除玩家時系統拒絕並回傳 INVALID_STATE
    Given 房間碼 "DELTA5" 存在且狀態為 "<room_status>"
    And 房間內有玩家 "Jerry"（playerId="player-jerry-uuid"）
    When 主持人送出 KICK_PLAYER（targetPlayerId="player-jerry-uuid"）
    Then 伺服器回傳錯誤碼 "INVALID_STATE"
    And 房間狀態維持 "<room_status>"
    And 玩家 "Jerry" 的連線不受影響

    Examples:
      | room_status |
      | running     |
      | revealing   |
      | finished    |

  # ---------------------------------------------------------------------------
  # AC-H07-4 — 踢除後 playerId 持久化存入 Redis kickedPlayerIds
  # ---------------------------------------------------------------------------
  @AC-HOST-KICK-004 @P1
  Scenario: 踢除操作完成後被踢玩家的 playerId 存入 Redis kickedPlayerIds
    Given 房間碼 "DELTA5" 存在且狀態為 "waiting"
    And 房間內有玩家 "Sam"（playerId="player-sam-uuid"）
    When 主持人成功踢除 "Sam"
    Then Redis 中房間資料的 kickedPlayerIds 包含 "player-sam-uuid"
    And 任何以 playerId="player-sam-uuid" 嘗試重連的請求均回傳 PLAYER_KICKED 錯誤

  # ---------------------------------------------------------------------------
  # AC-H07-5 — RESET_ROOM 後 kickedPlayerIds 清空
  # ---------------------------------------------------------------------------
  @AC-HOST-KICK-005 @P1
  Scenario: 再玩一局後 kickedPlayerIds 被清空
    Given 房間碼 "DELTA5" 狀態為 "finished"
    And kickedPlayerIds 包含 ["player-sam-uuid", "player-tom-uuid"]
    When 主持人送出 RESET_ROOM
    Then 新局初始化完成後 Redis 中 kickedPlayerIds 為空陣列 []
    And 前一局被踢玩家可使用新暱稱加入新局

  # ---------------------------------------------------------------------------
  # AC-H08-1 — 再玩一局：剔除離線玩家後重置為 waiting
  # ---------------------------------------------------------------------------
  @AC-HOST-RESET-001 @P1
  Scenario: 主持人發起再玩一局後系統剔除離線玩家並重置房間
    Given 房間碼 "DELTA5" 狀態為 "finished"
    And 房間有 5 名玩家，其中 "Offline-User"（isOnline=false）
    When 主持人送出 RESET_ROOM
    Then 系統從玩家列表移除 isOnline=false 的 "Offline-User"
    And 伺服器廣播 ROOM_STATE（status="waiting"，含剩餘 4 名在線玩家）

  # ---------------------------------------------------------------------------
  # AC-H08-2 — 再玩一局後 W 越界則重設為 null
  # ---------------------------------------------------------------------------
  @AC-HOST-RESET-002 @P1
  Scenario: 再玩一局後 winnerCount 越界時自動重設為 null
    Given 房間碼 "DELTA5" 狀態為 "finished"，winnerCount=4
    And 剔除離線玩家後剩餘在線玩家數量為 4（新 N=4，W=4 >= 新 N）
    When 主持人送出 RESET_ROOM
    Then 伺服器將 winnerCount 設為 null
    And 主持人收到「中獎名額已重設，請重新設定」提示
    And 新局 ROOM_STATE 中 winnerCount 為 null

  # ---------------------------------------------------------------------------
  # AC-H08-3 — 再玩一局時在線玩家數 < 2 → INSUFFICIENT_ONLINE_PLAYERS
  # ---------------------------------------------------------------------------
  @AC-HOST-RESET-003 @P1
  Scenario: 再玩一局時在線玩家不足兩人時系統拒絕
    Given 房間碼 "DELTA5" 狀態為 "finished"
    And 目前僅有 1 名玩家在線（isOnline=true）
    When 主持人送出 RESET_ROOM
    Then 伺服器回傳錯誤碼 "INSUFFICIENT_ONLINE_PLAYERS"
    And 前端顯示「在線玩家不足，無法開始新局」
    And 房間狀態維持 "finished"

  # ---------------------------------------------------------------------------
  # AC-P06-1/2 — 玩家被踢除後收到 PLAYER_KICKED 通知並跳轉首頁
  # ---------------------------------------------------------------------------
  @AC-P06-001 @P1
  Scenario: 玩家被踢除後收到 PLAYER_KICKED unicast 並跳轉首頁
    Given 房間碼 "DELTA5" 存在且狀態為 "waiting"
    And 玩家 "Alice"（playerId="player-alice-uuid"）已連線至房間
    When 主持人送出 KICK_PLAYER（targetPlayerId="player-alice-uuid"）
    Then 伺服器 unicast PLAYER_KICKED 給 "Alice" 的 WebSocket 連線
    And "Alice" 的客戶端顯示「你已被主持人移出房間」提示
    And "Alice" 的 WebSocket 連線關閉
    And 頁面顯示「回首頁」按鈕

  @AC-P06-002 @P1
  Scenario: 被踢除的玩家嘗試重連時收到 PLAYER_KICKED 錯誤
    Given playerId="player-alice-uuid" 已存在於 kickedPlayerIds
    When "Alice" 嘗試以相同 playerId 重新建立 WebSocket 連線
    Then WS Upgrade 被以 close code 4003 拒絕
    And 前端顯示「你已被移出此房間，無法重新加入」

  # ---------------------------------------------------------------------------
  # NFR-05 — 無效或過期 JWT 嘗試 Host 操作時回傳 401
  # ---------------------------------------------------------------------------
  @AC-AUTH-001 @P0
  Scenario: 使用無效 JWT 執行 Host 操作時收到 401 AUTH_INVALID_TOKEN
    Given 主持人使用格式錯誤或簽名不符的 JWT token
    When 主持人嘗試送出 DELETE /api/rooms/DELTA5/players/some-player-id
    Then HTTP 回應狀態碼為 401
    And 回應錯誤碼為 "AUTH_INVALID_TOKEN"

  @AC-AUTH-002 @P0
  Scenario: 使用過期 JWT 執行 Host 操作時收到 401 AUTH_TOKEN_EXPIRED
    Given 主持人的 JWT token 已超過 6 小時過期
    When 主持人嘗試送出 POST /api/rooms/DELTA5/game/start
    Then HTTP 回應狀態碼為 401
    And 回應錯誤碼為 "AUTH_TOKEN_EXPIRED"
