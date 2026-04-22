Feature: WebSocket Protocol
  As a player or host
  I want reliable WebSocket communication with the server
  So that I can participate in real-time room events without losing state

  # ---------------------------------------------------------------------------
  # FR-03-1, FR-03-2 — Connection and join flow
  # ---------------------------------------------------------------------------
  Scenario: Player connects and receives initial room state
    # FR-03-1, AC-P01-1
    Given a room with code "WS0001" exists and status is "waiting"
    And a player has obtained a token via POST /api/rooms/WS0001/players
    When the player connects WebSocket to /ws?room=WS0001&token={token}
    Then the server sends ROOM_STATE_FULL unicast to the player
    And ROOM_STATE_FULL payload contains status, players, selfPlayerId, ladder (null), and results (null)
    And the WebSocket connection is established within 1.5 seconds

  Scenario: Host connects and receives host-specific room state
    # FR-03-1, AC-H01-2
    Given a host has created a room and obtained a host token
    When the host connects WebSocket to /ws?room={roomCode}&token={hostToken}
    Then the server sends ROOM_STATE_FULL unicast to the host
    And ROOM_STATE_FULL payload status is "waiting"
    And the host can issue host-only messages (START_GAME, BEGIN_REVEAL, etc.)

  # ---------------------------------------------------------------------------
  # FR-03-3 — WebSocket message envelope format validation
  # ---------------------------------------------------------------------------
  Scenario: Server sends messages in correct envelope format
    # FR-03-3
    Given a player is connected to a room
    When any server event is broadcast
    Then the message JSON contains "type", "ts", and "payload" fields
    And "ts" is a Unix milliseconds timestamp

  Scenario: Client sends messages in correct envelope format
    # FR-03-3
    Given a host is connected to a room in "waiting" status
    When the host sends { type: "START_GAME", ts: 1745050000000, payload: {} }
    Then the server processes the message without error
    And the server responds or broadcasts within 1 second

  # ---------------------------------------------------------------------------
  # FR-03-4 — Error events include machine-readable code and human-readable message
  # ---------------------------------------------------------------------------
  Scenario: Error events include code and message fields
    # FR-03-4
    Given a player (not host) is connected to a room
    When the player sends a host-only message { type: "START_GAME", ts: 1745050000000, payload: {} }
    Then the server sends ERROR unicast to the player
    And the ERROR payload contains "code" field (e.g. "PLAYER_NOT_HOST")
    And the ERROR payload contains "message" field with human-readable description
    And the WebSocket connection remains open

  # ---------------------------------------------------------------------------
  # FR-03-5 — WebSocket message size limit 64KB
  # ---------------------------------------------------------------------------
  Scenario: Server rejects oversized WebSocket messages
    # FR-03-5
    Given a player is connected to a room
    When the player sends a WebSocket message exceeding 64KB
    Then the server rejects the message and closes the connection

  # ---------------------------------------------------------------------------
  # AC-P05-2, FR-10-4 — Disconnect handling: player offline status broadcast
  # ---------------------------------------------------------------------------
  Scenario: Disconnect handling updates player online status
    # AC-P02-2, FR-10-1
    Given a room "WS0001" has players "Alice" and "Bob" both online
    When "Bob"'s WebSocket connection is closed (TCP close or ping timeout)
    Then the server detects the disconnect within 30 seconds
    And the server broadcasts ROOM_STATE to all remaining players
    And ROOM_STATE payload shows "Bob" with isOnline=false
    And "Bob"'s slot and path are preserved (not removed from player list)

  # ---------------------------------------------------------------------------
  # FR-10-3 — Session replacement when same playerId reconnects from new device
  # ---------------------------------------------------------------------------
  Scenario: Session is replaced when same playerId connects from a new device
    # FR-10-3, AC-RECONNECT-005
    Given player "Dave" (playerId="player-dave-uuid") is connected via device A
    And room "WS0001" status is "waiting"
    When "Dave" connects from device B using the same playerId
    Then device A receives SESSION_REPLACED unicast event
    And device A's WebSocket connection is closed
    And device B receives ROOM_STATE_FULL with complete room state
    And "Dave"'s isOnline is updated to true for device B's connection

  # ---------------------------------------------------------------------------
  # AC-P05-1 — Reconnect restores complete state
  # ---------------------------------------------------------------------------
  Scenario: Reconnect restores player state with full room snapshot
    # AC-P05-1, FR-10-1
    Given player "Carol" (playerId="player-carol-uuid") has disconnected from room "WS0001"
    And "Carol"'s localStorage contains the playerId
    When "Carol" reconnects using the same token
    Then the server sends ROOM_STATE_FULL unicast to "Carol"
    And ROOM_STATE_FULL contains complete room state (status, players, ladder, results, selfPlayerId)
    And "Carol"'s isOnline is restored to true in the broadcast ROOM_STATE
    And reconnect completes within 3 seconds

  Scenario: Reconnect during revealing state returns static snapshot without replaying animations
    # AC-P05-2, FR-10-4
    Given room "WS0001" is in "revealing" status with revealedCount=3
    And player "Eve" has disconnected during revealing
    When "Eve" reconnects to the room
    Then the server sends ROOM_STATE_FULL with revealedCount=3 and current results
    And the client renders already-revealed paths as static results
    And no animations are replayed for previously revealed paths

  # ---------------------------------------------------------------------------
  # FR-03-4 — Heartbeat: server sends PING every 30 seconds
  # ---------------------------------------------------------------------------
  Scenario: Heartbeat keeps connection alive with PING/PONG exchange
    # FR-03-1 (Heartbeat)
    Given a player is connected to a room
    When 30 seconds pass without activity
    Then the server sends a WebSocket protocol-level PING frame
    And the client responds with a PONG frame
    And the connection remains open

  Scenario: Server closes connection when client does not respond to PING
    # FR-03-1 (Heartbeat timeout)
    Given a player is connected to a room
    When the server sends a PING frame and the client does NOT respond within 30 seconds
    Then the server closes the connection with close code 1001

  # ---------------------------------------------------------------------------
  # FR-03-4 — Application-level PING/PONG for RTT measurement
  # ---------------------------------------------------------------------------
  Scenario: Application-level PING returns PONG with echo timestamp
    # FR-03-3, §3.4
    Given a player is connected to a room
    When the player sends { type: "PING", ts: 1745049600000, payload: {} }
    Then the server responds with { type: "PONG", payload: { ts: 1745049600000 } }
    And the response ts echoes the original PING ts for RTT measurement

  # ---------------------------------------------------------------------------
  # FR-11-1, FR-11-4 — Player kicked event flow
  # ---------------------------------------------------------------------------
  Scenario: Kicked player receives PLAYER_KICKED and connection closes
    # AC-H07-1, FR-11-4
    Given room "WS0001" is in "waiting" status
    And player "Frank" (playerId="player-frank-uuid") is connected
    When the host sends KICK_PLAYER targeting "player-frank-uuid"
    Then the server sends PLAYER_KICKED unicast to "Frank"
    And "Frank"'s WebSocket connection is closed with close code 4003
    And all other players receive updated ROOM_STATE without "Frank"

  Scenario: Kicked player is blocked from reconnecting with same playerId
    # AC-H07-2, FR-11-2
    Given player "Grace" has been kicked from room "WS0001"
    When "Grace" attempts to reconnect using the same playerId
    Then the server sends PLAYER_KICKED and closes connection with close code 4003
    And "Grace" cannot rejoin the same game session

  # ---------------------------------------------------------------------------
  # §3.2 — WebSocket upgrade validation rejects unauthorized connections
  # ---------------------------------------------------------------------------
  Scenario: WebSocket upgrade is rejected with invalid token
    # §3.2, NFR-05
    Given a room with code "WS0001" exists
    When a client attempts to connect WebSocket with an invalid JWT token
    Then the WebSocket upgrade is rejected with HTTP 401
    And no WebSocket connection is established

  Scenario: WebSocket upgrade is rejected for kicked player
    # §3.2, FR-11-2
    Given a player has been kicked from room "WS0001" (playerId in kickedPlayerIds)
    When the kicked player attempts to connect WebSocket to the room
    Then the server sends PLAYER_KICKED and closes the connection with close code 4003
