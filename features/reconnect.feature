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
