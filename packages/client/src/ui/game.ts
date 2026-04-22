import { state } from '../state/store.js';
import { send, getConnState } from '../ws/client.js';
import { drawLadder } from '../canvas/renderer.js';
import { colorFromIndex } from '../canvas/colors.js';
import { showToast } from './toast.js';

const ANIM_DURATION = 1500; // ms per revealed path

let resizeObserver: ResizeObserver | null = null;
let animFrameId: number | null = null;

// Animation state (persists across re-renders)
let prevRevealedCount = 0;
let animatingIndex = -1;
let animStartTime = 0;
let animLoopId: number | null = null;
let animCanvas: HTMLCanvasElement | null = null;
let animRoom: import('@ladder-room/shared').Room | null = null;
let animRevealedResults: readonly import('@ladder-room/shared').ResultSlot[] = [];
let animMyPlayerId: string | null = null;

function runAnimLoop(now: number): void {
  if (!animCanvas || !animRoom?.ladder) return;

  const progress = Math.min((now - animStartTime) / ANIM_DURATION, 1);

  drawLadder({
    canvas: animCanvas,
    ladder: animRoom.ladder,
    players: animRoom.players,
    revealedResults: animRevealedResults,
    myPlayerId: animMyPlayerId,
    animatingIndex,
    animProgress: progress,
  });

  if (progress < 1) {
    animLoopId = requestAnimationFrame(runAnimLoop);
  } else {
    animatingIndex = -1;
    animLoopId = null;
  }
}

export function renderGame(container: HTMLElement): void {
  const { room, myPlayerId, revealedResults } = state;

  if (!room) {
    container.innerHTML = '<div class="page"><p>載入中…</p></div>';
    return;
  }

  const isHost     = room.hostId === myPlayerId;
  const status     = room.status;
  const statusText = statusLabel(status);
  const statusCls  = `status-${status}`;
  const connState  = getConnState();

  container.innerHTML = `
    <div class="game-page">
      <header class="game-header">
        <span class="game-title">爬樓梯抽獎</span>
        <span class="status-badge ${statusCls}">${statusText}</span>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-left:auto">
          <span class="conn-dot ${connState}"></span>
          <span style="font-size:0.78rem;color:var(--text-dim)">${room.code}</span>
        </div>
        ${isHost ? renderHostControls(status) : ''}
      </header>

      <div class="canvas-area">
        <canvas id="ladder-canvas"></canvas>
      </div>

      <aside class="sidebar">
        <div class="sidebar-section">
          <p class="sidebar-title">玩家 (${room.players.length})</p>
          ${renderPlayerPills(room)}
        </div>
        <div class="result-list" id="result-list">
          ${renderResults(revealedResults, room.players, myPlayerId, room.winnerCount)}
        </div>
      </aside>
    </div>
  `;

  if (isHost) {
    wireHostControls(container, status);
  }

  const canvas = container.querySelector<HTMLCanvasElement>('#ladder-canvas');
  if (canvas && room.ladder) {
    setupCanvas(canvas, room, revealedResults, myPlayerId);
  }
}

function renderHostControls(status: string): string {
  if (status === 'running') {
    return `
      <div class="controls-bar" style="margin-left:1rem">
        <button class="btn btn-gold btn-sm" id="begin-reveal-btn">揭示結果</button>
      </div>
    `;
  }
  if (status === 'revealing') {
    return `
      <div class="controls-bar" style="margin-left:1rem">
        <button class="btn btn-gold btn-sm" id="reveal-next-btn">揭示下一位</button>
        <button class="btn btn-ghost btn-sm" id="reveal-all-btn">全部揭示</button>
      </div>
    `;
  }
  if (status === 'finished') {
    return `
      <div class="controls-bar" style="margin-left:1rem">
        <button class="btn btn-ghost btn-sm" id="play-again-btn">再玩一局</button>
      </div>
    `;
  }
  return '';
}

function wireHostControls(container: HTMLElement, status: string): void {
  container.querySelector('#begin-reveal-btn')?.addEventListener('click', () => {
    send('BEGIN_REVEAL');
  });

  container.querySelector('#reveal-next-btn')?.addEventListener('click', () => {
    send('REVEAL_NEXT');
  });

  container.querySelector('#reveal-all-btn')?.addEventListener('click', () => {
    send('REVEAL_ALL_TRIGGER');
  });

  const playAgainBtn = container.querySelector<HTMLButtonElement>('#play-again-btn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      void handlePlayAgain(playAgainBtn);
    });
  }
}

export async function handlePlayAgain(btn: HTMLButtonElement): Promise<void> {
  const { room, myToken } = state;
  if (!room || !myToken) return;

  btn.disabled = true;
  const originalText = btn.textContent ?? '再玩一局';
  btn.textContent = '處理中…';

  try {
    const res = await fetch(`/api/rooms/${room.code}/game/play-again`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${myToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      let errMsg = '再玩一局失敗';
      try {
        const body = await res.json() as { error?: string; message?: string; code?: string };
        errMsg = body.message ?? body.error ?? body.code ?? errMsg;
      } catch {
        // ignore parse errors
      }
      showToast(errMsg, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
    // On success, server broadcasts ROOM_STATE(status=waiting) via WS,
    // which resolveView() maps to 'waiting' → triggers re-render automatically.
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '網路錯誤';
    showToast(msg, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function renderPlayerPills(room: import('@ladder-room/shared').Room): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:0.3rem">
    ${room.players.map((p) => `
      <span style="
        font-size:0.75rem;
        padding:0.15rem 0.5rem;
        border-radius:999px;
        background:${colorFromIndex(p.colorIndex)}22;
        border:1px solid ${colorFromIndex(p.colorIndex)}66;
        color:${colorFromIndex(p.colorIndex)};
        opacity:${p.isOnline ? 1 : 0.45};
      ">${escapeHtml(p.nickname)}</span>
    `).join('')}
  </div>`;
}

function renderResults(
  revealed: readonly import('@ladder-room/shared').ResultSlot[],
  players: readonly import('@ladder-room/shared').Player[],
  myPlayerId: string | null,
  winnerCount: number | null,
): string {
  if (revealed.length === 0) {
    return '<p style="font-size:0.82rem;color:var(--text-dim);padding:0.5rem">等待揭示…</p>';
  }

  return revealed.map((r, i) => {
    const player  = players[r.playerIndex];
    const isMe    = player?.id === myPlayerId;
    const cls     = r.isWinner ? 'winner' : 'loser';
    const rank    = i + 1;
    const icon    = r.isWinner ? '<span class="result-crown">★</span>' : `<span class="result-rank">${rank}</span>`;
    const name    = player ? escapeHtml(player.nickname) : `玩家${r.playerIndex + 1}`;
    const youTag  = isMe ? '<span class="result-you">你</span>' : '';

    return `
      <div class="result-item ${cls}">
        ${icon}
        <span class="result-name" style="color:${player ? colorFromIndex(player.colorIndex) : 'inherit'}">${name}</span>
        ${youTag}
        ${r.isWinner ? '<span style="font-size:0.72rem;color:var(--gold)">中獎</span>' : ''}
      </div>
    `;
  }).join('');
}

function staticDraw(): void {
  if (!animCanvas || !animRoom?.ladder) return;
  drawLadder({
    canvas: animCanvas,
    ladder: animRoom.ladder,
    players: animRoom.players,
    revealedResults: animRevealedResults,
    myPlayerId: animMyPlayerId,
  });
}

function setupCanvas(
  canvas: HTMLCanvasElement,
  room: import('@ladder-room/shared').Room,
  revealedResults: readonly import('@ladder-room/shared').ResultSlot[],
  myPlayerId: string | null,
): void {
  // Always update module refs so ongoing anim loop draws to the current canvas
  animCanvas = canvas;
  animRoom = room;
  animRevealedResults = revealedResults;
  animMyPlayerId = myPlayerId;

  if (resizeObserver) resizeObserver.disconnect();

  const hasNewResult = revealedResults.length > prevRevealedCount;

  if (hasNewResult && revealedResults.length > 0) {
    animatingIndex = revealedResults.length - 1;
    animStartTime = performance.now();
    prevRevealedCount = revealedResults.length;

    if (animLoopId !== null) cancelAnimationFrame(animLoopId);
    animLoopId = requestAnimationFrame(runAnimLoop);
  } else if (animatingIndex === -1) {
    // Nothing animating — just redraw static
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(staticDraw);
  }
  // else: animation loop is running and will pick up the new canvas ref

  resizeObserver = new ResizeObserver(() => {
    if (animatingIndex === -1) staticDraw();
  });
  resizeObserver.observe(canvas.parentElement ?? canvas);
}

export function cleanupGame(): void {
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
  if (animFrameId !== null) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  if (animLoopId !== null) { cancelAnimationFrame(animLoopId); animLoopId = null; }
  animatingIndex = -1;
  prevRevealedCount = 0;
  animCanvas = null;
  animRoom = null;
  animRevealedResults = [];
  animMyPlayerId = null;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'running':   return '遊戲進行中';
    case 'revealing': return '揭示結果';
    case 'finished':  return '遊戲結束';
    default:          return '等待中';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
