Feature: Result View UI
  As a player or host, I want to see the final results clearly so I can confirm the winners and decide next steps

  Background:
    Given the game state is "finished"
    And I am viewing the result view

  # --- 全部路徑揭曉後顯示完整結果 ---

  Scenario: Show all paths after reveal-all
    Given all paths were revealed via REVEAL_ALL
    When I view the canvas on the result page
    Then all player paths should be visible on the canvas
    And each path should render with globalAlpha of 0.6
    And winner paths should have gold glow (shadowColor: #ffd700, shadowBlur: 10)

  Scenario: Full-screen result layout shows canvas and winner list
    When I view the result page
    Then I should see the canvas on the left (or top on mobile)
    And I should see the winner list sidebar on the right
    And the header should show the room name with "FINISHED" status badge

  Scenario: Winner list shows ranked results with crowns
    Given the game finished with winners "Alice" and "Bob", non-winner "Carol"
    When I view the winner list
    Then I should see "Alice" ranked 1st with ♛ crown in gold
    And I should see "Bob" ranked 2nd with ♛ crown in gold
    And I should see "Carol" ranked 3rd without a crown in dim text

  Scenario: Winner entries have gold background styling
    Given "Alice" is a winner
    When I view "Alice"'s result entry
    Then the entry background should be #1c1600
    And the entry border should be #b8960a

  Scenario: Non-winner entries have neutral styling
    Given "Carol" is not a winner
    When I view "Carol"'s result entry
    Then the entry background should be var(--bg)
    And the text should use var(--text-dim)

  Scenario: My own result entry is highlighted
    Given I am player "Bob" and I am a winner
    When I view the result list
    Then my entry should have border-left: 3px solid #6c63ff
    And I should see "(你)" label next to my name in color #6c63ff

  Scenario: Result list is scrollable for large player count
    Given 20 players participated in the game
    When I view the result list
    Then the result list should be scrollable
    And all players should be listed with correct rank order

  Scenario: Gold glow continuously displayed on winner paths in canvas
    Given the game is finished
    When I view the canvas
    Then winner paths should continuously show shadowColor #ffd700 and shadowBlur 10
    And winner endpoints should show gold glow circles

  Scenario: Winner star markers displayed at bottom of winner paths
    Given "Alice" is a winner
    When I view the canvas
    Then a gold ★ should be displayed at the bottom of "Alice"'s rail
    And the star should be rendered at 11px system-ui font

  Scenario: Mobile result view stacks canvas above result list
    Given my viewport is narrower than 768px
    When I view the result page
    Then the canvas should appear at the top with max-height of 50vh
    And the result list should appear below the canvas with max-height of 200px and horizontal scroll

  # --- 再玩一局 ---

  Scenario: Host sees replay button in finished state
    Given I am the host
    When I view the result page
    Then I should see the "再玩一局" button with ghost styling

  Scenario: Replay game resets to waiting room
    Given I am the host
    When I click "再玩一局"
    Then the room should reset to "waiting" state
    And I should be redirected to the waiting room
    And offline players should be removed from the player list

  Scenario: Replay game clears kicked player list
    Given player "Dave" was kicked in the previous round
    When I click "再玩一局" as the host
    Then "Dave" should no longer be in the kicked players list
    And "Dave" can rejoin the room with a fresh nickname

  Scenario: Replay with insufficient online players shows error
    Given only 1 player is currently online
    When I click "再玩一局" as the host
    Then I should see an error toast "在線玩家不足（至少需要 2 位），無法開始新局"
    And the room state should remain "finished"

  Scenario: Non-host does not see replay button
    Given I am not the host
    When I view the result page
    Then I should not see the "再玩一局" button

  Scenario: Winners count resets if it exceeds new player count after replay
    Given winners count was 3 and only 2 players are online after replay
    When the host initiates replay
    Then the winners count should be reset to null
    And I should see a toast "中獎名額已重設，請重新設定"

  # --- 回大廳 ---

  Scenario: Return to lobby navigates to home page
    When I click "回首頁" or navigate to the lobby
    Then I should be on the lobby page
    And the lobby page should show the create-room and join-room forms

  Scenario: Kicked player sees return-to-lobby button
    Given I have been kicked by the host
    When I receive the kick notification
    Then I should see the message "你已被主持人移出房間"
    And I should see a "回首頁" button
    And clicking "回首頁" should navigate me to the lobby

  # --- 結果項目動畫 ---

  Scenario: Result items animate in with fadeSlideIn
    When the result list renders for the first time
    Then each result item should animate with opacity 0 to 1 and translateY 8px to 0
    And animation duration should be 300ms ease
    And each item should be delayed by an additional 50ms per rank position
