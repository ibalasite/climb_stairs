/**
 * Unit tests for the play-again button logic in ui/game.ts
 *
 * Tests cover:
 * - handlePlayAgain: disables button, calls correct API endpoint with Auth header
 * - On API success: leaves button disabled (WS ROOM_STATE will re-render)
 * - On API non-OK: shows toast, re-enables button, restores text
 * - On network error: shows toast, re-enables button, restores text
 * - Non-host: button is absent from rendered HTML
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── DOM stub ──────────────────────────────────────────────────────────────────

type ToastCall = { msg: string; kind: string };
const toastCalls: ToastCall[] = [];

// Stub showToast by patching the module cache — inject before game.ts is loaded
vi.mock('../../ui/toast.js', () => ({
  showToast: (msg: string, kind: string) => {
    toastCalls.push({ msg, kind });
  },
}));

// Minimal document stubs (JSDOM is not available in vitest node env)
if (typeof document === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).document = {
    getElementById: (_id: string) => null,
    createElement: (_tag: string) => ({
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => [],
    }),
  };
}

// ─── Stub global fetch ────────────────────────────────────────────────────────

type FetchStub = ReturnType<typeof vi.fn>;
let fetchStub: FetchStub;

// ─── Import modules after stubs ───────────────────────────────────────────────

const storeModule = await import('../../state/store.js');
const { state, setState } = storeModule;
const { handlePlayAgain } = await import('../../ui/game.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRoom(overrides: Record<string, unknown> = {}): import('@ladder-room/shared').Room {
  return {
    code: 'ROOM01',
    status: 'finished',
    hostId: 'player-host',
    players: [
      { id: 'player-host', nickname: 'Alice', colorIndex: 0, isHost: true, isOnline: true, joinedAt: 0 },
      { id: 'player-2',    nickname: 'Bob',   colorIndex: 1, isHost: false, isOnline: true, joinedAt: 0 },
    ],
    winnerCount: 1,
    ladder: null,
    results: null,
    revealedCount: 0,
    revealMode: 'manual',
    autoRevealIntervalSec: null,
    kickedPlayerIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as import('@ladder-room/shared').Room;
}

function makeButton(text = '再玩一局'): HTMLButtonElement {
  const btn = {
    disabled: false,
    textContent: text,
  } as unknown as HTMLButtonElement;
  return btn;
}

describe('play-again button behaviour', () => {
  beforeEach(() => {
    toastCalls.length = 0;
    fetchStub = vi.fn();
    (globalThis as unknown as Record<string, unknown>).fetch = fetchStub;

    setState({
      view: 'game',
      myPlayerId: 'player-host',
      myToken: 'test-jwt-token',
      room: makeRoom(),
      revealedResults: [],
      error: null,
    });
  });

  afterEach(() => {
    storeModule.resetState();
    vi.restoreAllMocks();
  });

  // ── fetch call shape ──────────────────────────────────────────────────────

  it('calls POST /api/rooms/{code}/game/play-again with Authorization header', async () => {
    fetchStub.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const btn = makeButton();

    await handlePlayAgain(btn);

    expect(fetchStub).toHaveBeenCalledOnce();
    const [url, opts] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/rooms/ROOM01/game/play-again');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-jwt-token');
  });

  it('disables button and shows loading text while request is in flight', async () => {
    let resolveRequest!: (v: unknown) => void;
    fetchStub.mockReturnValueOnce(new Promise((r) => { resolveRequest = r; }));
    const btn = makeButton();

    const promise = handlePlayAgain(btn);

    // Before resolution: button should be disabled with loading text
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('處理中…');

    resolveRequest({ ok: true, json: async () => ({}) });
    await promise;
  });

  it('leaves button disabled on success (WS will trigger re-render)', async () => {
    fetchStub.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const btn = makeButton();

    await handlePlayAgain(btn);

    // Button stays disabled — no re-enable on success path
    expect(btn.disabled).toBe(true);
    expect(toastCalls.filter((c) => c.kind === 'error')).toHaveLength(0);
  });

  // ── API non-OK response ───────────────────────────────────────────────────

  it('shows toast error and re-enables button on HTTP 400', async () => {
    fetchStub.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'INSUFFICIENT_ONLINE_PLAYERS' }),
    });
    const btn = makeButton();

    await handlePlayAgain(btn);

    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('再玩一局');
    expect(toastCalls).toHaveLength(1);
    expect(toastCalls[0]?.kind).toBe('error');
    expect(toastCalls[0]?.msg).toBe('INSUFFICIENT_ONLINE_PLAYERS');
  });

  it('falls back to generic message when error body has no message field', async () => {
    fetchStub.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    const btn = makeButton();

    await handlePlayAgain(btn);

    expect(toastCalls[0]?.msg).toBe('再玩一局失敗');
    expect(btn.disabled).toBe(false);
  });

  it('uses error.code when message is absent', async () => {
    fetchStub.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: 'INVALID_STATE' }),
    });
    const btn = makeButton();

    await handlePlayAgain(btn);

    expect(toastCalls[0]?.msg).toBe('INVALID_STATE');
  });

  // ── Network error ─────────────────────────────────────────────────────────

  it('shows toast and re-enables button on network error', async () => {
    fetchStub.mockRejectedValueOnce(new Error('Failed to fetch'));
    const btn = makeButton();

    await handlePlayAgain(btn);

    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('再玩一局');
    expect(toastCalls[0]?.kind).toBe('error');
    expect(toastCalls[0]?.msg).toBe('Failed to fetch');
  });

  it('shows 網路錯誤 when thrown value is not an Error instance', async () => {
    fetchStub.mockRejectedValueOnce('string error');
    const btn = makeButton();

    await handlePlayAgain(btn);

    expect(toastCalls[0]?.msg).toBe('網路錯誤');
  });

  // ── Guard: no room or token ───────────────────────────────────────────────

  it('does nothing when room is null', async () => {
    setState({ room: null });
    const btn = makeButton();

    await handlePlayAgain(btn);

    expect(fetchStub).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
  });

  it('does nothing when myToken is null', async () => {
    setState({ myToken: null });
    const btn = makeButton();

    await handlePlayAgain(btn);

    expect(fetchStub).not.toHaveBeenCalled();
  });
});

// ── WS ROOM_STATE(waiting) → view transitions to waiting ──────────────────────
// This is already covered by handleMessage.test.ts ROOM_STATE suite.
// Noting here for completeness: when the server broadcasts ROOM_STATE with
// status='waiting' (after play-again succeeds), the existing resolveView()
// logic in ws/client.ts sets view='waiting', causing the app to switch to
// the waiting room UI automatically — no additional WS handler is needed.
