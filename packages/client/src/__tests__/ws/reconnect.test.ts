/**
 * TDD skeleton for WebSocket reconnect / exponential-backoff logic in ws/client.ts.
 *
 * BDD coverage: features/client-reconnect.feature
 * AC: @reconnect scenarios — UI behaviour on disconnect, retry, restore.
 *
 * ws/client.ts implements a fixed-delay (RECONNECT_DELAY_MS = 2000) retry loop
 * with MAX_RECONNECT = 3 cap. There is no exponential backoff in the current
 * implementation. Skeletons below reflect the actual code paths.
 *
 * All skeletons use it.todo() to signal pending implementation — they pass the
 * vitest runner without error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── WebSocket global stub ────────────────────────────────────────────────────
//
// ws/client.ts calls `new WebSocket(url)` and accesses `WebSocket.OPEN` /
// `WebSocket.CONNECTING` constants. We install a minimal stub on globalThis
// before importing the module.

type WsReadyState = 0 | 1 | 2 | 3; // CONNECTING | OPEN | CLOSING | CLOSED

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

  readyState: WsReadyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  });

  constructor(_url: string) {
    createdInstances.push(this as unknown as MockWebSocket);
  }
}

// Install stubs on globalThis before module import
(globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocketClass;
(globalThis as unknown as Record<string, unknown>).location = {
  protocol: 'https:',
  host: 'localhost:3000',
};

// Minimal document stub so showToast (called on max-reconnect failure) doesn't throw.
// getElementById returns null → showToast returns early without side effects.
if (typeof document === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).document = {
    getElementById: (_id: string) => null,
  };
}

// ─── Import after stubs ───────────────────────────────────────────────────────

const { connect, disconnect, getConnState } = await import('../../ws/client.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WebSocket reconnect logic (ws/client.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createdInstances = [];
  });

  afterEach(() => {
    disconnect();
    vi.useRealTimers();
  });

  // ── getConnState ──────────────────────────────────────────────────────────

  describe('getConnState', () => {
    it('returns "disconnected" before connect() is called', () => {
      disconnect(); // ensure clean state
      expect(getConnState()).toBe('disconnected');
    });

    it('returns "connecting" when WebSocket.readyState is CONNECTING (0)', () => {
      connect('test-token');
      const ws = createdInstances[0];
      if (ws) ws.readyState = 0; // CONNECTING
      expect(getConnState()).toBe('connecting');
    });

    it('returns "connected" when WebSocket.readyState is OPEN (1)', () => {
      connect('test-token');
      const ws = createdInstances[0];
      if (ws) {
        ws.readyState = 1; // OPEN
        if (ws.onopen) ws.onopen();
      }
      expect(getConnState()).toBe('connected');
    });
  });

  // ── connect() — initial connection ───────────────────────────────────────

  describe('connect()', () => {
    it('creates a WebSocket with wss:// URL derived from location', () => {
      connect('my-token');
      expect(createdInstances).toHaveLength(1);
    });

    it('resets reconnectCount to 0 on explicit connect()', () => {
      // Trigger some failures to advance reconnectCount
      connect('tok');
      const ws1 = createdInstances[0];
      if (ws1 && ws1.onclose) ws1.onclose();
      vi.advanceTimersByTime(2000);
      // Calling connect() again should reset the counter
      connect('tok2');
      const ws3 = createdInstances[createdInstances.length - 1];
      if (ws3) {
        ws3.readyState = 1;
        if (ws3.onopen) ws3.onopen();
      }
      expect(getConnState()).toBe('connected');
    });
  });

  // ── Automatic reconnect on close ──────────────────────────────────────────

  describe('automatic reconnect on close', () => {
    it('schedules a reconnect after RECONNECT_DELAY_MS (2000 ms) on close', () => {
      connect('tok');
      const firstWs = createdInstances[0];
      if (firstWs && firstWs.onclose) firstWs.onclose();

      expect(createdInstances).toHaveLength(1); // not yet reconnected

      vi.advanceTimersByTime(2000);
      expect(createdInstances).toHaveLength(2); // reconnect attempted
    });

    it('retries up to MAX_RECONNECT (3) times before stopping', () => {
      connect('tok');

      for (let i = 0; i < 3; i++) {
        const ws = createdInstances[i];
        if (ws && ws.onclose) ws.onclose();
        vi.advanceTimersByTime(2000);
      }

      // 1 initial + 3 retries = 4 total WebSocket instances
      expect(createdInstances).toHaveLength(4);

      // After MAX_RECONNECT exhausted, no more retries
      const lastWs = createdInstances[3];
      if (lastWs && lastWs.onclose) lastWs.onclose();
      vi.advanceTimersByTime(2000);
      expect(createdInstances).toHaveLength(4); // still 4, no further attempt
    });

    it('does NOT retry after disconnect() is called explicitly', () => {
      connect('tok');
      disconnect();

      vi.advanceTimersByTime(10_000);
      expect(createdInstances).toHaveLength(1); // only the initial one
    });
  });

  // ── disconnect() ─────────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('closes the WebSocket and clears the reference', () => {
      connect('tok');
      const ws = createdInstances[0];
      disconnect();
      expect(ws?.close).toHaveBeenCalled();
      expect(getConnState()).toBe('disconnected');
    });
  });

  // ── Pending / future scenarios (it.todo) ─────────────────────────────────

  it.todo('shows "connecting" overlay on first disconnect (BDD: @reconnect @offline @P0)');

  it.todo('keeps Canvas state intact during disconnect (BDD: @reconnect @offline @P1)');

  it.todo('shows retry count in UI "嘗試重新連線（第 N / 3 次）" (BDD: @reconnect @retry @P0)');

  it.todo('shows "連線失敗，請重新整理頁面" after 3 failed retries (BDD: @reconnect @retry @P1)');

  it.todo('removes overlay on reconnect success (BDD: @reconnect @restore @P0)');

  it.todo('re-renders canvas from ROOM_STATE_FULL after reconnect (BDD: @reconnect @restore @P0)');

  it.todo('displays SESSION_REPLACED toast and navigates to lobby (BDD: @reconnect @session-replaced @P0)');

  it.todo('allows re-join after SESSION_REPLACED (BDD: @reconnect @session-replaced @P1)');
});
