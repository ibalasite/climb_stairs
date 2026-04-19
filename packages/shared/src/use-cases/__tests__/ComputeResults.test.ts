import { describe, it, expect } from 'vitest';
import { computeResults } from '../ComputeResults.js';
import { generateLadder } from '../GenerateLadder.js';
import type { LadderData } from '../../types/index.js';

/** Minimal ladder with no segments for deterministic path testing */
function makeFlatLadder(N: number, seedSource: string): LadderData {
  return generateLadder(seedSource, N);
}

describe('computeResults', () => {
  describe('determinism', () => {
    it('same ladder + winnerCount → identical results', () => {
      const ladder = makeFlatLadder(5, 'determinism-test');
      const r1 = computeResults(ladder, 2);
      const r2 = computeResults(ladder, 2);
      expect(r1).toEqual(r2);
    });

    it('same ladder + different winnerCount → same paths but different isWinner', () => {
      const ladder = makeFlatLadder(4, 'winner-test');
      const r1 = computeResults(ladder, 1);
      const r2 = computeResults(ladder, 2);

      // Same endCols (paths are the same)
      const endCols1 = r1.map((s) => s.endCol);
      const endCols2 = r2.map((s) => s.endCol);
      expect(endCols1).toEqual(endCols2);

      // But winner counts differ
      const winners1 = r1.filter((s) => s.isWinner).length;
      const winners2 = r2.filter((s) => s.isWinner).length;
      expect(winners1).toBe(1);
      expect(winners2).toBe(2);
    });
  });

  describe('completeness', () => {
    it('all N players have a result slot', () => {
      const N = 6;
      const ladder = makeFlatLadder(N, 'completeness-test');
      const results = computeResults(ladder, 2);
      expect(results).toHaveLength(N);
    });

    it('playerIndex values cover 0..N-1 exactly once', () => {
      const N = 5;
      const ladder = makeFlatLadder(N, 'player-index-test');
      const results = computeResults(ladder, 2);
      const indices = results.map((r) => r.playerIndex).sort((a, b) => a - b);
      expect(indices).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('bijection property', () => {
    it('all endCol values are unique (bijection)', () => {
      const N = 5;
      const ladder = makeFlatLadder(N, 'bijection-test');
      const results = computeResults(ladder, 2);
      const endCols = results.map((r) => r.endCol);
      const uniqueEndCols = new Set(endCols);
      expect(uniqueEndCols.size).toBe(N);
    });

    it('endCols cover exactly 0..N-1', () => {
      const N = 6;
      const ladder = makeFlatLadder(N, 'bijection-range-test');
      const results = computeResults(ladder, 3);
      const endCols = results.map((r) => r.endCol).sort((a, b) => a - b);
      expect(endCols).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  describe('winner count', () => {
    it('exactly winnerCount results have isWinner=true', () => {
      for (const winnerCount of [1, 2, 3]) {
        const ladder = makeFlatLadder(5, 'winner-count-test');
        const results = computeResults(ladder, winnerCount);
        const winners = results.filter((r) => r.isWinner).length;
        expect(winners).toBe(winnerCount);
      }
    });

    it('winnerCount=1 with N=10 has exactly 1 winner', () => {
      const ladder = makeFlatLadder(10, 'single-winner');
      const results = computeResults(ladder, 1);
      expect(results.filter((r) => r.isWinner)).toHaveLength(1);
    });

    it('winnerCount=N-1 has exactly N-1 winners', () => {
      const N = 5;
      const ladder = makeFlatLadder(N, 'most-winners');
      const results = computeResults(ladder, N - 1);
      expect(results.filter((r) => r.isWinner)).toHaveLength(N - 1);
    });
  });

  describe('path structure', () => {
    it('each path has exactly rowCount steps', () => {
      const ladder = makeFlatLadder(4, 'path-length-test');
      const results = computeResults(ladder, 1);
      for (const result of results) {
        expect(result.path).toHaveLength(ladder.rowCount);
      }
    });

    it('path[0].direction is "down" when row 0 has no segment at startCol', () => {
      // Use a ladder with no segments to guarantee the first step is always "down"
      const emptyLadder: LadderData = {
        seed: 42,
        seedSource: 'empty',
        rowCount: 10,
        colCount: 3,
        segments: [],
      };
      const results = computeResults(emptyLadder, 1);
      for (const result of results) {
        expect(result.path[0]?.direction).toBe('down');
      }
    });

    it('path starts at startCol', () => {
      const ladder = makeFlatLadder(5, 'start-col-test');
      const results = computeResults(ladder, 2);
      for (const result of results) {
        expect(result.path[0]?.col).toBe(result.startCol);
      }
    });

    it('final column in path matches endCol after traversal', () => {
      // On a flat ladder (no segments), player stays in startCol
      const emptyLadder: LadderData = {
        seed: 99,
        seedSource: 'flat',
        rowCount: 5,
        colCount: 4,
        segments: [],
      };
      const results = computeResults(emptyLadder, 1);
      for (const result of results) {
        // With no segments, startCol === endCol
        expect(result.startCol).toBe(result.endCol);
        // Last path step should be at endCol
        const lastStep = result.path[result.path.length - 1];
        expect(lastStep?.col).toBe(result.endCol);
      }
    });

    it('path steps are always within valid column bounds', () => {
      const ladder = makeFlatLadder(6, 'bounds-test');
      const results = computeResults(ladder, 2);
      for (const result of results) {
        for (const step of result.path) {
          expect(step.col).toBeGreaterThanOrEqual(0);
          expect(step.col).toBeLessThan(ladder.colCount);
        }
      }
    });

    it('path directions are only "down", "left", or "right"', () => {
      const ladder = makeFlatLadder(5, 'direction-test');
      const results = computeResults(ladder, 2);
      const validDirections = new Set(['down', 'left', 'right']);
      for (const result of results) {
        for (const step of result.path) {
          expect(validDirections.has(step.direction)).toBe(true);
        }
      }
    });
  });

  describe('startCol assignment', () => {
    it('all startCol values are unique (bijection)', () => {
      const N = 5;
      const ladder = makeFlatLadder(N, 'start-unique-test');
      const results = computeResults(ladder, 2);
      const startCols = results.map((r) => r.startCol);
      const uniqueStartCols = new Set(startCols);
      expect(uniqueStartCols.size).toBe(N);
    });
  });

  // ---------------------------------------------------------------------------
  // NFR-03 — Bijection property: every player mapped to exactly one outcome
  // across 100 distinct seed sources.
  // ---------------------------------------------------------------------------
  describe('bijection property over 100 seeds (NFR-03)', () => {
    it('produces a bijection (every player mapped to exactly one outcome) over 100 seeds', () => {
      const playerCount = 5;
      const winnerCount = 2;

      for (let seed = 1; seed <= 100; seed++) {
        const ladder = generateLadder(`nfr03-bijection-seed-${seed}`, playerCount);
        const results = computeResults(ladder, winnerCount);

        // Every playerIndex must appear exactly once
        const playerIndices = results.map((r) => r.playerIndex);
        expect(new Set(playerIndices).size).toBe(playerCount);
        expect(playerIndices).toHaveLength(playerCount);

        // Exactly winnerCount winners
        const winners = results.filter((r) => r.isWinner);
        expect(winners).toHaveLength(winnerCount);

        // endCols must also be a bijection (each column claimed by exactly one player)
        const endCols = results.map((r) => r.endCol);
        expect(new Set(endCols).size).toBe(playerCount);
      }
    });
  });
});
