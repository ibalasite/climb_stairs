import { type LadderData, type LadderSegment } from '../types/index.js';
import { djb2 } from '../prng/djb2.js';
import { createMulberry32 } from '../prng/mulberry32.js';

export function generateLadder(seedSource: string, N: number): LadderData {
  const seed = djb2(seedSource);
  const rng = createMulberry32(seed);

  const rowCount = Math.min(Math.max(N * 3, 20), 60);
  const colCount = N;
  const maxBarsPerRow = Math.max(1, Math.round(N / 4));

  const segments: LadderSegment[] = [];

  for (let row = 0; row < rowCount; row++) {
    // Track which columns are occupied in this row.
    // A segment at col occupies both col and col+1.
    const usedCols = new Set<number>();

    let barsPlaced = 0;

    for (let attempt = 0; attempt < maxBarsPerRow; attempt++) {
      // Pick a random starting column in [0, N-2]
      let col = Math.floor(rng() * (N - 1));

      // Retry: linear scan up to N attempts to find a free column
      let found = false;
      for (let retry = 0; retry < N - 1; retry++) {
        const candidate = (col + retry) % (N - 1);
        if (!usedCols.has(candidate) && !usedCols.has(candidate + 1)) {
          col = candidate;
          found = true;
          break;
        }
      }

      if (!found) break;

      usedCols.add(col);
      usedCols.add(col + 1);
      segments.push({ row, col });
      barsPlaced++;

      if (barsPlaced >= maxBarsPerRow) break;
    }
  }

  return {
    seed,
    seedSource,
    rowCount,
    colCount,
    segments,
  };
}
