Feature: Ladder Generation
  As a system
  I want to generate deterministic and valid ladder structures using Mulberry32 PRNG
  So that all clients get identical results and outcomes cannot be predicted before reveal

  # ---------------------------------------------------------------------------
  # FR-04-1, FR-04-2 — Deterministic generation with same seed produces same ladder
  # ---------------------------------------------------------------------------
  Scenario: Deterministic generation with same seed produces identical ladders
    # FR-04-1, AC-H03-1
    Given seedSource "550e8400-e29b-41d4-a716-446655440000" and 5 players
    When ladder is generated twice using the same seedSource and N
    Then both ladders are identical (deep equality on segments, rowCount, colCount)
    And both ladders have the same rowCount
    And both ladders have the same colCount equal to the player count

  # ---------------------------------------------------------------------------
  # FR-04-3 — rowCount clamping to [20, 60]
  # ---------------------------------------------------------------------------
  Scenario Outline: rowCount is clamped to [20, 60] for all player counts
    # AC-H03-5, FR-04-3
    Given seedSource "test-seed-xyz" and <N> players
    When ladder is generated
    Then ladder rowCount equals <expected_rowCount>

    Examples:
      | N  | expected_rowCount | note                    |
      | 2  | 20                | clamp(6, 20, 60)=20     |
      | 3  | 20                | clamp(9, 20, 60)=20     |
      | 7  | 21                | clamp(21, 20, 60)=21    |
      | 10 | 30                | clamp(30, 20, 60)=30    |
      | 20 | 60                | clamp(60, 20, 60)=60    |
      | 21 | 60                | clamp(63, 20, 60)=60    |
      | 50 | 60                | clamp(150, 20, 60)=60   |

  # ---------------------------------------------------------------------------
  # FR-04-2 — Segment validity: no overlap within the same row
  # ---------------------------------------------------------------------------
  Scenario: No segments overlap within the same row
    # FR-04-2
    Given seedSource "550e8400-e29b-41d4-a716-446655440000" and 10 players
    When ladder is generated
    Then for every pair of segments in the same row (col_a, col_b)
    And |col_a - col_b| > 1 (no adjacent overlap)

  Scenario Outline: No overlapping segments for various player counts
    # FR-04-2
    Given seedSource "test-seed-abc123" and <N> players
    When ladder is generated
    Then no row contains overlapping segments

    Examples:
      | N  |
      | 2  |
      | 5  |
      | 20 |
      | 50 |

  # ---------------------------------------------------------------------------
  # FR-04-2 — Bar density: target max(1, round(N/4)) bars per row
  # ---------------------------------------------------------------------------
  Scenario Outline: Bar density target is max(1, round(N/4)) per row
    # FR-04-2
    Given seedSource "deterministic-seed-xyz" and <N> players
    When ladder is generated
    Then the average bars per row approaches <target_density>
    And each bar attempt does not exceed N*10 retries

    Examples:
      | N  | target_density |
      | 2  | 1              |
      | 4  | 1              |
      | 8  | 2              |
      | 12 | 3              |
      | 20 | 5              |

  # ---------------------------------------------------------------------------
  # FR-04-4 — Bijection: N players produce N unique endCol values
  # ---------------------------------------------------------------------------
  Scenario: Result bijection ensures N unique endCol values for N players
    # FR-04-4
    Given seedSource "550e8400-e29b-41d4-a716-446655440000" and 8 players with winnerCount 3
    When ladder is generated and results are computed
    Then resultSlots array length equals 8
    And all endCol values are unique (no duplicates, covering 0 to 7)
    And the number of isWinner=true results equals 3
    And the number of isWinner=false results equals 5

  Scenario Outline: Bijection holds for various N and winnerCount combinations
    # FR-04-4
    Given seedSource "deterministic-seed-xyz" and <N> players with winnerCount <W>
    When ladder is generated and results are computed
    Then resultSlots array length equals <N>
    And all endCol values are unique
    And isWinner=true count equals <W>

    Examples:
      | N  | W  |
      | 2  | 1  |
      | 5  | 2  |
      | 10 | 3  |
      | 50 | 10 |

  # ---------------------------------------------------------------------------
  # FR-04-4 — 1000-seed automated bijection validation
  # ---------------------------------------------------------------------------
  Scenario: 1000 random seeds all satisfy bijection property
    # FR-04-4, NFR-03
    Given 1000 randomly generated seedSource values with N=10 and winnerCount=3
    When ladder and results are computed for each seed
    Then all 1000 results satisfy bijection (all endCol values unique)
    And no result has more or fewer than N entries

  # ---------------------------------------------------------------------------
  # FR-04-6 — Seed not exposed to clients before finished state
  # ---------------------------------------------------------------------------
  Scenario: Seed is not transmitted to clients before room status is finished
    # FR-04-6
    Given a room is in "revealing" status with ladder generated
    When a client receives ROOM_STATE or ROOM_STATE_FULL
    Then the payload does NOT contain the seed field
    And the payload does NOT contain the seedSource field

  Scenario: Seed is transmitted to clients when room status becomes finished
    # FR-04-6, AC-H04-4
    Given a room transitions to "finished" status
    When all clients receive ROOM_STATE broadcast
    Then the payload contains the seed field
    And the payload contains the complete results array
