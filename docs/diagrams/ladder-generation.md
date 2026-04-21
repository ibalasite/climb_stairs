# Ladder Generation Algorithm

> 生成自 devsop-autodev STEP 13

```mermaid
flowchart TD
    Start([開始: generateLadder]) --> Input["輸入: seedSource: string, N: number"]

    Input --> Hash["seed = djb2(seedSource) >>> 0\n將 UUID v4 字串 hash 為 uint32"]
    Hash --> RNG["rng = createMulberry32(seed)\n建立確定性 PRNG"]

    RNG --> Params["colCount = N\nrowCount = clamp(N×3, 20, 60)\nmaxBarsPerRow = max(1, round(N/4))"]

    Params --> Density{"possiblePositions = N - 1"}
    Density -->|"=1"| D1["barDensity = 0.50"]
    Density -->|"=2"| D2["barDensity = 0.65"]
    Density -->|"=3"| D3["barDensity = 0.75"]
    Density -->|">=4"| D4["barDensity = 0.90"]

    D1 & D2 & D3 & D4 --> RowLoop["for row = 0 to rowCount-1"]

    RowLoop --> SkipRow{"rng() > barDensity?"}
    SkipRow -->|"Yes: 跳過此行"| NextRow
    SkipRow -->|"No: 生成橫槓"| InitUsed["usedCols = new Set\nbarsPlaced = 0"]

    InitUsed --> AttemptLoop["for attempt = 0 to maxBarsPerRow-1"]

    AttemptLoop --> PickCol["col = floor(rng() × (N-1))"]

    PickCol --> Retry["線性掃描 retry 0 to N-2\n尋找無衝突 candidate\n條件: !usedCols.has(col) AND\n      !usedCols.has(col+1)"]

    Retry --> Found{"找到無衝突位置?"}
    Found -->|"No: break"| CheckMax
    Found -->|"Yes"| AddSeg["usedCols.add(col)\nusedCols.add(col+1)\nsegments.push({ row, col })\nbarsPlaced++"]

    AddSeg --> CheckMax{"barsPlaced >= maxBarsPerRow?"}
    CheckMax -->|"Yes: break"| NextRow
    CheckMax -->|"No"| AttemptLoop

    NextRow{"row < rowCount?"} -->|"Yes"| RowLoop
    NextRow -->|"No"| Output

    Output(["return { seed, seedSource, rowCount, colCount, segments }"])
```

## 說明

梯子生成算法基於確定性 PRNG（djb2 + Mulberry32），確保相同 seedSource 與玩家數 N 必然產生完全一致的梯子結構。barDensity 依照可用位置數（N-1）動態調整（N=2 時僅 50% 密度，避免所有行皆相同），usedCols 碰撞檢測確保同一行內橫槓不重疊，最多重試 N-1 次以尋找有效位置。
