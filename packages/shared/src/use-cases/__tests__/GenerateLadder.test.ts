import { describe, it, expect } from 'vitest';
import { generateLadder } from '../GenerateLadder.js';

describe('generateLadder', () => {
  describe('determinism', () => {
    it('same seedSource + N → identical ladder', () => {
      const ladder1 = generateLadder('room-test', 5);
      const ladder2 = generateLadder('room-test', 5);
      expect(ladder1).toEqual(ladder2);
    });

    it('different seedSource → different seed values', () => {
      const ladder1 = generateLadder('room-A', 5);
      const ladder2 = generateLadder('room-B', 5);
      expect(ladder1.seed).not.toBe(ladder2.seed);
    });
  });

  describe('rowCount clamping: clamp(N*3, 20, 60)', () => {
    it('N=2 → rowCount=20 (floor at 20)', () => {
      expect(generateLadder('s', 2).rowCount).toBe(20);
    });

    it('N=3 → rowCount=20 (floor at 20, 3*3=9)', () => {
      expect(generateLadder('s', 3).rowCount).toBe(20);
    });

    it('N=7 → rowCount=21 (7*3=21)', () => {
      expect(generateLadder('s', 7).rowCount).toBe(21);
    });

    it('N=10 → rowCount=30 (10*3=30)', () => {
      expect(generateLadder('s', 10).rowCount).toBe(30);
    });

    it('N=20 → rowCount=60 (20*3=60)', () => {
      expect(generateLadder('s', 20).rowCount).toBe(60);
    });

    it('N=21 → rowCount=60 (ceiling at 60, 21*3=63)', () => {
      expect(generateLadder('s', 21).rowCount).toBe(60);
    });

    it('N=50 → rowCount=60 (ceiling at 60)', () => {
      expect(generateLadder('s', 50).rowCount).toBe(60);
    });
  });

  describe('colCount', () => {
    it('colCount equals N', () => {
      expect(generateLadder('s', 2).colCount).toBe(2);
      expect(generateLadder('s', 5).colCount).toBe(5);
      expect(generateLadder('s', 10).colCount).toBe(10);
    });
  });

  describe('segment validity', () => {
    it('no two segments in the same row share col or col+1 (no overlap)', () => {
      // Test multiple seeds and sizes
      for (const N of [3, 5, 8, 10, 15]) {
        const ladder = generateLadder(`overlap-test-${N}`, N);

        const byRow = new Map<number, number[]>();
        for (const seg of ladder.segments) {
          const cols = byRow.get(seg.row) ?? [];
          cols.push(seg.col);
          byRow.set(seg.row, cols);
        }

        for (const [, cols] of byRow) {
          const usedCols = new Set<number>();
          for (const col of cols) {
            expect(usedCols.has(col)).toBe(false);
            expect(usedCols.has(col + 1)).toBe(false);
            usedCols.add(col);
            usedCols.add(col + 1);
          }
        }
      }
    });

    it('all segment rows are in [0, rowCount-1]', () => {
      const ladder = generateLadder('row-bounds-test', 8);
      for (const seg of ladder.segments) {
        expect(seg.row).toBeGreaterThanOrEqual(0);
        expect(seg.row).toBeLessThan(ladder.rowCount);
      }
    });

    it('all segment cols are in [0, colCount-2]', () => {
      const ladder = generateLadder('col-bounds-test', 8);
      for (const seg of ladder.segments) {
        expect(seg.col).toBeGreaterThanOrEqual(0);
        expect(seg.col).toBeLessThanOrEqual(ladder.colCount - 2);
      }
    });
  });

  describe('seedSource is stored', () => {
    it('seedSource matches the input string', () => {
      const ladder = generateLadder('my-seed', 5);
      expect(ladder.seedSource).toBe('my-seed');
    });
  });

  describe('N=2 randomness (bar density)', () => {
    it('N=2 bars are all at col 0 (only valid position)', () => {
      const ladder = generateLadder('dense-seed', 2);
      expect(ladder.colCount).toBe(2);
      expect(ladder.rowCount).toBe(20);
      for (const seg of ladder.segments) {
        expect(seg.col).toBe(0);
      }
    });

    it('N=2 does not fill every row — at least 20% of rows are empty', () => {
      // With ~50% bar density, in 20 rows we expect roughly 10 bars on average.
      // Across multiple seeds, the total should stay well below rowCount.
      const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      for (const seed of seeds) {
        const ladder = generateLadder(seed, 2);
        const filledRows = new Set(ladder.segments.map(s => s.row)).size;
        // Must have at least 20% empty rows (i.e., filled < 80% of rowCount)
        expect(filledRows).toBeLessThan(ladder.rowCount * 0.8);
      }
    });

    it('N=2 has some bars — at least 10% of rows are filled', () => {
      const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      for (const seed of seeds) {
        const ladder = generateLadder(seed, 2);
        const filledRows = new Set(ladder.segments.map(s => s.row)).size;
        expect(filledRows).toBeGreaterThan(ladder.rowCount * 0.1);
      }
    });
  });
});
