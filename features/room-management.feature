Feature: Room Management
  As a player
  I want to create and join rooms
  So that I can participate in lottery activities

  # ---------------------------------------------------------------------------
  # AC-H01-1 — Create a new room successfully
  # ---------------------------------------------------------------------------
  Scenario: Create a new room with valid host nickname
    # AC-H01-1
    Given I provide a valid nickname "Alice"
    When I POST to /api/rooms with { hostNickname: "Alice", winnerCount: 1 }
    Then response status is 201
    And response contains roomCode, playerId, and token
    And roomCode matches pattern [A-HJ-NP-Z2-9]{6}
    And the room exists in Redis with TTL up to 14400 seconds

  # ---------------------------------------------------------------------------
  # AC-H01-2 — Host enters waiting lobby after room creation
  # ---------------------------------------------------------------------------
  Scenario: Host enters waiting lobby after room creation
    # AC-H01-2
    Given I have successfully created a room and received roomCode and token
    When I connect WebSocket to /ws with the host token
    Then I receive a ROOM_STATE_FULL event
    And the payload status is "waiting"
    And the player list contains only the host
    And the page includes a winner count input field

  # ---------------------------------------------------------------------------
  # AC-H01-3 — Room creation failure does not produce orphan rooms
  # ---------------------------------------------------------------------------
  Scenario: Room creation failure does not produce orphan rooms
    # AC-H01-3
    Given the backend is configured to simulate HTTP 500 error
    When I POST to /api/rooms with { hostNickname: "Alice", winnerCount: 1 }
    Then response status is 500
    And no orphan "room:{*}" key exists in Redis
    And the error message indicates creation failure

  # ---------------------------------------------------------------------------
  # AC-H01-4 — Room code collision exceeds 10 retries returns error
  # ---------------------------------------------------------------------------
  Scenario: Room code collision exceeds 10 retries returns ROOM_CODE_GENERATION_FAILED
    # AC-H01-4
    Given Redis already contains more than 10 colliding Room Codes
    When I POST to /api/rooms with { hostNickname: "Alice", winnerCount: 1 }
    Then response status is 500
    And response error code is "ROOM_CODE_GENERATION_FAILED"

  # ---------------------------------------------------------------------------
  # AC-P01-1 — Player joins existing room via WebSocket
  # ---------------------------------------------------------------------------
  Scenario: Join existing room via WebSocket
    # AC-P01-1, AC-P02-1
    Given a room with code "ABC123" exists and status is "waiting"
    When I POST to /api/rooms/ABC123/players with { nickname: "Bob" }
    Then response status is 201
    And response contains playerId and token
    When I connect WebSocket to /ws?room=ABC123 with the player token
    Then I send { type: "JOIN_ROOM", nickname: "Bob" }
    And all players receive ROOM_UPDATE message
    And the player list includes "Bob"

  # ---------------------------------------------------------------------------
  # AC-P01-7 — Room not found returns 404
  # ---------------------------------------------------------------------------
  Scenario: Room not found
    # AC-P01-7
    When I GET /api/rooms/INVALID
    Then response status is 404
    And response error code is "ROOM_NOT_FOUND"

  # ---------------------------------------------------------------------------
  # AC-P01-4 — Room is full returns ROOM_FULL error
  # ---------------------------------------------------------------------------
  Scenario: Room is full when 50 players already joined
    # AC-P01-4
    Given a room with code "ABC123" exists and already has 50 players
    When I POST to /api/rooms/ABC123/players with { nickname: "LateComer" }
    Then response status is 409
    And response error code is "ROOM_FULL"
    And the message indicates the room is full

  # ---------------------------------------------------------------------------
  # AC-P01-2 — Duplicate nickname returns NICKNAME_TAKEN error
  # ---------------------------------------------------------------------------
  Scenario: Duplicate nickname in the same room returns NICKNAME_TAKEN
    # AC-P01-2
    Given a room with code "ABC123" exists and has a player with nickname "Bob"
    When I POST to /api/rooms/ABC123/players with { nickname: "Bob" }
    Then response status is 409
    And response error code is "NICKNAME_TAKEN"
    And the message says "此暱稱已被使用，請換一個"

  # ---------------------------------------------------------------------------
  # AC-P01-8 — Cannot join room that has already started
  # ---------------------------------------------------------------------------
  Scenario: Cannot join a room that has already started
    # AC-P01-8
    Given a room with code "ABC123" exists and status is "running"
    When I POST to /api/rooms/ABC123/players with { nickname: "LateComer" }
    Then response status is 409
    And response error code is "ROOM_NOT_ACCEPTING"
    And the message indicates the game has already started
