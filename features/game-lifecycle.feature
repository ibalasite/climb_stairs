Feature: Game Lifecycle
  As a host
  I want to manage the full game lifecycle from start to finish
  So that all players can participate in a fair and synchronized lottery

  Background:
    Given a room with code "GAME01" exists and status is "waiting"
    And the host is authenticated with a valid hostToken

  # ---------------------------------------------------------------------------
  # AC-H03-1 — Start game with valid state transitions to running
  # ---------------------------------------------------------------------------
  Scenario: Start game with 2 or more players
    # AC-H03-1
    Given room has 3 players and winnerCount is set to 1
    When host sends { type: "START_GAME" } via WebSocket
    Then all players receive ROOM_STATE with status "running"
    And the broadcast contains rowCount equal to clamp(N*3, 20, 60)
    And seed and ladderData are NOT included in the broadcast

  # ---------------------------------------------------------------------------
  # AC-H03-1 — Ladder data is generated at BEGIN_REVEAL, not START_GAME
  # ---------------------------------------------------------------------------
  Scenario: Ladder data is generated when host triggers BEGIN_REVEAL
    # AC-H03-1, FR-04-1
    Given room status is "running" with 3 players and winnerCount 1
    When host sends { type: "BEGIN_REVEAL" } via WebSocket
    Then room status transitions to "revealing"
    And all players receive ROOM_STATE_FULL with ladderData (without seed)
    And all players see identical ladder structure and bar positions

  # ---------------------------------------------------------------------------
  # AC-H03-2 — Start game fails when winnerCount is not set
  # ---------------------------------------------------------------------------
  Scenario: Start game rejected when winnerCount is not set
    # AC-H03-2
    Given room has 3 players and winnerCount is null
    When host sends { type: "START_GAME" } via WebSocket
    Then host receives ERROR event with code "PRIZES_NOT_SET"
    And room status remains "waiting"

  # ---------------------------------------------------------------------------
  # AC-H03-4 — Start game rejected when player count is insufficient
  # ---------------------------------------------------------------------------
  Scenario: Start game rejected when only host is in the room
    # AC-H03-4
    Given room has only the host (N=1) and winnerCount is set to 1
    When host sends { type: "START_GAME" } via WebSocket
    Then host receives ERROR event with code "INSUFFICIENT_PLAYERS"
    And the message indicates at least 2 players are required
    And room status remains "waiting"

  # ---------------------------------------------------------------------------
  # AC-H03-5 — rowCount formula clamp(N*3, 20, 60) boundary values
  # ---------------------------------------------------------------------------
  Scenario Outline: rowCount follows clamp(N*3, 20, 60) formula
    # AC-H03-5
    Given room has <N> players and winnerCount is validly set
    When host starts the game successfully
    Then broadcast rowCount equals <expected_rowCount>

    Examples:
      | N  | expected_rowCount | note                    |
      | 2  | 20                | clamp(6, 20, 60)=20     |
      | 3  | 20                | clamp(9, 20, 60)=20     |
      | 10 | 30                | clamp(30, 20, 60)=30    |
      | 21 | 60                | clamp(63, 20, 60)=60    |

  # ---------------------------------------------------------------------------
  # AC-H04-1 — BEGIN_REVEAL transitions state to revealing
  # ---------------------------------------------------------------------------
  Scenario: Begin reveal transitions room from running to revealing
    # AC-H04-1
    Given room status is "running" with 3 players and winnerCount 1
    When host sends { type: "BEGIN_REVEAL" } via WebSocket
    Then room status transitions to "revealing"
    And all players receive ROOM_STATE broadcast with status "revealing"
    And the operation completes within 1 second

  # ---------------------------------------------------------------------------
  # AC-H04-2 — Reveal one player path manually
  # ---------------------------------------------------------------------------
  Scenario: Reveal one player's path manually
    # AC-H04-2
    Given room status is "revealing" with 3 players and revealedCount is 0
    When host sends { type: "REVEAL_NEXT" } via WebSocket
    Then all players receive REVEAL_INDEX event
    And REVEAL_INDEX payload contains playerIndex, result, and revealedCount=1
    And all clients render the player's path animation synchronously

  # ---------------------------------------------------------------------------
  # AC-H06-1, AC-H06-2 — Reveal all paths simultaneously
  # ---------------------------------------------------------------------------
  Scenario: Reveal all remaining paths simultaneously with REVEAL_ALL_TRIGGER
    # AC-H06-1, AC-H06-2
    Given room status is "revealing" with 4 players and revealedCount is 1
    When host sends { type: "REVEAL_ALL_TRIGGER" } via WebSocket
    Then all players receive REVEAL_ALL event
    And REVEAL_ALL payload contains all remaining 3 unrevealed results
    And all clients render the animations within 2 seconds
    And host then sends END_GAME to finalize the game
    And room status transitions to "finished"
    And all players receive ROOM_STATE with status "finished" containing complete results and seed

  # ---------------------------------------------------------------------------
  # AC-H04-4 — END_GAME after all paths revealed transitions to finished
  # ---------------------------------------------------------------------------
  Scenario: Game completion with winner announcement after all paths revealed
    # AC-H04-4, US-P04
    Given room status is "revealing" with 3 players and all paths revealed (revealedCount=3)
    When host sends { type: "END_GAME" } via WebSocket
    Then room status transitions to "finished"
    And all players receive ROOM_STATE with status "finished"
    And the broadcast includes complete winner list and seed
    And each player's screen correctly shows their own result (winner or loser)

  # ---------------------------------------------------------------------------
  # AC-H04-4b — END_GAME rejected when paths not fully revealed
  # ---------------------------------------------------------------------------
  Scenario: END_GAME rejected when not all paths are revealed
    # AC-H04-4b
    Given room status is "revealing" with 3 players and revealedCount is 1
    When host sends { type: "END_GAME" } via WebSocket
    Then host receives ERROR event with code "END_GAME_REQUIRES_ALL_REVEALED"
    And room status remains "revealing"

  # ---------------------------------------------------------------------------
  # AC-H08-1 — Play again resets room to waiting after finished
  # ---------------------------------------------------------------------------
  Scenario: Play again resets room to waiting with online players only
    # AC-H08-1
    Given room status is "finished" with 3 players (1 offline)
    When host sends { type: "PLAY_AGAIN" } via WebSocket
    Then offline players are removed from the player list
    And room status resets to "waiting" with the remaining online players
    And all remaining players receive ROOM_STATE with status "waiting"
    And kickedPlayerIds is cleared

  # ---------------------------------------------------------------------------
  # AC-H08-3 — Play again rejected when insufficient online players
  # ---------------------------------------------------------------------------
  Scenario: Play again rejected when fewer than 2 online players remain
    # AC-H08-3
    Given room status is "finished" with only 1 online player remaining
    When host sends { type: "PLAY_AGAIN" } via WebSocket
    Then host receives ERROR event with code "INSUFFICIENT_ONLINE_PLAYERS"
    And room status remains "finished"

  # ---------------------------------------------------------------------------
  # AC-H03-6 — Duplicate START_GAME rejected after game has started
  # ---------------------------------------------------------------------------
  Scenario: Duplicate START_GAME is rejected without resetting state
    # AC-H03-6
    Given room status is already "running"
    When host sends { type: "START_GAME" } again via WebSocket
    Then host receives ERROR event with code "INVALID_STATE"
    And room status remains "running"
    And seed and ladderMap are not regenerated
