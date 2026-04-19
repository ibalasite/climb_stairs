import { describe, it, expect } from 'vitest';
import { djb2 } from '../djb2.js';

describe('djb2', () => {
  describe('known input → known output', () => {
    it('returns 5381 for empty string', () => {
      expect(djb2('')).toBe(5381);
    });

    it('returns 261238937 for "hello"', () => {
      expect(djb2('hello')).toBe(261238937);
    });

    it('returns 2090756197 for "test"', () => {
      expect(djb2('test')).toBe(2090756197);
    });

    it('returns 193485963 for "abc"', () => {
      expect(djb2('abc')).toBe(193485963);
    });
  });

  describe('returns unsigned 32-bit integer', () => {
    it('result is always >= 0', () => {
      expect(djb2('')).toBeGreaterThanOrEqual(0);
      expect(djb2('hello')).toBeGreaterThanOrEqual(0);
      expect(djb2('test')).toBeGreaterThanOrEqual(0);
    });

    it('result is always <= 0xFFFFFFFF', () => {
      expect(djb2('')).toBeLessThanOrEqual(0xffffffff);
      expect(djb2('hello')).toBeLessThanOrEqual(0xffffffff);
      expect(djb2('test')).toBeLessThanOrEqual(0xffffffff);
    });

    it('result is always an integer', () => {
      expect(Number.isInteger(djb2(''))).toBe(true);
      expect(Number.isInteger(djb2('hello'))).toBe(true);
      expect(Number.isInteger(djb2('room-abc'))).toBe(true);
    });
  });

  describe('determinism', () => {
    it('same input always returns same output', () => {
      expect(djb2('ladder-room')).toBe(djb2('ladder-room'));
      expect(djb2('hello world')).toBe(djb2('hello world'));
      expect(djb2('12345')).toBe(djb2('12345'));
    });
  });

  describe('collision resistance', () => {
    it('different inputs produce different outputs (at least 3 distinct pairs)', () => {
      expect(djb2('hello')).not.toBe(djb2('world'));
      expect(djb2('abc')).not.toBe(djb2('xyz'));
      expect(djb2('test1')).not.toBe(djb2('test2'));
    });

    it('single character differences produce different hashes', () => {
      expect(djb2('a')).not.toBe(djb2('b'));
      expect(djb2('room-A')).not.toBe(djb2('room-B'));
    });
  });
});
