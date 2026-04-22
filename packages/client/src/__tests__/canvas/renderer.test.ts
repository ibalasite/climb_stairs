/**
 * TDD skeleton for canvas/renderer.ts — drawLadder core logic.
 *
 * BDD coverage: features/client-canvas.feature
 * AC: canvas rendering behaviour across waiting / running / revealing / finished states.
 *
 * The test environment is Node (vitest environment: 'node'), so we provide a
 * minimal mock CanvasRenderingContext2D and HTMLCanvasElement before importing
 * the module under test.  No jsdom / happy-dom dependency is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Canvas Context ──────────────────────────────────────────────────────

type CtxCallRecord = { method: string; args: unknown[] };
type CtxPropRecord = { prop: string; value: unknown };

function makeMockCtx(): CanvasRenderingContext2D & {
  _calls: CtxCallRecord[];
  _propSets: CtxPropRecord[];
} {
  const calls: CtxCallRecord[] = [];
  const propSets: CtxPropRecord[] = [];

  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };

  const trackProp = (prop: string, init: unknown) => {
    let val = init;
    return {
      get: () => val,
      set: (v: unknown) => {
        propSets.push({ prop, value: v });
        val = v;
      },
      enumerable: true,
      configurable: true,
    };
  };

  const base: Record<string, unknown> = {
    _calls: calls,
    _propSets: propSets,

    // Methods
    clearRect: record('clearRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
    fill: record('fill'),
    arc: record('arc'),
    fillText: record('fillText'),
    resetTransform: record('resetTransform'),
    scale: record('scale'),
  };

  const ctx = Object.create(null) as CanvasRenderingContext2D & {
    _calls: CtxCallRecord[];
    _propSets: CtxPropRecord[];
  };

  // Copy plain properties
  for (const [k, v] of Object.entries(base)) {
    Object.defineProperty(ctx, k, { value: v, writable: true, enumerable: true, configurable: true });
  }

  // Tracked state properties
  const trackedProps: [string, unknown][] = [
    ['globalAlpha', 1.0],
    ['lineWidth', 1],
    ['strokeStyle', '#000'],
    ['fillStyle', '#000'],
    ['shadowColor', 'transparent'],
    ['shadowBlur', 0],
    ['font', ''],
    ['textAlign', 'start'],
    ['textBaseline', 'alphabetic'],
    ['lineCap', 'butt'],
    ['lineJoin', 'miter'],
  ];
  for (const [prop, init] of trackedProps) {
    Object.defineProperty(ctx, prop, trackProp(prop, init));
  }

  return ctx;
}

// ─── Mock HTMLCanvasElement ───────────────────────────────────────────────────

function makeMockCanvas(
  ctx: CanvasRenderingContext2D,
  opts: { width?: number; height?: number; dpr?: number } = {},
): HTMLCanvasElement {
  const rect = {
    width: opts.width ?? 400,
    height: opts.height ?? 600,
    top: 0,
    left: 0,
    bottom: opts.height ?? 600,
    right: opts.width ?? 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  const canvas = {
    width: 0,
    height: 0,
    getContext: (_id: string) => ctx,
    getBoundingClientRect: () => rect,
  } as unknown as HTMLCanvasElement;

  // devicePixelRatio mock
  Object.defineProperty(globalThis, 'devicePixelRatio', {
    value: opts.dpr ?? 1,
    configurable: true,
  });

  return canvas;
}

// ─── Import after mocks are defined ──────────────────────────────────────────

const { drawLadder } = await import('../../canvas/renderer.js');

// ─── Shared fixtures ──────────────────────────────────────────────────────────

import type { LadderData, Player, ResultSlot } from '@ladder-room/shared';

const makeLadder = (colCount = 3, rowCount = 5): LadderData => ({
  seed: 1,
  seedSource: 'test',
  rowCount,
  colCount,
  segments: [
    { row: 1, col: 0 },
    { row: 3, col: 1 },
  ],
});

const makePlayers = (count = 3): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    nickname: `P${i}`,
    colorIndex: i * 5,
    isHost: i === 0,
    isOnline: true,
    joinedAt: Date.now(),
  }));

const makeResult = (overrides: Partial<ResultSlot> = {}): ResultSlot => ({
  playerIndex: 0,
  playerId: 'player-0',
  startCol: 0,
  endCol: 2,
  isWinner: false,
  path: [
    { row: 0, col: 0, direction: 'down' },
    { row: 1, col: 0, direction: 'right' },
    { row: 1, col: 1, direction: 'down' },
  ],
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('drawLadder', () => {
  let mockCtx: CanvasRenderingContext2D & { _calls: CtxCallRecord[] };
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    mockCtx = makeMockCtx();
    canvas = makeMockCanvas(mockCtx);
  });

  // ── Guard ─────────────────────────────────────────────────────────────────

  it('does nothing when context is null', () => {
    const nullCtxCanvas = {
      width: 0,
      height: 0,
      getContext: () => null,
      getBoundingClientRect: () => ({ width: 400, height: 600, top: 0, left: 0, bottom: 600, right: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect),
    } as unknown as HTMLCanvasElement;

    expect(() =>
      drawLadder({
        canvas: nullCtxCanvas,
        ladder: makeLadder(),
        players: makePlayers(),
        revealedResults: [],
        myPlayerId: null,
      }),
    ).not.toThrow();
  });

  // ── Canvas dimensions ─────────────────────────────────────────────────────

  it('adjusts canvas dimensions for devicePixelRatio', () => {
    Object.defineProperty(globalThis, 'devicePixelRatio', { value: 2, configurable: true });
    const dprCtx = makeMockCtx();
    const dprCanvas = makeMockCanvas(dprCtx, { width: 400, height: 600, dpr: 2 });

    drawLadder({
      canvas: dprCanvas,
      ladder: makeLadder(),
      players: makePlayers(),
      revealedResults: [],
      myPlayerId: null,
    });

    expect(dprCanvas.width).toBe(400 * 2);
    expect(dprCanvas.height).toBe(600 * 2);
  });

  // ── Vertical rails ────────────────────────────────────────────────────────

  it('draws correct number of rails for colCount', () => {
    const colCount = 4;
    drawLadder({
      canvas,
      ladder: makeLadder(colCount),
      players: makePlayers(colCount),
      revealedResults: [],
      myPlayerId: null,
    });

    const strokeCalls = mockCtx._calls.filter((c) => c.method === 'stroke');
    // Each rail = 1 stroke; plus rung strokes (2 segments in makeLadder)
    // At minimum there should be colCount stroke calls for the rails
    expect(strokeCalls.length).toBeGreaterThanOrEqual(colCount);
  });

  it('uses player colorIndex for rail color', () => {
    const players = makePlayers(3);
    drawLadder({
      canvas,
      ladder: makeLadder(3),
      players,
      revealedResults: [],
      myPlayerId: null,
    });

    // strokeStyle should have been set during rail drawing
    // Each player gets their own hsl color derived from colorIndex
    // Verify strokeStyle was assigned at least once with an hsl() value
    const strokeStyleSets = mockCtx._propSets.filter((p) => p.prop === 'strokeStyle');
    const hasHsl = strokeStyleSets.some(
      (p) => typeof p.value === 'string' && p.value.startsWith('hsl'),
    );
    expect(hasHsl).toBe(true);
  });

  // ── Revealed path opacity ─────────────────────────────────────────────────

  it('draws revealed path with semi-transparency (globalAlpha=0.6)', () => {
    const result = makeResult({ isWinner: false });
    drawLadder({
      canvas,
      ladder: makeLadder(3),
      players: makePlayers(3),
      revealedResults: [result],
      myPlayerId: null,
      // No animatingIndex — path is "completed", should be 0.6
    });

    // globalAlpha is set to 0.6 for a non-animating revealed path, then reset to 1.0
    const alphaSets = mockCtx._propSets.filter((p) => p.prop === 'globalAlpha').map((p) => p.value);
    expect(alphaSets).toContain(0.6);   // semi-transparent for completed path
    expect(alphaSets[alphaSets.length - 1]).toBe(1.0); // final reset to opaque
  });

  it('draws animating path with full opacity (globalAlpha=1.0)', () => {
    const result = makeResult({ isWinner: false });
    drawLadder({
      canvas,
      ladder: makeLadder(3),
      players: makePlayers(3),
      revealedResults: [result],
      myPlayerId: null,
      animatingIndex: 0,
      animProgress: 0.5,
    });

    // When animatingIndex === 0 with progress < 1, globalAlpha should be set to 1.0 (fully opaque)
    const alphaSets = mockCtx._propSets.filter((p) => p.prop === 'globalAlpha').map((p) => p.value);
    // 0.6 must NOT appear — animating path stays fully opaque
    expect(alphaSets).not.toContain(0.6);
    expect(alphaSets).toContain(1.0);
  });

  // ── Winner gold shadow ────────────────────────────────────────────────────

  it('applies gold shadow to winner path', () => {
    const winnerResult = makeResult({ isWinner: true });
    drawLadder({
      canvas,
      ladder: makeLadder(3),
      players: makePlayers(3),
      revealedResults: [winnerResult],
      myPlayerId: null,
    });

    // shadowColor should have been set to '#ffd700' for the winner path
    const shadowColorSets = mockCtx._propSets.filter((p) => p.prop === 'shadowColor').map((p) => p.value);
    expect(shadowColorSets).toContain('#ffd700');
  });

  // ── Player name truncation ────────────────────────────────────────────────

  it('truncates long player names to 5 chars + ellipsis', () => {
    const longNamePlayers: Player[] = [
      {
        id: 'player-0',
        nickname: 'VeryLongPlayerName',
        colorIndex: 0,
        isHost: true,
        isOnline: true,
        joinedAt: Date.now(),
      },
      ...makePlayers(2).slice(1),
    ];

    drawLadder({
      canvas,
      ladder: makeLadder(3),
      players: longNamePlayers,
      revealedResults: [],
      myPlayerId: null,
    });

    const fillTextCalls = mockCtx._calls.filter((c) => c.method === 'fillText');
    const renderedNames = fillTextCalls.map((c) => c.args[0] as string);

    // 'VeryLongPlayerName' should be truncated to 'VeryL…' (5 chars + ellipsis)
    const truncated = renderedNames.find((n) => n.endsWith('…'));
    expect(truncated).toBeDefined();
    if (truncated) {
      // 5 chars before the ellipsis
      expect(truncated.replace('…', '')).toHaveLength(5);
    }
  });
});
