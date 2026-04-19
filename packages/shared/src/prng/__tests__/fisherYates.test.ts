import { describe, it, expect } from 'vitest';
import { fisherYatesShuffle } from '../fisherYates.js';
import { createMulberry32 } from '../mulberry32.js';

describe('fisherYatesShuffle', () => {
  const rng = () => createMulberry32(42);

  describe('length preservation', () => {
    it('output has the same length as input', () => {
      const input = [1, 2, 3, 4, 5];
      const result = fisherYatesShuffle(input, rng());
      expect(result).toHaveLength(input.length);
    });

    it('length is preserved for arrays of various sizes', () => {
      expect(fisherYatesShuffle([1, 2], rng())).toHaveLength(2);
      expect(fisherYatesShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rng())).toHaveLength(10);
    });
  });

  describe('element preservation', () => {
    it('output contains the same elements as input (no loss or duplication)', () => {
      const input = [10, 20, 30, 40, 50];
      const result = fisherYatesShuffle(input, rng());
      expect(result.slice().sort((a, b) => a - b)).toEqual(input.slice().sort((a, b) => a - b));
    });

    it('output contains all elements exactly once', () => {
      const input = [1, 2, 3, 4, 5, 6];
      const result = fisherYatesShuffle(input, rng());
      const inputSet = new Set(input);
      const resultSet = new Set(result);
      expect(resultSet.size).toBe(inputSet.size);
      for (const el of input) {
        expect(resultSet.has(el)).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('empty array returns empty array', () => {
      const result = fisherYatesShuffle([], rng());
      expect(result).toEqual([]);
    });

    it('single element array returns array with same element', () => {
      const result = fisherYatesShuffle([42], rng());
      expect(result).toEqual([42]);
    });
  });

  describe('large arrays', () => {
    it('large array (1000 items) preserves all elements', () => {
      const input = Array.from({ length: 1000 }, (_, i) => i);
      const result = fisherYatesShuffle(input, rng());

      expect(result).toHaveLength(1000);

      const resultSorted = result.slice().sort((a, b) => a - b);
      const inputSorted = input.slice().sort((a, b) => a - b);
      expect(resultSorted).toEqual(inputSorted);
    });
  });

  describe('immutability', () => {
    it('does not mutate the original array', () => {
      const input = [1, 2, 3, 4, 5];
      const inputCopy = [...input];
      fisherYatesShuffle(input, rng());
      expect(input).toEqual(inputCopy);
    });
  });

  describe('determinism', () => {
    it('same rng produces same shuffle', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const result1 = fisherYatesShuffle(input, createMulberry32(777));
      const result2 = fisherYatesShuffle(input, createMulberry32(777));
      expect(result1).toEqual(result2);
    });
  });
});
