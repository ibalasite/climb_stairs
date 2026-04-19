# features/reveal-flow.feature
Feature: 路徑揭曉流程
  As a 主持人
  I want to 手動逐步、自動定時或一鍵揭曉所有玩家的路徑
  So that 能配合現場節奏製造懸念，或在時間緊迫時快速完成抽獎

  Background:
    Given 房間碼 "GAMMA4" 已存在且狀態為 "revealing"
    And 房間有 4 名玩家（N=4），winnerCount=1
    And 主持人已透過 hostToken 驗證身份
    And 尚有未揭曉的路徑

  # ---------------------------------------------------------------------------
  # AC-H04-1 — 手動模式：REVEAL_NEXT → 廣播 REVEAL_INDEX 給所有客戶端
  # ---------------------------------------------------------------------------
  @AC-REVEAL-001 @P0
  Scenario: 主持人點擊「下一位」後所有客戶端同步播放揭曉動畫
    Given 目前已揭曉 0 條路徑（revealedCount=0）
    When 主持人送出 WS 訊息 REVEAL_NEXT
    Then 伺服器廣播 REVEAL_INDEX 事件給房間內所有連線客戶端
    And REVEAL_INDEX payload 包含 playerIndex、result 及 revealedCount=1

  # ---------------------------------------------------------------------------
  # AC-H04-2 — 所有路徑已揭曉後再點擊「下一位」，系統不回應且按鈕 disabled
  # ---------------------------------------------------------------------------
  @AC-REVEAL-002 @P0
  Scenario: 所有路徑揭曉完畢後主持人再點擊「下一位」系統不回應
    Given 所有 4 條路徑已全數揭曉（revealedCount=4）
    When 主持人送出 WS 訊息 REVEAL_NEXT
    Then 伺服器不廣播任何 REVEAL_INDEX 事件
    And 伺服器回傳 ERROR 事件，code 為 "INVALID_STATE"
    And 前端「下一位」按鈕保持 disabled 狀態

  # ---------------------------------------------------------------------------
  # AC-H05-1 — 自動模式：每隔 T 秒廣播下一個 REVEAL_INDEX
  # ---------------------------------------------------------------------------
  @AC-REVEAL-003 @P1
  Scenario: 主持人設定自動揭曉間隔後系統定時廣播
    Given 目前已揭曉 0 條路徑
    When 主持人送出 SET_REVEAL_MODE（mode="auto"，intervalSec=3）
    Then 每隔 3 秒伺服器自動廣播下一個 REVEAL_INDEX
    And 重複直到所有 4 條路徑全部揭曉（revealedCount=4）

  # ---------------------------------------------------------------------------
  # AC-H05-2 — 自動模式進行中切換回手動模式，計時停止
  # ---------------------------------------------------------------------------
  @AC-REVEAL-004 @P1
  Scenario: 自動揭曉進行中切換回手動模式後計時停止
    Given 自動揭曉模式進行中（intervalSec=5），已揭曉 2 條路徑
    When 主持人送出 SET_REVEAL_MODE（mode="manual"）
    Then 伺服器停止自動計時，不再自動廣播 REVEAL_INDEX
    And 已揭曉的 2 條路徑結果不受影響
    And 後續揭曉需由主持人手動觸發 REVEAL_NEXT

  # ---------------------------------------------------------------------------
  # AC-H06-1 — 一鍵全揭：REVEAL_ALL_TRIGGER → 廣播 REVEAL_ALL
  # ---------------------------------------------------------------------------
  @AC-REVEAL-005 @P0
  Scenario: 主持人點擊「全部揭曉」後伺服器廣播 REVEAL_ALL
    Given 目前已揭曉 1 條路徑，剩餘 3 條未揭曉
    When 主持人送出 WS 訊息 REVEAL_ALL_TRIGGER
    Then 伺服器廣播 REVEAL_ALL 事件給所有客戶端
    And REVEAL_ALL payload 包含所有剩餘 3 條路徑的完整 ResultSlot 資料
    And 所有客戶端於 2 秒內完成剩餘路徑動畫渲染

  # ---------------------------------------------------------------------------
  # AC-H06-2 — REVEAL_ALL 廣播後狀態自動轉為 finished
  # ---------------------------------------------------------------------------
  @AC-REVEAL-006 @P0
  Scenario: REVEAL_ALL 廣播後房間狀態自動轉為 finished 並顯示完整得獎名單
    Given 主持人已觸發 REVEAL_ALL_TRIGGER
    And 伺服器已廣播 REVEAL_ALL
    When 所有客戶端完成動畫播放
    Then 伺服器廣播 ROOM_STATE，status 為 "finished"
    And 所有客戶端顯示完整得獎名單
