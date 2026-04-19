# features/prng.feature
Feature: PRNG 確定性與正確性
  As a 系統
  I want to 以 Mulberry32+djb2 確定性算法生成樓梯結構
  So that 相同輸入恆得相同輸出，確保所有客戶端 100% 結果一致且無法舞弊

  # ---------------------------------------------------------------------------
  # 確定性（Determinism）— 相同 seed+N 兩次呼叫完全一致
  # ---------------------------------------------------------------------------
  @AC-PRNG-001 @P0
  Scenario: 相同 seed 和 N 生成完全相同的樓梯結構（快照測試）
    Given seedSource 為固定字串 "550e8400-e29b-41d4-a716-446655440000"
    And N=5（玩家數）
    When 以相同 seedSource 和 N 兩次呼叫 generateLadder
    Then 第一次和第二次呼叫的 LadderData.segments 完全相等（深度比較）
    And 兩次呼叫的 rowCount 相同
    And 兩次呼叫的 colCount 相同

  # ---------------------------------------------------------------------------
  # 無重疊橫槓（Non-overlapping segments）
  # ---------------------------------------------------------------------------
  @AC-PRNG-002 @P0
  Scenario: 同一 row 中不存在重疊的橫槓
    Given seedSource 為 "550e8400-e29b-41d4-a716-446655440000"，N=10
    When 呼叫 generateLadder 生成 LadderData
    Then 對於 LadderData.segments 中所有 row 相同的橫槓對（col_a, col_b）
    And 不存在任何兩條橫槓使得 |col_a - col_b| <= 1（即不衝突）

  @AC-PRNG-003 @P0
  Scenario Outline: 多種 N 值下同一 row 均無重疊橫槓
    Given seedSource 為 "test-seed-abc123"，N=<N>
    When 呼叫 generateLadder 生成 LadderData
    Then 所有 row 中均不存在重疊橫槓

    Examples:
      | N  |
      | 2  |
      | 5  |
      | 20 |
      | 50 |

  # ---------------------------------------------------------------------------
  # rowCount 精確符合 clamp(N*3, 20, 60)
  # ---------------------------------------------------------------------------
  @AC-PRNG-004 @P0
  Scenario Outline: rowCount 精確符合 clamp(N*3, 20, 60) 公式
    Given seedSource 為任意有效字串，N=<N>
    When 呼叫 generateLadder 生成 LadderData
    Then LadderData.rowCount 恰好等於 <expected_rowCount>

    Examples:
      | N  | expected_rowCount | 說明                  |
      | 2  | 20                | clamp(6,20,60)=20    |
      | 3  | 20                | clamp(9,20,60)=20    |
      | 10 | 30                | clamp(30,20,60)=30   |
      | 20 | 60                | clamp(60,20,60)=60   |
      | 21 | 60                | clamp(63,20,60)=60   |
      | 50 | 60                | clamp(150,20,60)=60  |

  # ---------------------------------------------------------------------------
  # 結果雙射（Bijection）— N 個起點對應 N 個唯一終點
  # ---------------------------------------------------------------------------
  @AC-PRNG-005 @P0
  Scenario: 結果雙射：N 個玩家對應 N 個唯一 endCol 值
    Given seedSource 為 "550e8400-e29b-41d4-a716-446655440000"，N=8，winnerCount=3
    When 呼叫 generateLadder 後再呼叫 computeResults 生成 ResultSlot[]
    Then ResultSlot 陣列長度恰好為 8
    And 所有 ResultSlot 的 endCol 值兩兩不相同（無重複，完整覆蓋 0～7）

  @AC-PRNG-006 @P0
  Scenario: 結果雙射：isWinner=true 的數量恰好等於 winnerCount
    Given seedSource 為 "550e8400-e29b-41d4-a716-446655440000"，N=8，winnerCount=3
    When 呼叫 generateLadder 後再呼叫 computeResults 生成 ResultSlot[]
    Then ResultSlot 中 isWinner=true 的數量恰好為 3
    And ResultSlot 中 isWinner=false 的數量恰好為 5

  @AC-PRNG-007 @P0
  Scenario Outline: 多種 N 和 winnerCount 組合均滿足雙射特性
    Given seedSource 為 "deterministic-seed-xyz"，N=<N>，winnerCount=<W>
    When 呼叫 generateLadder 後再呼叫 computeResults
    Then ResultSlot 陣列長度為 <N>
    And 所有 endCol 值唯一（無重複）
    And isWinner=true 的數量等於 <W>

    Examples:
      | N  | W  |
      | 2  | 1  |
      | 5  | 2  |
      | 10 | 3  |
      | 50 | 10 |
