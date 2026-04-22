Feature: Game View UI (Canvas)
  As a player or host, I want to see the ladder game rendered on canvas so I can watch the reveal animations

  Background:
    Given I am in the game view of an active room

  # --- 遊戲開始時顯示梯子 ---

  Scenario: Display ladder on game start with correct rail count
    Given the game has started with 3 players
    When I view the game canvas
    Then I should see 3 vertical rails on the canvas
    And each rail should use the dimmed color (colorFromIndexDim) for the player's color index
    And each rail should have RAIL_WIDTH of 3px

  Scenario: Player names displayed at top of canvas
    Given the game has started with players "Alice", "Bob", "Carol"
    When I view the game canvas
    Then I should see "Alice", "Bob", and "Carol" displayed above their respective rails
    And names should be rendered at 13px system-ui font
    And my own name should be in bold purple (#a78bfa)

  Scenario: Canvas uses dark background
    When I view the game canvas
    Then the canvas background should be #0f0f1a
    And the canvas should adapt to devicePixelRatio for Retina displays

  Scenario: Canvas padding matches specification
    When I view the game canvas
    Then the top padding should be 60px for player names
    And the side padding should be 24px on each side
    And the bottom padding should be 32px for result slots

  Scenario: Horizontal rungs rendered between rails
    Given a ladder with rungs defined by the seed
    When I view the game canvas
    Then the rungs should be rendered at RUNG_WIDTH of 2px
    And rungs should have color #3a3a60

  # --- 揭曉路徑動畫 ---

  Scenario: Reveal path animation plays when host clicks next
    Given the game state is "revealing"
    And it is player "Bob"'s turn to be revealed
    When the host clicks "下一位"
    Then I should see an animated ball moving along "Bob"'s path
    And the ball should have BALL_RADIUS of 8px with white core and player color shadow

  Scenario: Path uses player's assigned color during animation
    Given player "Bob" has colorIndex 1
    When "Bob"'s path is being revealed
    Then the animated path should use color hsl(7.2, 70%, 60%)
    And the ball marker should glow with that color at shadowBlur 16

  Scenario: Animating path is fully opaque
    When a path is currently being animated
    Then the path should render with globalAlpha of 1.0

  Scenario: Reveal all paths via REVEAL_ALL broadcast
    Given the game state is "revealing"
    When the host clicks "全部揭曉"
    Then all remaining paths should animate sequentially
    And all animations should complete within 2 seconds
    And if 2 seconds is exceeded the animation jumps to the final frame

  Scenario: Host controls visible in revealing state
    Given I am the host
    And the game state is "revealing"
    Then I should see the "下一位" button
    And I should see the "全部揭曉" button with gold styling
    And I should see the auto-reveal toggle switch

  Scenario: Host begin reveal button visible in running state
    Given I am the host
    And the game state is "running"
    Then I should see the "開始揭曉" button
    And I should not see the "下一位" button

  Scenario: Auto-reveal toggle controls interval input
    Given I am the host and the auto-reveal toggle is off
    Then the interval input should be disabled with opacity 0.4
    When I enable the auto-reveal toggle
    Then the interval input should become enabled
    And the toggle should show aria-checked="true"

  Scenario: Auto-reveal interval validation
    Given I am the host and auto-reveal is enabled
    When I enter 0 in the interval input
    And I start auto-reveal
    Then I should see an error "間隔須為 1～30 的整數"

  # --- 中獎者以金色光暈高亮 ---

  Scenario: Winner highlighted with gold glow effect
    Given all paths are revealed
    And "Alice" is the winner
    When the winner is determined
    Then "Alice"'s path should have shadowColor #ffd700 and shadowBlur 10
    And a star "★" should appear at "Alice"'s bottom position in gold (#ffd700) at 11px

  Scenario: Winner endpoint has gold glow
    Given "Alice" is the winner
    When her path reaches the bottom
    Then the endpoint circle (radius 6px) should have a gold glow

  # --- 已完成路徑半透明顯示 ---

  Scenario: Completed paths are semi-transparent
    Given "Bob"'s path has been fully revealed
    When I view the canvas
    Then "Bob"'s path should render with globalAlpha of 0.6

  Scenario: Currently animating path is fully opaque
    Given "Bob"'s path has been revealed (opacity 0.6)
    And "Carol"'s path is currently being animated
    When I view the canvas
    Then "Carol"'s path should render with globalAlpha of 1.0
    And "Bob"'s path should still render with globalAlpha of 0.6

  Scenario: Multiple revealed paths are semi-transparent
    Given 3 paths have been revealed for "Alice", "Bob", "Carol"
    When I view the canvas
    Then all 3 paths should render with globalAlpha of 0.6
    And winner paths should additionally show the gold glow

  # --- Canvas 視覺層次 ---

  Scenario: Canvas renders visual layers in correct order
    Given a game is in revealing state
    When I view the canvas
    Then the visual layers from bottom to top should be:
      | Layer              | Description                        |
      | rails              | Vertical tracks with dim color     |
      | rungs              | Horizontal bars in #3a3a60         |
      | revealed-paths     | Player paths at opacity 0.6        |
      | animating-path     | Current path at opacity 1.0        |
      | winner-glow        | Gold shadow on winner path         |
      | ball-marker        | Animated ball with glow            |
      | endpoints          | Bottom circles                     |
      | player-names       | Names at top of rails              |
      | winner-star        | Gold ★ at bottom of winner         |

  # --- 佈局與響應式 ---

  Scenario: Desktop layout shows sidebar on the right
    Given my viewport is 1024px or wider
    When I view the game view
    Then I should see the canvas on the left taking majority of width
    And the sidebar should be on the right at 280px width

  Scenario: Mobile layout stacks canvas and sidebar vertically
    Given my viewport is narrower than 768px
    When I view the game view
    Then the canvas should take full width
    And the sidebar results list should appear below the canvas
    And the host controls should be fixed at the bottom

  Scenario: Header shows room name, status badge, and connection dot
    When I view the game view header
    Then I should see the room name as the game title
    And I should see a status badge matching the current game state
    And I should see the connection status dot on the right

  # --- 結果側欄（揭曉中即時更新）---

  Scenario: Result list shows winner entry with crown
    Given "Alice" has been revealed as a winner
    When I view the sidebar result list
    Then I should see "Alice" with a ♛ crown in gold
    And the entry background should be #1c1600 with border #b8960a

  Scenario: Result list shows non-winner entry
    Given "Bob" has been revealed as a non-winner
    When I view the sidebar result list
    Then I should see "Bob" without a crown
    And the entry background should be var(--bg) with dim text

  Scenario: My own result entry is highlighted with purple border
    Given my path has been revealed
    When I view my entry in the result list
    Then my entry should have a purple left border of 3px solid #6c63ff
    And I should see "(你)" label next to my name

  Scenario: Result items animate in sequentially
    Given multiple players have been revealed
    When I view the result list
    Then each result item should fade in with translateY animation of 300ms
    And each subsequent item should be delayed by 50ms
