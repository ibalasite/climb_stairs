/**
 * Unit tests for LocalStorageService.
 *
 * The test environment is Node (no browser globals), so we inject a minimal
 * in-memory localStorage stub before importing the module under test.
 * This keeps the test free of jsdom / happy-dom dependencies while still
 * covering the real implementation logic.
 *
 * AC covered: FR-08-1, FR-08-2, FR-08-3, FR-08-4, FR-10-1, AC-P01-6, AC-P06-1
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ─── In-memory localStorage stub ─────────────────────────────────────────────

class LocalStorageStub {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Install stub before module is loaded
const stub = new LocalStorageStub();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = stub;

// ─── Import after stub is installed ──────────────────────────────────────────

// Dynamic import so the module sees our globalThis.localStorage stub.
const { LocalStorageService } = await import('../state/LocalStorageService.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LocalStorageService', () => {
  beforeEach(() => {
    stub.clear();
  });

  // ── Nickname ──────────────────────────────────────────────────────────────

  describe('setNickname / getNickname', () => {
    it('saveNickname — writes to ladder_last_nickname key (FR-08-1, AC-P01-6)', () => {
      LocalStorageService.setNickname('Alice');
      expect(stub.getItem('ladder_last_nickname')).toBe('Alice');
    });

    it('loadNickname — returns previously saved nickname (FR-08-2)', () => {
      stub.setItem('ladder_last_nickname', 'Bob');
      expect(LocalStorageService.getNickname()).toBe('Bob');
    });

    it('loadNickname — returns empty string when no nickname stored (FR-08-2)', () => {
      // stub is cleared in beforeEach
      expect(LocalStorageService.getNickname()).toBe('');
    });

    it('overwrites previous nickname on second setNickname call', () => {
      LocalStorageService.setNickname('Alice');
      LocalStorageService.setNickname('Carol');
      expect(LocalStorageService.getNickname()).toBe('Carol');
    });
  });

  // ── PlayerId ──────────────────────────────────────────────────────────────

  describe('setPlayerId / getPlayerId / clearPlayerId', () => {
    it('savePlayerId — stores the given playerId (FR-08-3)', () => {
      LocalStorageService.setPlayerId('abc123');
      expect(stub.getItem('playerId')).toBe('abc123');
    });

    it('loadPlayerId — returns stored playerId (FR-10-1)', () => {
      stub.setItem('playerId', 'xyz-uuid');
      expect(LocalStorageService.getPlayerId()).toBe('xyz-uuid');
    });

    it('loadPlayerId — returns empty string when no playerId stored (FR-10-1)', () => {
      expect(LocalStorageService.getPlayerId()).toBe('');
    });

    it('clearPlayerId — removes playerId from storage (FR-08-4, AC-P06-1)', () => {
      stub.setItem('playerId', 'to-be-removed');
      LocalStorageService.clearPlayerId();
      expect(stub.getItem('playerId')).toBeNull();
    });

    it('clearPlayerId — idempotent when playerId is not set', () => {
      // Should not throw when key is absent
      expect(() => LocalStorageService.clearPlayerId()).not.toThrow();
      expect(LocalStorageService.getPlayerId()).toBe('');
    });
  });
});
