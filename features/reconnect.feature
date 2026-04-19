# features/reconnect.feature
Feature: 斷線與重連行為
  As a 玩家
  I want to 在斷線後能重新連上房間並恢復完整狀態
  So that 不因網路波動而遺失參與資格，並了解跨裝置登入時的 Session 替換行為

  Background:
    Given 房間碼 "EPS6" 已存在

  # ---------------------------------------------------------------------------
  # AC-P05-1 — 玩家帶 playerId 重連，取得完整房間狀態
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-001 @P1
  Scenario: 玩家斷線後以 localStorage 中的 playerId 重連並取得完整房間狀態
    Given 玩家 "Alice" 的 localStorage 中存有 playerId="player-alice-uuid"
    And 房間碼 "EPS6" 狀態為 "waiting"
    When "Alice" 重新訪問房間連結並以 playerId="player-alice-uuid" 建立 WebSocket 連線
    Then 伺服器驗證 playerId 後發送 ROOM_STATE_FULL 給 "Alice"
    And ROOM_STATE_FULL payload 包含完整房間狀態（status、players、ladder、results、selfPlayerId）
    And 重連完成時間在 3 秒以內

  # ---------------------------------------------------------------------------
  # AC-P05-2 — 重連時房間已在 revealing 狀態，直接呈現靜態結果，不重播動畫
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-002 @P1
  Scenario: 玩家重連時房間已在揭曉進行中，顯示靜態結果不重播動畫
    Given 玩家 "Bob" 的 localStorage 中存有 playerId="player-bob-uuid"
    And 房間碼 "EPS6" 狀態為 "revealing"，已揭曉 3 條路徑（revealedCount=3）
    When "Bob" 重新連線至房間
    Then 伺服器發送 ROOM_STATE_FULL，其中包含已揭曉的 3 筆 ResultSlot 資料
    And 前端直接渲染已揭曉路徑的靜態結果，不重播已完成的動畫

  # ---------------------------------------------------------------------------
  # AC-P05-3 — Ghost Player（localStorage 遺失）視為新玩家
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-003 @P1
  Scenario: localStorage 中無 playerId 的 Ghost Player 被視為新玩家處理
    Given 玩家的瀏覽器 localStorage 中不存在任何 playerId
    And 房間碼 "EPS6" 狀態為 "waiting"，房間內已有暱稱 "Carol" 的玩家
    When 玩家嘗試以暱稱 "Carol" 加入房間
    Then 伺服器視為新玩家，但因暱稱重複回傳錯誤碼 "NICKNAME_TAKEN"
    And 提示「此暱稱已被使用，請換一個」

  @AC-RECONNECT-004 @P1
  Scenario: Ghost Player 使用全新暱稱成功加入房間
    Given 玩家的瀏覽器 localStorage 中不存在任何 playerId
    And 房間碼 "EPS6" 狀態為 "waiting"
    When 玩家以全新暱稱 "NewComer" 加入房間
    Then 伺服器視為新玩家，HTTP 回應狀態碼為 201
    And 回應包含新的 playerId（UUID v4 格式）

  # ---------------------------------------------------------------------------
  # FR-07-3 — 同一 playerId 從新裝置連線：舊 session 收到 SESSION_REPLACED，新裝置取得 ROOM_STATE_FULL
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-005 @P1
  Scenario: 同一 playerId 在新裝置登入時舊 session 收到 SESSION_REPLACED
    Given 玩家 "Dave"（playerId="player-dave-uuid"）已在裝置 A 建立 WebSocket 連線（session-A）
    And 房間碼 "EPS6" 狀態為 "waiting"
    When "Dave" 在裝置 B 以相同 playerId="player-dave-uuid" 建立新的 WebSocket 連線
    Then 伺服器更新 "Dave" 的 isOnline=true 關聯至裝置 B 的連線
    And 裝置 A 的 session-A 收到 SESSION_REPLACED 事件
    And 裝置 A 的 WebSocket 連線被關閉
    And 裝置 B 收到 ROOM_STATE_FULL 事件（含完整房間狀態及 selfPlayerId）

  # ---------------------------------------------------------------------------
  # AC-RECONNECT-006 — 舊 session 在新裝置登入時收到 SESSION_REPLACED 通知
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-006 @P1
  Scenario: 舊 session 在收到 SESSION_REPLACED 後連線關閉
    Given 玩家 "Eve"（playerId="player-eve-uuid"）已在裝置 X 建立 WebSocket 連線（session-X）
    And 房間碼 "EPS6" 狀態為 "waiting"
    When "Eve" 在裝置 Y 以相同 playerId="player-eve-uuid" 建立新 WebSocket 連線
    Then 裝置 X 的 session-X 收到 SESSION_REPLACED 事件，其 payload 包含 replacedAt 時間戳
    And 裝置 X 的 WebSocket 連線以 close code 4001 關閉

  # ---------------------------------------------------------------------------
  # AC-RECONNECT-007 — 重連後玩家收到包含完整狀態的 ROOM_STATE_FULL
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-007 @P1
  Scenario: 重連後玩家收到包含完整狀態的 ROOM_STATE_FULL
    Given 玩家 "Frank"（playerId="player-frank-uuid"）已成功加入房間 "EPS6"
    And 玩家 "Frank" 的 WebSocket 連線中斷
    When "Frank" 以相同 playerId="player-frank-uuid" 重新建立 WebSocket 連線
    Then 伺服器發送 ROOM_STATE_FULL 給 "Frank"
    And ROOM_STATE_FULL payload 包含完整房間狀態（status、players、ladder、results、selfPlayerId）
    And "Frank" 在 players 清單中的 isOnline 為 true

  # ---------------------------------------------------------------------------
  # AC-RECONNECT-008 — 玩家斷線時 isOnline 變為 false，重連時恢復 true
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-008 @P1
  Scenario: 玩家斷線後 isOnline 變為 false，重連後恢復 true
    Given 玩家 "Grace"（playerId="player-grace-uuid"）已連線至房間 "EPS6"
    When "Grace" 的 WebSocket 連線意外中斷
    Then 伺服器廣播 ROOM_STATE，其中 "Grace" 的 isOnline 為 false
    When "Grace" 重新建立 WebSocket 連線
    Then 伺服器廣播 ROOM_STATE，其中 "Grace" 的 isOnline 為 true

  # ---------------------------------------------------------------------------
  # AC-RECONNECT-009 — 主持人斷線後房間繼續，進入 grace period
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-009 @P1
  Scenario: 主持人斷線後房間繼續並等待主持人重連（grace period）
    Given 主持人（playerId="host-uuid"）已連線至房間 "EPS6"，房間狀態為 "running"
    When 主持人的 WebSocket 連線意外中斷
    Then 伺服器廣播 ROOM_STATE，主持人的 isOnline 為 false
    And 房間狀態維持 "running"（不中止遊戲）
    And 其他玩家收到提示「主持人暫時離線，等待重連中」
    When 主持人在 grace period 內重新建立 WebSocket 連線
    Then 主持人收到 ROOM_STATE_FULL（含完整遊戲狀態）
    And 房間狀態維持 "running"，遊戲繼續

  # ---------------------------------------------------------------------------
  # AC-RECONNECT-010 — 斷線重連後玩家資料保持不變
  # ---------------------------------------------------------------------------
  @AC-RECONNECT-010 @P1
  Scenario: 斷線重連後玩家暱稱與 colorIndex 等資料保持不變
    Given 玩家 "Henry"（playerId="player-henry-uuid"，nickname="Henry"，colorIndex=3）已連線至房間 "EPS6"
    When "Henry" 的 WebSocket 連線中斷後重新連線
    Then ROOM_STATE_FULL 中 "Henry" 的 nickname 仍為 "Henry"
    And "Henry" 的 colorIndex 仍為 3
    And "Henry" 的 playerId 仍為 "player-henry-uuid"
