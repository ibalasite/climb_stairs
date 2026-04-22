/**
 * Unit tests for src/state/store.ts
 *
 * Covers:
 * - setState: partial state updates
 * - setRenderer: wires render callback
 * - resetState: restores initial state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Dynamic import ensures the module is loaded fresh in this test context
const { state, setState, setRenderer, resetState } = await import('../state/store.js');

describe('store', () => {
  beforeEach(() => {
    // Restore initial state before each test
    resetState();
  });

  // ── setState ──────────────────────────────────────────────────────────────

  describe('setState', () => {
    it('updates a single field without touching others', () => {
      setState({ myPlayerId: 'player-42' });

      expect(state.myPlayerId).toBe('player-42');
      expect(state.view).toBe('lobby'); // untouched
    });

    it('applies multiple partial fields at once', () => {
      setState({ view: 'waiting', myToken: 'tok-xyz' });

      expect(state.view).toBe('waiting');
      expect(state.myToken).toBe('tok-xyz');
    });
  });

  // ── setRenderer ──────────────────────────────────────────────────────────

  describe('setRenderer', () => {
    it('calls the registered render function on setState', () => {
      const renderFn = vi.fn();
      setRenderer(renderFn);

      setState({ myPlayerId: 'p1' });

      expect(renderFn).toHaveBeenCalledOnce();
    });

    it('calls the render function on resetState', () => {
      const renderFn = vi.fn();
      setRenderer(renderFn);

      resetState();

      expect(renderFn).toHaveBeenCalled();
    });

    it('replacing the renderer unregisters the old one', () => {
      const oldRenderer = vi.fn();
      const newRenderer = vi.fn();

      setRenderer(oldRenderer);
      setRenderer(newRenderer);

      setState({ myPlayerId: 'p2' });

      expect(oldRenderer).not.toHaveBeenCalled();
      expect(newRenderer).toHaveBeenCalled();
    });
  });

  // ── resetState ────────────────────────────────────────────────────────────

  describe('resetState', () => {
    it('restores view to lobby', () => {
      setState({ view: 'game' });
      resetState();

      expect(state.view).toBe('lobby');
    });

    it('clears myPlayerId', () => {
      setState({ myPlayerId: 'player-99' });
      resetState();

      expect(state.myPlayerId).toBeNull();
    });

    it('clears myToken', () => {
      setState({ myToken: 'some-token' });
      resetState();

      expect(state.myToken).toBeNull();
    });

    it('clears room', () => {
      setState({
        room: {
          code: 'ABCD12',
          status: 'waiting',
          hostId: 'player-1',
          players: [],
          winnerCount: 1,
          ladder: null,
          results: null,
          revealedCount: 0,
          revealMode: 'manual',
          autoRevealIntervalSec: null,
          kickedPlayerIds: [],
          createdAt: '',
          updatedAt: '',
        },
      });
      resetState();

      expect(state.room).toBeNull();
    });

    it('clears revealedResults', () => {
      setState({
        revealedResults: [
          { playerIndex: 0, playerId: 'p1', startCol: 0, endCol: 0, isWinner: true, path: [] },
        ],
      });
      resetState();

      expect(state.revealedResults).toEqual([]);
    });

    it('clears error', () => {
      setState({ error: 'something went wrong' });
      resetState();

      expect(state.error).toBeNull();
    });
  });
});
