import type { LadderData, Player, ResultSlot, PathStep } from '@ladder-room/shared';
import { colorFromIndex, colorFromIndexDim } from './colors.js';

export interface DrawParams {
  canvas: HTMLCanvasElement;
  ladder: LadderData;
  players: readonly Player[];
  revealedResults: readonly ResultSlot[];
  myPlayerId: string | null;
  animatingIndex?: number;
  animProgress?: number;
}

const RAIL_WIDTH   = 3;
const RUNG_WIDTH   = 2;
const PATH_WIDTH   = 5;
const BALL_RADIUS  = 8;
const PADDING_TOP  = 60;
const PADDING_SIDE = 24;
const PADDING_BOT  = 32;
const NAME_FONT    = '13px system-ui, sans-serif';
const GOLD         = '#ffd700';
const GRAY_PATH    = '#888'; // fallback only — players always have a colorIndex

export function drawLadder(params: DrawParams): void {
  const { canvas, ladder, players, revealedResults, myPlayerId, animatingIndex, animProgress } = params;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  if (
    canvas.width  !== Math.round(rect.width  * devicePixelRatio) ||
    canvas.height !== Math.round(rect.height * devicePixelRatio)
  ) {
    canvas.width  = Math.round(rect.width  * devicePixelRatio);
    canvas.height = Math.round(rect.height * devicePixelRatio);
    ctx.resetTransform();
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  const W = rect.width;
  const H = rect.height;
  ctx.clearRect(0, 0, W, H);

  const cols = ladder.colCount;
  const rows = ladder.rowCount;
  const usableW = W - PADDING_SIDE * 2;
  const usableH = H - PADDING_TOP - PADDING_BOT;
  const colStep = cols > 1 ? usableW / (cols - 1) : usableW;
  const rowStep = rows > 1 ? usableH / (rows - 1) : usableH;

  const colX = (c: number) => PADDING_SIDE + c * colStep;
  const rowY = (r: number) => PADDING_TOP + r * rowStep;

  // ── Vertical rails ──────────────────────────────────────────────────────────
  ctx.lineWidth = RAIL_WIDTH;
  for (let c = 0; c < cols; c++) {
    const player = players[c];
    ctx.strokeStyle = player ? colorFromIndexDim(player.colorIndex) : '#2a2a45';
    ctx.beginPath();
    ctx.moveTo(colX(c), PADDING_TOP);
    ctx.lineTo(colX(c), PADDING_TOP + usableH);
    ctx.stroke();
  }

  // ── Horizontal rungs ────────────────────────────────────────────────────────
  ctx.lineWidth = RUNG_WIDTH;
  ctx.strokeStyle = '#3a3a60';
  for (const seg of ladder.segments) {
    ctx.beginPath();
    ctx.moveTo(colX(seg.col),     rowY(seg.row));
    ctx.lineTo(colX(seg.col + 1), rowY(seg.row));
    ctx.stroke();
  }

  // ── Revealed paths ──────────────────────────────────────────────────────────
  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < revealedResults.length; i++) {
    const result   = revealedResults[i]!;
    const player   = players[result.playerIndex];
    const isWinner = result.isWinner;

    const isAnimThis = animatingIndex === i && animProgress !== undefined;
    const progress   = isAnimThis ? (animProgress as number) : 1;

    // Every player keeps their own distinct color throughout.
    // Winners get a gold glow (shadow) instead of having their color replaced.
    const color = player ? colorFromIndex(player.colorIndex) : GRAY_PATH;

    // Completed paths are semi-transparent so overlapping paths stay visible.
    // The currently animating path is fully opaque to stand out.
    ctx.globalAlpha = isAnimThis ? 1.0 : 0.6;
    ctx.lineWidth   = PATH_WIDTH;
    ctx.strokeStyle = color;
    ctx.shadowColor = isWinner ? GOLD : 'transparent';
    ctx.shadowBlur  = isWinner && progress >= 1 ? 10 : 0;

    drawPath(ctx, result.path, colX, rowY, rows, progress, color);

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1.0;

    if (progress >= 1) {
      ctx.globalAlpha = isAnimThis ? 1.0 : 0.85;
      ctx.fillStyle   = color;
      ctx.shadowColor = isWinner ? GOLD : 'transparent';
      ctx.shadowBlur  = isWinner ? 10 : 0;
      ctx.beginPath();
      ctx.arc(colX(result.endCol), rowY(rows - 1), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1.0;
    }
  }

  // ── Player names at top ─────────────────────────────────────────────────────
  ctx.font         = NAME_FONT;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';

  for (let c = 0; c < cols; c++) {
    const player = players[c];
    if (!player) continue;
    const isMe = player.id === myPlayerId;
    ctx.fillStyle = isMe ? '#a78bfa' : colorFromIndex(player.colorIndex);
    ctx.font      = isMe ? `bold ${NAME_FONT}` : NAME_FONT;
    let name = player.nickname;
    if (name.length > 6) name = name.slice(0, 5) + '…';
    ctx.fillText(name, colX(c), PADDING_TOP - 6);
  }

  // ── Winner star labels at bottom ────────────────────────────────────────────
  ctx.font         = '11px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  for (let i = 0; i < revealedResults.length; i++) {
    const result = revealedResults[i]!;
    if (!result.isWinner) continue;
    const isAnimThis = animatingIndex === i && (animProgress ?? 1) < 1;
    if (isAnimThis) continue;
    ctx.fillStyle = GOLD;
    ctx.fillText('★', colX(result.endCol), rowY(rows - 1) + 10);
  }
}

// ── Waypoint builder ─────────────────────────────────────────────────────────
// Converts path steps to a list of (x, y) canvas coordinates.
// 'down' steps are implicit (just going straight down), so only rung crossings
// ('right'/'left') generate explicit waypoints. The vertical segments between
// waypoints are drawn automatically by lineTo.
function buildWaypoints(
  path: readonly PathStep[],
  colX: (c: number) => number,
  rowY: (r: number) => number,
  rowCount: number,
): [number, number][] {
  if (path.length === 0) return [];

  const startCol = path[0]!.col;
  const pts: [number, number][] = [[colX(startCol), rowY(0)]];

  for (const step of path) {
    if (step.direction === 'right') {
      pts.push([colX(step.col),     rowY(step.row)]); // arrive at rung
      pts.push([colX(step.col + 1), rowY(step.row)]); // cross right
    } else if (step.direction === 'left') {
      pts.push([colX(step.col),     rowY(step.row)]); // arrive at rung
      pts.push([colX(step.col - 1), rowY(step.row)]); // cross left
    }
    // 'down' contributes no waypoints; lineTo connects previous → next naturally
  }

  const last = path[path.length - 1]!;
  let endCol = last.col;
  if (last.direction === 'right') endCol = last.col + 1;
  else if (last.direction === 'left') endCol = last.col - 1;
  pts.push([colX(endCol), rowY(rowCount - 1)]);

  return pts;
}

// ── Path drawing with optional animation progress ────────────────────────────
function drawPath(
  ctx: CanvasRenderingContext2D,
  path: readonly PathStep[],
  colX: (c: number) => number,
  rowY: (r: number) => number,
  rowCount: number,
  progress: number,
  color: string,
): void {
  const pts = buildWaypoints(path, colX, rowY, rowCount);
  if (pts.length < 2) return;

  // Segment lengths for progress interpolation
  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]![0] - pts[i - 1]![0];
    const dy = pts[i]![1] - pts[i - 1]![1];
    const len = Math.sqrt(dx * dx + dy * dy);
    segLens.push(len);
    totalLen += len;
  }

  const targetLen = totalLen * Math.min(progress, 1);

  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);

  let drawn = 0;
  let ballX = pts[0]![0];
  let ballY = pts[0]![1];

  for (let i = 1; i < pts.length; i++) {
    const segLen = segLens[i - 1]!;
    if (drawn + segLen >= targetLen) {
      const t = segLen > 0 ? (targetLen - drawn) / segLen : 0;
      ballX = pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * t;
      ballY = pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * t;
      ctx.lineTo(ballX, ballY);
      break;
    }
    ctx.lineTo(pts[i]![0], pts[i]![1]);
    ballX = pts[i]![0];
    ballY = pts[i]![1];
    drawn += segLen;
  }

  ctx.stroke();

  // Animated ball marker
  if (progress > 0 && progress < 1) {
    const savedShadow = ctx.shadowBlur;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = '#fff';
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = savedShadow;
  }
}
