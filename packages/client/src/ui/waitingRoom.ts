import { state } from '../state/store.js';
import { send } from '../ws/client.js';
import { showToast } from './toast.js';
import { colorFromIndex } from '../canvas/colors.js';
import { renderAvatarHtml, fileToAvatarDataUri } from './avatar.js';

function buildInviteUrl(roomCode: string): string {
  return `${window.location.origin}/?room=${roomCode}`;
}

async function copyInviteLink(roomCode: string, btn: HTMLButtonElement): Promise<void> {
  const url = buildInviteUrl(roomCode);
  const original = btn.textContent ?? '複製邀請連結';

  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = '✓ 已複製！';
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch {
    // Fallback: show selectable input
    showFallbackInput(url, btn);
  }
}

function showFallbackInput(url: string, anchor: HTMLElement): void {
  const existing = document.getElementById('invite-fallback-input');
  if (existing) { existing.remove(); return; }

  const input = document.createElement('input');
  input.id = 'invite-fallback-input';
  input.type = 'text';
  input.value = url;
  input.readOnly = true;
  input.className = 'invite-fallback';
  input.style.cssText = 'width:100%;margin-top:8px;font-size:0.8rem;padding:6px 8px;border:1px solid var(--border,#ccc);border-radius:6px;';

  anchor.insertAdjacentElement('afterend', input);
  input.focus();
  input.select();
}

export function renderWaitingRoom(container: HTMLElement): void {
  const { room, myPlayerId } = state;

  if (!room) {
    container.innerHTML = '<div class="page"><p>載入中…</p></div>';
    return;
  }

  const isHost        = room.hostId === myPlayerId;
  const canStart      = isHost && room.players.length >= 2;
  const onlinePlayers = room.players.filter((p) => p.isOnline).length;

  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">等待大廳</h1>

      ${room.prize !== undefined && room.prize !== '' ? `
        <div class="prize-banner" style="margin:0 0 1rem">🎁 獎品：${escapeHtml(room.prize)}</div>
      ` : ''}

      <div class="card">
        <div class="room-code-box" id="copy-code" title="點擊複製房間代碼">
          <p class="room-code-label">房間代碼</p>
          <p class="room-code-value">${room.code}</p>
          <p class="room-code-hint">點擊複製代碼</p>
        </div>
        ${isHost ? `
        <button class="btn btn-secondary" id="copy-invite-btn" style="width:100%;margin-top:8px">
          複製邀請連結
        </button>
        ` : ''}

        <div class="divider"></div>

        <div class="info-row">
          <span>玩家數量</span>
          <strong>${room.players.length} 人 (${onlinePlayers} 上線)</strong>
        </div>
        ${room.winnerCount !== null ? `
        <div class="info-row">
          <span>中獎人數</span>
          ${isHost ? `
            <span class="winner-count-stepper">
              <button class="btn btn-sm btn-ghost" id="wc-dec" type="button" aria-label="減少">−</button>
              <strong class="winner-count-display" style="color:var(--gold);min-width:3.2em;text-align:center">${room.winnerCount} 人</strong>
              <button class="btn btn-sm btn-ghost" id="wc-inc" type="button" aria-label="增加">＋</button>
            </span>
          ` : `<strong class="winner-count-display" style="color:var(--gold)">${room.winnerCount} 人</strong>`}
        </div>
        ` : ''}
        <div class="info-row">
          <span>你的角色</span>
          <strong>${isHost ? '🎮 房主' : '玩家'}</strong>
        </div>

        <div class="divider"></div>

        <p class="sidebar-title">獎品</p>
        ${isHost ? `
          <div class="prize-edit">
            <input id="prize-input" type="text" maxlength="120"
                   placeholder="例：一個擁抱、星巴克卡、$500"
                   value="${escapeAttr(room.prize ?? '')}" />
            <button class="btn btn-sm btn-secondary" id="prize-save">儲存</button>
          </div>
        ` : `
          <p class="prize-display">${room.prize ? escapeHtml(room.prize) : '<span style="color:var(--text-dim)">尚未設定</span>'}</p>
        `}

        <div class="divider"></div>

        <p class="sidebar-title">玩家列表（點自己頭像可換頭像）</p>
        <div class="player-list" id="player-list">
          ${renderPlayerList(room.players, myPlayerId, room.hostId, isHost, room.code)}
        </div>

        ${isHost ? `
        <button class="btn btn-primary" id="start-btn" ${canStart ? '' : 'disabled'}>
          ${canStart ? '開始遊戲' : `需要至少 2 位玩家 (目前 ${room.players.length})`}
        </button>
        ` : '<p style="color:var(--text-dim);font-size:0.85rem;text-align:center">等待房主開始遊戲…</p>'}
      </div>
    </div>
  `;

  // Copy room code (short code only)
  container.querySelector('#copy-code')?.addEventListener('click', () => {
    navigator.clipboard.writeText(room.code).then(() => {
      showToast('已複製房間代碼', 'success');
    }).catch(() => {
      showToast(room.code, 'info');
    });
  });

  // Copy full invite link (host only)
  const inviteBtn = container.querySelector<HTMLButtonElement>('#copy-invite-btn');
  if (inviteBtn) {
    inviteBtn.addEventListener('click', () => copyInviteLink(room.code, inviteBtn));
  }

  // Winner count stepper (host only)
  if (isHost && room.winnerCount !== null) {
    const wcDec = container.querySelector<HTMLButtonElement>('#wc-dec');
    const wcInc = container.querySelector<HTMLButtonElement>('#wc-inc');
    const maxWinner = Math.max(1, room.players.length - 1);
    if (wcDec) {
      wcDec.disabled = room.winnerCount <= 1;
      wcDec.addEventListener('click', () => {
        if (room.winnerCount !== null && room.winnerCount > 1) {
          send('SET_WINNER_COUNT', { winnerCount: room.winnerCount - 1 });
        }
      });
    }
    if (wcInc) {
      wcInc.disabled = room.winnerCount >= maxWinner;
      wcInc.addEventListener('click', () => {
        if (room.winnerCount !== null && room.winnerCount < maxWinner) {
          send('SET_WINNER_COUNT', { winnerCount: room.winnerCount + 1 });
        }
      });
    }
  }

  // Start game
  container.querySelector('#start-btn')?.addEventListener('click', () => {
    send('START_GAME');
  });

  // Kick player buttons (host only)
  if (isHost) {
    container.querySelectorAll<HTMLButtonElement>('.kick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset['playerId'];
        if (targetId) {
          send('KICK_PLAYER', { playerId: targetId });
        }
      });
    });

    // Prize save
    const prizeInput = container.querySelector<HTMLInputElement>('#prize-input');
    const prizeSave = container.querySelector<HTMLButtonElement>('#prize-save');
    prizeSave?.addEventListener('click', () => {
      if (prizeInput) send('SET_PRIZE', { prize: prizeInput.value });
    });
    prizeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') prizeSave?.click();
    });
  }

  // Avatar upload — clicking own avatar opens file picker
  const myAvatarWrap = container.querySelector<HTMLSpanElement>('.player-avatar-me');
  if (myAvatarWrap) {
    myAvatarWrap.style.cursor = 'pointer';
    myAvatarWrap.title = '點擊上傳頭像';
    myAvatarWrap.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        fileToAvatarDataUri(file).then((dataUri) => {
          send('SET_AVATAR', { avatar: dataUri });
        }).catch((err: unknown) => {
          showToast(err instanceof Error ? err.message : '上傳失敗', 'error');
        });
      });
      input.click();
    });
  }
}

function renderPlayerList(
  players: readonly import('@ladder-room/shared').Player[],
  myPlayerId: string | null,
  hostId: string,
  isHost: boolean,
  _roomCode: string,
): string {
  return players.map((p) => {
    const isMe     = p.id === myPlayerId;
    const isPlayerHost = p.id === hostId;
    const avatarHtml = renderAvatarHtml(p.avatar, p.nickname, p.colorIndex, 36);

    return `
      <div class="player-item">
        <span class="player-avatar-wrap${isMe ? ' player-avatar-me' : ''}" data-self="${isMe ? '1' : '0'}">
          ${avatarHtml}
          ${!p.isOnline ? '<span class="player-avatar-offline-tag">離線</span>' : ''}
        </span>
        <span class="player-name">${escapeHtml(p.nickname)}${isMe ? ' <span style="font-size:0.72rem;color:var(--accent)">(你)</span>' : ''}</span>
        ${isPlayerHost ? '<span class="player-badge">房主</span>' : ''}
        ${isHost && !isMe ? `<button class="btn btn-sm btn-danger kick-btn" data-player-id="${p.id}" style="margin-left:auto">踢除</button>` : ''}
      </div>
    `;
  }).join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
