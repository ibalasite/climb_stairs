/**
 * Supplemental branch coverage tests for canvas/renderer.ts.
 *
 * Targets:
 * - Line 33: canvas dimensions already match → skip resize branch
 * - Lines 168-170: step.direction === 'left' path traversal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LadderData, Player, ResultSlot, PathStep } from '@ladder-room/shared';

// ─── Mock Canvas Context ──────────────────────────────────────────────────────

function makeMockCtx() {
  const calls: { method: string; args: unknown[] }[] = [];
  const record = (method: string) => (...args: unknown[]) => { calls.push({ method, args }); };

  return {
    _calls: calls,
    globalAlpha: 1.0,
    lineWidth: 1,
    strokeStyle: '#000',
    fillStyle: '#000',
    shadowColor: 'transparent',
    shadowBlur: 0,
    font: '',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
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
  } as unknown as CanvasRenderingContext2D & { _calls: { method: string; args: unknown[] }[] };
}

function makeMockCanvas(ctx: CanvasRenderingContext2D, rectWidth = 400, rectHeight = 600) {
  const rect = {
    width: rectWidth,
    height: rectHeight,
    top: 0, left: 0, bottom: rectHeight, right: rectWidth, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  // Start with dimensions already set to match rect (so resize branch is skipped)
  const canvas = {
    width: Math.round(rectWidth * devicePixelRatio),
    height: Math.round(rectHeight * devicePixelRatio),
    getContext: (_id: string) => ctx,
    getBoundingClientRect: () => rect,
  } as unknown as HTMLCanvasElement;

  return canvas;
}

Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });

const { drawLadder } = await import('../../canvas/renderer.js');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePlayers = (count = 3): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    nickname: `P${i}`,
    colorIndex: i * 5,
    isHost: i === 0,
    isOnline: true,
    joinedAt: Date.now(),
    result: null,
  }));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('renderer.ts — branch coverage', () => {
  let ctx: ReturnType<typeof makeMockCtx>;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    ctx = makeMockCtx();
    canvas = makeMockCanvas(ctx);
  });

  // ── Line 33: skip resize when dimensions already match ────────────────────

  it('skips canvas resize when dimensions already match devicePixelRatio', () => {
    const ladder: LadderData = {
      seed: 1, seedSource: 'test', rowCount: 5, colCount: 2, segments: [],
    };

    // canvas.width/height are already set to match rect in makeMockCanvas
    // so the condition on line 31-39 should be falsy → resetTransform NOT called
    (ctx as ReturnType<typeof makeMockCtx>)._calls.length = 0;

    drawLadder({
      canvas,
      ladder,
      players: makePlayers(2),
      revealedResults: [],
      myPlayerId: null,
    });

    const resetCalls = (ctx as ReturnType<typeof makeMockCtx>)._calls.filter(
      (c) => c.method === 'resetTransform'
    );
    expect(resetCalls).toHaveLength(0); // resize skipped → no resetTransform
  });

  // ── Lines 168-170: step.direction === 'left' path traversal ─────────────

  it('handles left-direction steps in path traversal', () => {
    const ladder: LadderData = {
      seed: 1,
      seedSource: 'test',
      rowCount: 5,
      colCount: 3,
      segments: [{ row: 1, col: 0 }], // bar at col 0 → player coming from col 1 moves left
    };

    const leftPath: PathStep[] = [
      { row: 0, col: 2, direction: 'down' },
      { row: 1, col: 2, direction: 'left' }, // left step — covers lines 168-170
      { row: 2, col: 1, direction: 'down' },
      { row: 3, col: 1, direction: 'down' },
      { row: 4, col: 1, direction: 'down' },
    ];

    const result: ResultSlot = {
      playerIndex: 2,
      playerId: 'player-2',
      startCol: 2,
      endCol: 1,
      isWinner: false,
      path: leftPath,
    };

    expect(() =>
      drawLadder({
        canvas,
        ladder,
        players: makePlayers(3),
        revealedResults: [result],
        myPlayerId: null,
      })
    ).not.toThrow();

    // Verify moveTo was called (path drawing started)
    const moveCalls = (ctx as ReturnType<typeof makeMockCtx>)._calls.filter(
      (c) => c.method === 'moveTo'
    );
    expect(moveCalls.length).toBeGreaterThan(0);
  });

  // ── onerror handler (ws/client.ts line 79-80) is covered via reconnect tests

  // ── startPing interval — covered indirectly when onopen fires
  it('drawLadder runs without error for a single-column ladder (edge case)', () => {
    const ladder: LadderData = {
      seed: 1,
      seedSource: 'test',
      rowCount: 3,
      colCount: 1,
      segments: [],
    };
    expect(() =>
      drawLadder({
        canvas,
        ladder,
        players: makePlayers(1),
        revealedResults: [],
        myPlayerId: null,
      })
    ).not.toThrow();
  });
});
