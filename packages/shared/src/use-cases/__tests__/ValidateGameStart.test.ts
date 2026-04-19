import { describe, it, expect } from 'vitest';
import { validateGameStart } from '../ValidateGameStart.js';

describe('validateGameStart', () => {
  describe('INSUFFICIENT_PLAYERS', () => {
    it('N=1, W=null → INSUFFICIENT_PLAYERS', () => {
      const result = validateGameStart(1, null);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INSUFFICIENT_PLAYERS');
    });

    it('N=0, W=null → INSUFFICIENT_PLAYERS', () => {
      const result = validateGameStart(0, null);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INSUFFICIENT_PLAYERS');
    });
  });

  describe('PRIZES_NOT_SET', () => {
    it('N=2, W=null → PRIZES_NOT_SET', () => {
      const result = validateGameStart(2, null);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('PRIZES_NOT_SET');
    });

    it('N=10, W=null → PRIZES_NOT_SET', () => {
      const result = validateGameStart(10, null);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('PRIZES_NOT_SET');
    });
  });

  describe('INVALID_PRIZES_COUNT', () => {
    it('N=2, W=0 → INVALID_PRIZES_COUNT (too low)', () => {
      const result = validateGameStart(2, 0);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PRIZES_COUNT');
    });

    it('N=2, W=2 → INVALID_PRIZES_COUNT (must be less than playerCount)', () => {
      const result = validateGameStart(2, 2);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PRIZES_COUNT');
    });

    it('N=5, W=5 → INVALID_PRIZES_COUNT (equal to playerCount)', () => {
      const result = validateGameStart(5, 5);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PRIZES_COUNT');
    });

    it('N=5, W=6 → INVALID_PRIZES_COUNT (exceeds playerCount)', () => {
      const result = validateGameStart(5, 6);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PRIZES_COUNT');
    });

    it('N=5, W=-1 → INVALID_PRIZES_COUNT (negative)', () => {
      const result = validateGameStart(5, -1);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PRIZES_COUNT');
    });
  });

  describe('valid cases → null', () => {
    it('N=2, W=1 → null (minimum valid case)', () => {
      expect(validateGameStart(2, 1)).toBeNull();
    });

    it('N=10, W=9 → null (boundary: N-1 winners)', () => {
      expect(validateGameStart(10, 9)).toBeNull();
    });

    it('N=50, W=1 → null (large room, single winner)', () => {
      expect(validateGameStart(50, 1)).toBeNull();
    });

    it('N=5, W=3 → null (middle case)', () => {
      expect(validateGameStart(5, 3)).toBeNull();
    });
  });

  describe('error messages', () => {
    it('INSUFFICIENT_PLAYERS error message is not empty', () => {
      const result = validateGameStart(1, null);
      expect(result?.message).toBeTruthy();
      expect(typeof result?.message).toBe('string');
    });

    it('PRIZES_NOT_SET error message is not empty', () => {
      const result = validateGameStart(5, null);
      expect(result?.message).toBeTruthy();
    });

    it('INVALID_PRIZES_COUNT error message includes max allowed', () => {
      const result = validateGameStart(5, 0);
      // Should contain "4" (playerCount - 1)
      expect(result?.message).toContain('4');
    });
  });
});
