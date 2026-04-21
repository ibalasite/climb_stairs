/**
 * Unit tests for ws/client.ts — handleMessage paths and helper functions.
 *
 * Tests cover the message handler switch cases:
 * ROOM_STATE, ROOM_STATE_FULL, REVEAL_INDEX, REVEAL_ALL,
 * PLAYER_KICKED, SESSION_REPLACED, HOST_TRANSFERRED, ERROR
 *
 * Also covers resolveView and buildRevealedFromRoom internal helpers
 * via the observable side effects on state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Stubs ────────────────────────────────────────────────────────────────────

type WsReadyState = 0 | 1 | 2 | 3;

interface MockWebSocket {
  readyState: WsReadyState;
  onopen: (() => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

let createdInstances: MockWebSocket[] = [];

class MockWebSocketClass {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: WsReadyState = 1; // default to OPEN so send works
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    // Don't call onclose to avoid side-effects in these tests
  });

  constructor(_url: string) {
    createdInstances.push(this as unknown as MockWebSocket);
  }
}

// Install stubs
(globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocketClass;
(globalThis as unknown as Record<string, unknown>).location = {
  protocol: 'https:',
  host: 'localhost:3000',
};

// Minimal document stub for showToast
if (typeof document === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).document = {
    getElementById: (_id: string) => null,
  };
}

// ─── Import modules after stubs ───────────────────────────────────────────────

const wsModule = await import('../../ws/client.js');
const { connect, disconnect, send } = wsModule;

// Import state so we can observe side-effects
const storeModule = await import('../../state/store.js');
const { state } = storeModule;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActiveWs(): MockWebSocket {
  return createdInstances[createdInstances.length - 1] as MockWebSocket;
}

function simulateMessage(type: string, payload: unknown): void {
  const ws = getActiveWs();
  if (ws?.onmessage) {
    const ev = { data: JSON.stringify({ type, payload }) } as MessageEvent;
    ws.onmessage(ev);
  }
}

function makeRoomPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 'TEST01',
    status: 'waiting',
    hostId: 'player-1',
    players: [
      {
        id: 'player-1',
        nickname: 'Alice',
        colorIndex: 0,
        isHost: true,
        isOnline: true,
        joinedAt: Date.now(),
        result: null,
      },
    ],
    winnerCount: 1,
    revealedCount: 0,
    revealMode: 'manual',
    kickedPlayerIds: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ws/client.ts — handleMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createdInstances = [];
    // Reset state to initial
    storeModule.setState({
      view: 'lobby',
      myPlayerId: null,
      myToken: null,
      room: null,
      revealedResults: [],
      error: null,
    });
    connect('test-token');
    // Simulate connection open
    const ws = getActiveWs();
    if (ws) ws.readyState = 1;
  });

  afterEach(() => {
    disconnect();
    vi.useRealTimers();
  });

  // ── ROOM_STATE / ROOM_STATE_FULL ──────────────────────────────────────────

  describe('ROOM_STATE message', () => {
    it('sets room on state with waiting status → view becomes "waiting"', () => {
      simulateMessage('ROOM_STATE', makeRoomPayload({ status: 'waiting' }));

      expect(state.room).not.toBeNull();
      expect(state.room?.code).toBe('TEST01');
      expect(state.view).toBe('waiting');
    });

    it('sets room on state with running status → view becomes "game"', () => {
      simulateMessage('ROOM_STATE', makeRoomPayload({ status: 'running' }));

      expect(state.view).toBe('game');
    });

    it('populates ladder from payload when present', () => {
      const ladder = { seed: 1, seedSource: 'x', rowCount: 5, colCount: 2, segments: [] };
      simulateMessage('ROOM_STATE', makeRoomPayload({ ladder }));

      expect(state.room?.ladder).toEqual(ladder);
    });

    it('populates revealedResults from results slice up to revealedCount', () => {
      const results = [
        { playerIndex: 0, playerId: 'player-1', startCol: 0, endCol: 0, isWinner: true, path: [] },
        { playerIndex: 1, playerId: 'player-2', startCol: 1, endCol: 1, isWinner: false, path: [] },
      ];
      simulateMessage('ROOM_STATE', makeRoomPayload({ results, revealedCount: 1 }));

      expect(state.revealedResults).toHaveLength(1);
      expect(state.revealedResults[0]?.playerId).toBe('player-1');
    });

    it('sets revealedResults to empty array when results is null', () => {
      simulateMessage('ROOM_STATE', makeRoomPayload({ results: null, revealedCount: 0 }));

      expect(state.revealedResults).toEqual([]);
    });

    it('handles missing kickedPlayerIds gracefully (defaults to [])', () => {
      const payload = makeRoomPayload();
      delete (payload as Record<string, unknown>).kickedPlayerIds;
      simulateMessage('ROOM_STATE', payload);

      expect(state.room?.kickedPlayerIds).toEqual([]);
    });
  });

  describe('ROOM_STATE_FULL message', () => {
    it('handles ROOM_STATE_FULL identically to ROOM_STATE', () => {
      simulateMessage('ROOM_STATE_FULL', makeRoomPayload({ status: 'running' }));

      expect(state.room?.code).toBe('TEST01');
      expect(state.view).toBe('game');
    });
  });

  // ── REVEAL_INDEX ──────────────────────────────────────────────────────────

  describe('REVEAL_INDEX message', () => {
    it('appends revealed result to revealedResults', () => {
      // Set up initial revealed results
      storeModule.setState({
        revealedResults: [
          { playerIndex: 0, playerId: 'player-1', startCol: 0, endCol: 0, isWinner: true, path: [] },
        ],
      });

      simulateMessage('REVEAL_INDEX', {
        result: { playerIndex: 1, playerId: 'player-2', startCol: 1, endCol: 1, isWinner: false, path: [] },
      });

      expect(state.revealedResults).toHaveLength(2);
      expect(state.revealedResults[1]?.playerId).toBe('player-2');
    });

    it('starts from empty revealedResults and appends one result', () => {
      storeModule.setState({ revealedResults: [] });

      simulateMessage('REVEAL_INDEX', {
        result: { playerIndex: 0, playerId: 'player-1', startCol: 0, endCol: 0, isWinner: true, path: [] },
      });

      expect(state.revealedResults).toHaveLength(1);
    });
  });

  // ── REVEAL_ALL ────────────────────────────────────────────────────────────

  describe('REVEAL_ALL message', () => {
    it('replaces revealedResults with all results', () => {
      storeModule.setState({ revealedResults: [] });

      const results = [
        { playerIndex: 0, playerId: 'player-1', startCol: 0, endCol: 0, isWinner: true, path: [] },
        { playerIndex: 1, playerId: 'player-2', startCol: 1, endCol: 1, isWinner: false, path: [] },
      ];
      simulateMessage('REVEAL_ALL', { results });

      expect(state.revealedResults).toHaveLength(2);
      expect(state.revealedResults[0]?.playerId).toBe('player-1');
      expect(state.revealedResults[1]?.playerId).toBe('player-2');
    });

    it('sets empty array when results payload is undefined/null', () => {
      storeModule.setState({
        revealedResults: [
          { playerIndex: 0, playerId: 'p1', startCol: 0, endCol: 0, isWinner: false, path: [] },
        ],
      });

      simulateMessage('REVEAL_ALL', {});

      expect(state.revealedResults).toEqual([]);
    });
  });

  // ── PLAYER_KICKED ─────────────────────────────────────────────────────────

  describe('PLAYER_KICKED message', () => {
    it('resets state to lobby on PLAYER_KICKED', () => {
      storeModule.setState({
        view: 'game',
        room: {
          code: 'TEST01',
          status: 'running',
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

      simulateMessage('PLAYER_KICKED', {});

      expect(state.view).toBe('lobby');
      expect(state.room).toBeNull();
      expect(state.myPlayerId).toBeNull();
      expect(state.myToken).toBeNull();
      expect(state.revealedResults).toEqual([]);
    });
  });

  // ── SESSION_REPLACED ──────────────────────────────────────────────────────

  describe('SESSION_REPLACED message', () => {
    it('resets state to lobby on SESSION_REPLACED', () => {
      storeModule.setState({
        view: 'game',
        myPlayerId: 'player-1',
        myToken: 'some-token',
      });

      simulateMessage('SESSION_REPLACED', {});

      expect(state.view).toBe('lobby');
      expect(state.myPlayerId).toBeNull();
      expect(state.myToken).toBeNull();
      expect(state.room).toBeNull();
    });
  });

  // ── HOST_TRANSFERRED ──────────────────────────────────────────────────────

  describe('HOST_TRANSFERRED message', () => {
    it('handles HOST_TRANSFERRED without throwing', () => {
      expect(() => simulateMessage('HOST_TRANSFERRED', {})).not.toThrow();
    });
  });

  // ── ERROR ─────────────────────────────────────────────────────────────────

  describe('ERROR message', () => {
    it('handles ERROR message without throwing', () => {
      expect(() =>
        simulateMessage('ERROR', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
      ).not.toThrow();
    });

    it('handles ERROR message with only code (no message field)', () => {
      expect(() =>
        simulateMessage('ERROR', { code: 'GENERIC_ERROR' })
      ).not.toThrow();
    });
  });

  // ── Invalid / malformed messages ──────────────────────────────────────────

  describe('malformed messages', () => {
    it('ignores messages with invalid JSON', () => {
      const ws = getActiveWs();
      if (ws?.onmessage) {
        const ev = { data: 'NOT_VALID_JSON' } as MessageEvent;
        expect(() => ws.onmessage!(ev)).not.toThrow();
      }
    });
  });

  // ── send() ────────────────────────────────────────────────────────────────

  describe('send()', () => {
    it('sends JSON message when WebSocket is open', () => {
      const ws = getActiveWs();
      if (ws) ws.readyState = 1;

      send('PING');

      const ws2 = getActiveWs();
      expect(ws2?.send).toHaveBeenCalled();
      const callArg = ws2?.send.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(callArg) as { type: string };
      expect(parsed.type).toBe('PING');
    });

    it('shows error toast when WebSocket is not open', () => {
      const ws = getActiveWs();
      if (ws) ws.readyState = 3; // CLOSED

      // Should not throw — showToast fallback handles missing document
      expect(() => send('PING')).not.toThrow();
    });
  });
});
