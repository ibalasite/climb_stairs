Feature: Lobby UI
  As a player or host, I want to create or join a game from the lobby

  Background:
    Given I am on the lobby page

  # --- 建立房間 ---

  Scenario: Create room from lobby as host
    When I enter nickname "Alice" in the create-room form
    And I click "建立房間"
    Then I should see the waiting room
    And my nickname "Alice" should be displayed in the player list
    And I should see the host badge next to my name

  Scenario: Create room with optional room title
    When I enter nickname "Alice" in the create-room form
    And I enter room title "年終抽獎 2026"
    And I click "建立房間"
    Then I should see the waiting room
    And the room title "年終抽獎 2026" should be displayed

  Scenario: Create room button shows loading state
    When I enter nickname "Alice" in the create-room form
    And I click "建立房間"
    Then the button should display "建立中…" and be disabled during the request

  Scenario: Create room failure shows error toast
    Given the server returns a create-room error
    When I enter nickname "Alice" in the create-room form
    And I click "建立房間"
    Then I should see an error toast "建立失敗，請重試"
    And the nickname input should still contain "Alice"

  # --- 加入房間 ---

  Scenario: Join room from lobby
    When I enter nickname "Bob" in the join-room form
    And I enter room code "ABC123"
    And I click "加入房間"
    Then I should be in the waiting room with other players

  Scenario: Join room with URL room parameter pre-filled
    Given I navigate to the lobby with URL parameter "?room=K7NP3Q"
    Then the room code input should be pre-filled with "K7NP3Q"

  Scenario: Join button auto-enabled when both nickname and room code are filled
    Given the room code input is pre-filled via URL parameter "K7NP3Q"
    And the nickname input is pre-filled from localStorage "ladder_last_nickname" as "Carol"
    Then the "加入房間" button should be enabled without further interaction

  # --- 表單驗證 ---

  Scenario: Empty nickname validation on create-room
    When I click "建立房間" without entering a nickname
    Then I should see an inline error message for the nickname field
    And the "建立房間" button should be disabled

  Scenario: Empty nickname validation on join-room
    When I enter room code "ABC123"
    And I click "加入房間" without entering a nickname
    Then I should see an inline error message for the nickname field
    And the "加入房間" button should be disabled

  Scenario: Nickname exceeding 20 characters shows validation error
    When I enter a nickname of 21 characters in the create-room form
    Then I should see an inline error message "暱稱須為 1–20 個字元"
    And the "建立房間" button should be disabled

  Scenario: Room code field forces uppercase input
    When I type "abc123" into the room code input
    Then the room code input should display "ABC123"

  Scenario: Duplicate nickname error from server
    Given the server returns error "NICKNAME_TAKEN"
    When I enter nickname "Alice" in the join-room form
    And I enter room code "ABC123"
    And I click "加入房間"
    Then I should see an error toast "此暱稱已被使用，請換一個"

  Scenario: Room not found error from server
    Given the server returns error "ROOM_NOT_FOUND"
    When I enter nickname "Bob" in the join-room form
    And I enter room code "XXXXXX"
    And I click "加入房間"
    Then I should see an error toast "找不到此房間，請確認房間碼"

  Scenario: Room full error from server
    Given the server returns error "ROOM_FULL"
    When I enter nickname "Bob" in the join-room form
    And I enter room code "ABC123"
    And I click "加入房間"
    Then I should see an error toast "房間已滿，無法加入"

  Scenario: Room not joinable when game already started
    Given the server returns error "ROOM_NOT_JOINABLE"
    When I enter nickname "Bob" in the join-room form
    And I enter room code "ABC123"
    And I click "加入房間"
    Then I should see an error toast "此房間遊戲已開始，無法加入"

  # --- 已有暱稱自動填入 ---

  Scenario: Nickname auto-filled from localStorage
    Given localStorage key "ladder_last_nickname" is set to "Carol"
    When I visit the lobby page
    Then the nickname input in the join-room form should be pre-filled with "Carol"

  Scenario: Nickname is saved to localStorage after successful join
    When I enter nickname "Dave" in the join-room form
    And I enter room code "ABC123"
    And I click "加入房間"
    And the join is successful
    Then localStorage key "ladder_last_nickname" should be set to "Dave"
