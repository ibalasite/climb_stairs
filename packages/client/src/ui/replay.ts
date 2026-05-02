import type { Replay, ResultSlot } from '@ladder-room/shared';
import { drawLadder } from '../canvas/renderer.js';
import { renderAvatarHtml } from './avatar.js';
import { isMuted, toggleMuted, playClimb, playWinner, playLoser, unlockAudio } from '../audio.js';
import { showToast } from './toast.js';

const ANIM_DURATION = 1500;
const STEP_GAP = 600;

let resizeObs: ResizeObserver | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];

interface PlayState {
  revealed: ResultSlot[];
  animatingIndex: number;
  animStart: number;
  raf: number | null;
  finished: boolean;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function renderReplay(container: HTMLElement, replayId: string): Promise<void> {
  cleanupReplay();
  container.innerHTML = '<div class="page"><p>載入中…</p></div>';

  let replay: Replay;
  try {
    const res = await fetch(`/api/replays/${replayId}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: '找不到此重播' }));
      container.innerHTML = `<div class="page"><h1 class="page-title">重播</h1><p style="color:var(--danger,#e55)">${escapeHtml((body as { message?: string }).message ?? '錯誤')}</p>
        <p><a href="/" class="btn btn-secondary btn-sm">回首頁</a></p></div>`;
      return;
    }
    replay = await res.json() as Replay;
  } catch {
    container.innerHTML = '<div class="page"><p style="color:var(--danger,#e55)">網路錯誤</p></div>';
    return;
  }

  const muteIcon = isMuted() ? '🔇' : '🔊';
  const finishedDate = new Date(replay.finishedAt).toLocaleString();
  const winnerCount = replay.results.filter(r => r.isWinner).length;

  container.innerHTML = `
    <div class="game-page replay-view">
      <header class="game-header">
        <span class="game-title">🎬 開獎重播</span>
        <span class="status-badge status-finished">公開公正</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:0.5rem">
          <button class="btn btn-ghost btn-sm" id="replay-mute">${muteIcon}</button>
          <button class="btn btn-primary btn-sm" id="replay-play">▶ 開始播放</button>
          <a class="btn btn-ghost btn-sm" href="/">回首頁</a>
        </div>
      </header>

      ${replay.prize !== undefined && replay.prize !== '' ? `
        <div class="prize-banner">🎁 獎品：${escapeHtml(replay.prize)}</div>
      ` : ''}

      <div class="replay-meta">
        <span>房間 ${replay.roomCode}</span>
        <span>·</span>
        <span>${replay.players.length} 位玩家</span>
        <span>·</span>
        <span>${winnerCount} 位中獎</span>
        <span>·</span>
        <span>${finishedDate}</span>
      </div>

      <div class="avatar-row avatar-row-aligned" id="avatar-row" style="--n:${replay.players.length}">
        ${replay.players.map((p, i) => `
          <div class="avatar-cell" style="--i:${i}" data-player-id="${p.id}">
            ${renderAvatarHtml(p.avatar, p.nickname, p.colorIndex, 44)}
          </div>
        `).join('')}
      </div>

      <div class="canvas-area">
        <canvas id="ladder-canvas"></canvas>
      </div>

      <aside class="sidebar">
        <div class="sidebar-content">
          <div class="result-list" id="result-list"></div>
        </div>
      </aside>
    </div>
  `;

  const canvas = container.querySelector<HTMLCanvasElement>('#ladder-canvas');
  if (!canvas) return;

  const playState: PlayState = {
    revealed: [],
    animatingIndex: -1,
    animStart: 0,
    raf: null,
    finished: false,
  };

  const resultsByPid = new Map(replay.results.map(r => [r.playerId, r]));

  const draw = (): void => {
    if (playState.animatingIndex >= 0) {
      const elapsed = performance.now() - playState.animStart;
      const progress = Math.min(elapsed / ANIM_DURATION, 1);
      drawLadder({
        canvas,
        ladder: replay.ladder,
        players: replay.players,
        revealedResults: playState.revealed,
        myPlayerId: null,
        animatingIndex: playState.animatingIndex,
        animProgress: progress,
      });
      if (progress < 1) {
        playState.raf = requestAnimationFrame(draw);
      } else {
        playState.animatingIndex = -1;
        playState.raf = null;
        renderResultList();
      }
    } else {
      drawLadder({
        canvas,
        ladder: replay.ladder,
        players: replay.players,
        revealedResults: playState.revealed,
        myPlayerId: null,
      });
    }
  };

  const renderResultList = (): void => {
    const list = container.querySelector<HTMLDivElement>('#result-list');
    if (!list) return;
    list.innerHTML = playState.revealed.map((r, i) => {
      const player = replay.players[r.playerIndex];
      const name = player ? escapeHtml(player.nickname) : `玩家${r.playerIndex + 1}`;
      const cls = r.isWinner ? 'winner' : 'loser';
      const icon = r.isWinner ? '<span class="result-crown">★</span>' : `<span class="result-rank">${i + 1}</span>`;
      return `<div class="result-item ${cls}">${icon}<span class="result-name">${name}</span>${r.isWinner ? '<span style="font-size:0.72rem;color:var(--gold)">中獎</span>' : ''}</div>`;
    }).join('');
    // Mark cell as done
    container.querySelectorAll<HTMLElement>('.avatar-cell').forEach((cell) => {
      const pid = cell.dataset['playerId'];
      if (pid !== undefined && playState.revealed.some(r => r.playerId === pid)) {
        cell.classList.add('avatar-done');
      }
    });
  };

  const startPlayback = (): void => {
    timers.forEach(t => clearTimeout(t));
    timers = [];
    playState.revealed = [];
    playState.animatingIndex = -1;
    playState.finished = false;
    container.querySelectorAll<HTMLElement>('.avatar-cell').forEach((c) => c.classList.remove('avatar-done'));
    renderResultList();
    draw();

    replay.revealedPlayerIds.forEach((pid, i) => {
      const t = setTimeout(() => {
        const slot = resultsByPid.get(pid);
        if (!slot) return;
        playState.revealed = [...playState.revealed, slot];
        playState.animatingIndex = playState.revealed.length - 1;
        playState.animStart = performance.now();
        if (playState.raf !== null) cancelAnimationFrame(playState.raf);
        playState.raf = requestAnimationFrame(draw);
        const stepCount = Math.max(4, Math.min(16, slot.path.length));
        playClimb(stepCount, ANIM_DURATION);
        const tone = setTimeout(() => {
          if (slot.isWinner) playWinner(); else playLoser();
        }, ANIM_DURATION);
        timers.push(tone);
      }, i * (ANIM_DURATION + STEP_GAP));
      timers.push(t);
    });
  };

  // Static initial draw — no playback until user clicks ▶ (which also unlocks
  // audio context, so SFX play correctly from the very first reveal).
  if (resizeObs) resizeObs.disconnect();
  resizeObs = new ResizeObserver(() => {
    if (playState.animatingIndex < 0) draw();
  });
  resizeObs.observe(canvas.parentElement ?? canvas);
  draw();

  // Wire controls
  const playBtn = container.querySelector<HTMLButtonElement>('#replay-play');
  playBtn?.addEventListener('click', () => {
    if (playBtn) playBtn.disabled = true;
    void unlockAudio().then(() => {
      startPlayback();
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.textContent = '↻ 重新播放';
      }
    });
  });
  const muteBtn = container.querySelector<HTMLButtonElement>('#replay-mute');
  muteBtn?.addEventListener('click', () => {
    const m = toggleMuted();
    muteBtn.textContent = m ? '🔇' : '🔊';
    showToast(m ? '已靜音' : '已開啟音效', 'info');
  });
}

export function cleanupReplay(): void {
  if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
  timers.forEach(t => clearTimeout(t));
  timers = [];
}
