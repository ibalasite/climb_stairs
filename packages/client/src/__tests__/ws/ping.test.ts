/**
 * Supplemental tests for ws/client.ts — startPing interval and onerror handler.
 *
 * These cover the remaining uncovered lines:
 * - Lines 98-100: setInterval callback inside startPing
 * - Lines 79-80: onerror handler (empty body, but must be invoked)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── WebSocket stub ───────────────────────────────────────────────────────────

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

  readyState: WsReadyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });

  constructor(_url: string) {
    createdInstances.push(this as unknown as MockWebSocket);
  }
}

(globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocketClass;
(globalThis as unknown as Record<string, unknown>).location = {
  protocol: 'https:',
  host: 'localhost:3000',
};

if (typeof document === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).document = {
    getElementById: (_id: string) => null,
  };
}

const { connect, disconnect } = await import('../../ws/client.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ws/client.ts — ping and onerror handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createdInstances = [];
  });

  afterEach(() => {
    disconnect();
    vi.useRealTimers();
  });

  describe('startPing interval callback', () => {
    it('sends PING when WebSocket is OPEN after 25 seconds', () => {
      connect('test-token');
      const ws = createdInstances[0];

      if (ws) {
        ws.readyState = 1; // OPEN
        // Trigger onopen to start the ping interval
        if (ws.onopen) ws.onopen();
      }

      // Advance 25 seconds to fire the setInterval callback
      vi.advanceTimersByTime(25000);

      // The send mock should have been called with PING
      const ws2 = createdInstances[0];
      expect(ws2?.send).toHaveBeenCalled();
      const callArg = ws2?.send.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(callArg) as { type: string };
      expect(parsed.type).toBe('PING');
    });

    it('does not send PING when WebSocket is not OPEN', () => {
      connect('test-token');
      const ws = createdInstances[0];

      if (ws) {
        ws.readyState = 1;
        if (ws.onopen) ws.onopen();
        // Now close it so readyState is no longer OPEN
        ws.readyState = 3; // CLOSED
      }

      vi.advanceTimersByTime(25000);

      // send should NOT have been called (readyState !== OPEN)
      const ws2 = createdInstances[0];
      expect(ws2?.send).not.toHaveBeenCalled();
    });
  });

  describe('onerror handler', () => {
    it('calls onerror without throwing (onerror is empty — onclose follows)', () => {
      connect('test-token');
      const ws = createdInstances[0];

      // onerror handler is assigned; invoking it should not throw
      expect(() => {
        if (ws?.onerror) ws.onerror();
      }).not.toThrow();
    });
  });

  describe('getConnState — CLOSING/CLOSED fallback', () => {
    it('returns "disconnected" when WebSocket is in CLOSING state (readyState=2)', async () => {
      const { getConnState } = await import('../../ws/client.js');
      connect('test-token');
      const ws = createdInstances[0];
      if (ws) ws.readyState = 2; // CLOSING

      expect(getConnState()).toBe('disconnected');
    });
  });
});
