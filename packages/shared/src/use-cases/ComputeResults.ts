import { type LadderData, type PathStep, type ResultSlot } from '../types/index.js';
import { createMulberry32 } from '../prng/mulberry32.js';
import { fisherYatesShuffle } from '../prng/fisherYates.js';

/**
 * Trace a single player's path through the ladder starting at column `startCol`.
 * Returns the array of steps taken, ending at the final column after traversal.
 */
function tracePath(
  ladder: LadderData,
  startCol: number,
): { path: PathStep[]; endCol: number } {
  const path: PathStep[] = [];
  let col = startCol;

  // Build a fast lookup: segmentMap[row][col] = true means a bar starts at (row, col)
  // A bar at (row, col) connects col and col+1.
  const segmentMap = new Map<number, Set<number>>();
  for (const seg of ladder.segments) {
    let rowSet = segmentMap.get(seg.row);
    if (rowSet === undefined) {
      rowSet = new Set<number>();
      segmentMap.set(seg.row, rowSet);
    }
    rowSet.add(seg.col);
  }

  for (let row = 0; row < ladder.rowCount; row++) {
    const rowSegs = segmentMap.get(row);

    if (rowSegs !== undefined) {
      // Check if we're at the left end of a segment (col is the start)
      if (rowSegs.has(col)) {
        // Move right
        path.push({ row, col, direction: 'right' });
        col = col + 1;
        continue;
      }
      // Check if we're at the right end of a segment (col-1 is the start)
      if (col > 0 && rowSegs.has(col - 1)) {
        // Move left
        path.push({ row, col, direction: 'left' });
        col = col - 1;
        continue;
      }
    }

    // No horizontal movement — move down
    path.push({ row, col, direction: 'down' });
  }

  return { path, endCol: col };
}

export function computeResults(ladder: LadderData, winnerCount: number): ResultSlot[] {
  const N = ladder.colCount;
  const rng = createMulberry32(ladder.seed);

  // Shuffle [0..N-1] to determine which start column each player index gets
  const columns = Array.from({ length: N }, (_, i) => i);
  const startCols = fisherYatesShuffle(columns, rng);

  // Shuffle [0..N-1] to determine prize/end column ordering
  // endColOrder[i] is the "end destination" for the player who ends at column i
  const endCols = fisherYatesShuffle(columns, rng);

  // Trace each player's path
  // playerIndex corresponds to index in startCols
  const results: ResultSlot[] = [];

  for (let playerIndex = 0; playerIndex < N; playerIndex++) {
    const startCol = startCols[playerIndex]!;
    const { path, endCol } = tracePath(ladder, startCol);

    // The prize assignment: endCols gives us the ordered destinations.
    // endCols[endCol] is the "prize index" for the column the player ends up at.
    // isWinner if their prize index < winnerCount.
    const prizeIndex = endCols[endCol]!;
    const isWinner = prizeIndex < winnerCount;

    results.push({
      playerIndex,
      playerId: '',
      startCol,
      endCol,
      isWinner,
      path,
    });
  }

  return results;
}
