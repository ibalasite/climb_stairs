Feature: Waiting Room UI
  As a player or host, I want to see the waiting room so I can track who has joined and start the game

  Background:
    Given I am in the waiting room of room "K7NP3Q"

  # --- 顯示房間碼供分享 ---

  Scenario: Display room code for sharing
    Then I should see the room code "K7NP3Q" displayed prominently with accent color
    And the room code should have letter-spacing of 0.25em

  Scenario: Copy invite link via clipboard API
    When I click the room code box or "複製邀請連結" button
    Then the invite URL "{origin}/?room=K7NP3Q" should be copied to clipboard
    And I should see a toast "已複製！"
    And the button should revert to its original text after 1.5 seconds

  Scenario: Fallback input shown when clipboard API is unavailable
    Given the Clipboard API is not available
    When I click "複製邀請連結"
    Then I should see a text input pre-filled with "{origin}/?room=K7NP3Q"
    And the input text should be fully selected for manual copy

  # --- 顯示已加入的所有玩家 ---

  Scenario: Show all joined players
    Given players "Alice", "Bob", and "Carol" have joined the room
    Then I should see 3 player entries in the player list
    And each player should show their colored player dot
    And "Alice" the host should have a host badge

  Scenario: Offline player shows offline label
    Given player "Carol" is disconnected
    Then I should see "Carol" in the player list with an "離線" label
    And the player dot for "Carol" should have opacity 0.35

  Scenario: Host sees kick button on hover for other players
    Given I am the host
    And player "Bob" is in the player list
    When I hover over "Bob"'s player entry
    Then I should see a red kick button for "Bob"

  Scenario: Host cannot see kick button for themselves
    Given I am the host
    When I view my own player entry
    Then I should not see a kick button next to my name

  Scenario: Non-host does not see kick buttons
    Given I am not the host
    When I view the player list
    Then I should not see any kick buttons

  # --- 主持人開始遊戲（2+ 玩家就緒）---

  Scenario: Host can start game when 2 or more players are present
    Given I am the host
    And 2 players are in the room
    And the winners count is set to 1
    When I click "開始遊戲"
    Then the game should start and transition to the game view

  Scenario: Start game button disabled when fewer than 2 players
    Given I am the host
    And only 1 player is in the room
    Then the "開始遊戲" button should be disabled

  Scenario: Start game button disabled when winners count is not set
    Given I am the host
    And 3 players are in the room
    And the winners count input is empty
    Then the "開始遊戲" button should be disabled

  Scenario: Host sets winners count
    Given I am the host
    And 3 players are in the room
    When I enter 1 in the winners count input
    Then the "開始遊戲" button should become enabled

  Scenario: Winners count validation rejects out-of-range values
    Given I am the host
    And 3 players are in the room
    When I enter 3 in the winners count input
    And I click "開始遊戲"
    Then I should see an error "中獎名額須介於 1 到玩家數減 1 之間"

  # --- 非主持人無法開始遊戲 ---

  Scenario: Non-host cannot start game - button not visible
    Given I am not the host
    Then I should not see the "開始遊戲" button
    And I should see the message "等待主持人開始…"

  Scenario: Non-host does not see game settings panel
    Given I am not the host
    Then I should not see the winners count input
    And I should not see the game settings card

  # --- 玩家人數即時更新 ---

  Scenario: Player count updates in real-time when new player joins
    Given I am in the waiting room with 2 players
    When a new player "Dave" joins the room
    Then the player list should update within 2 seconds to show 3 players
    And "Dave" should appear in the player list

  Scenario: Player count updates in real-time when player disconnects
    Given I am in the waiting room with 3 players
    When player "Carol" disconnects
    Then "Carol" should show the "離線" label within 2 seconds
    And the player count should reflect the updated online status

  Scenario: Connection status dot reflects WebSocket state
    Given my WebSocket connection is active
    Then the connection dot should be green
    When my WebSocket connection drops
    Then the connection dot should be red
    When the WebSocket is reconnecting
    Then the connection dot should be gold with a pulse animation
