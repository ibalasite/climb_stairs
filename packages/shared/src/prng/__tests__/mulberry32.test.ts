import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../mulberry32.js';

describe('createMulberry32', () => {
  describe('determinism', () => {
    it('same seed produces identical sequence', () => {
      const rng1 = createMulberry32(42);
      const rng2 = createMulberry32(42);

      const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
    });

    it('produces exactly known values for seed=42', () => {
      const rng = createMulberry32(42);
      expect(rng()).toBeCloseTo(0.6011037519201636, 10);
      expect(rng()).toBeCloseTo(0.44829055899754167, 10);
      expect(rng()).toBeCloseTo(0.8524657934904099, 10);
    });
  });

  describe('range', () => {
    it('all values are in [0, 1)', () => {
      const rng = createMulberry32(12345);
      for (let i = 0; i < 1000; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('uniqueness', () => {
    it('consecutive calls return different values', () => {
      const rng = createMulberry32(99);
      const v1 = rng();
      const v2 = rng();
      const v3 = rng();
      expect(v1).not.toBe(v2);
      expect(v2).not.toBe(v3);
      expect(v1).not.toBe(v3);
    });
  });

  describe('edge seeds', () => {
    it('seed=0 works without errors and returns value in [0,1)', () => {
      const rng = createMulberry32(0);
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });

    it('seed=0xFFFFFFFF works without errors and returns value in [0,1)', () => {
      const rng = createMulberry32(0xffffffff);
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });

    it('seed=0 is deterministic across calls', () => {
      const rng1 = createMulberry32(0);
      const rng2 = createMulberry32(0);
      expect(rng1()).toBe(rng2());
      expect(rng1()).toBe(rng2());
    });
  });

  describe('different seeds', () => {
    it('different seeds produce different sequences', () => {
      const rng1 = createMulberry32(1);
      const rng2 = createMulberry32(2);
      expect(rng1()).not.toBe(rng2());
    });
  });
});
