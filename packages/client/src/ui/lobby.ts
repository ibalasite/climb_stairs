import { setState } from '../state/store.js';
import { connect } from '../ws/client.js';
import { LocalStorageService } from '../state/LocalStorageService.js';

export function renderLobby(container: HTMLElement): void {
  // Read URL param and saved nickname before rendering
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomCode = urlParams.get('room')?.toUpperCase() ?? '';
  const savedNickname = LocalStorageService.getNickname();

  // Default: with invite link → host collapsed + join open. Without → host open + join collapsed.
  const cameFromInvite = urlRoomCode !== '';
  const hostCollapsed = cameFromInvite;
  const joinCollapsed = !cameFromInvite;
  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">爬樓梯抽獎</h1>
      <div class="lobby-cards">
        <div class="card collapsible-card${hostCollapsed ? ' collapsed' : ''}" id="host-card">
          <button class="collapsible-header" type="button" data-target="host-card">
            <span class="card-title">建立房間</span>
            <span class="collapsible-chevron">▾</span>
          </button>
          <div class="collapsible-body">
            <div class="field">
              <label for="host-nickname">你的暱稱（可空白，會自動取一個）</label>
              <input id="host-nickname" type="text" placeholder="輸入暱稱" maxlength="20" value="${escapeAttr(savedNickname)}" />
            </div>
            <div class="field">
              <label for="winner-count">中獎人數</label>
              <input id="winner-count" type="number" min="1" max="49" value="1" />
            </div>
            <p class="error-msg" id="host-error"></p>
            <button class="btn btn-primary" id="create-btn">建立房間</button>
          </div>
        </div>

        <div class="card collapsible-card${joinCollapsed ? ' collapsed' : ''}" id="join-card">
          <button class="collapsible-header" type="button" data-target="join-card">
            <span class="card-title">加入房間</span>
            <span class="collapsible-chevron">▾</span>
          </button>
          <div class="collapsible-body">
            <div class="field">
              <label for="room-code">房間代碼</label>
              <input id="room-code" type="text" placeholder="6位房間碼" maxlength="8" value="${escapeAttr(urlRoomCode)}" />
            </div>
            <div class="field">
              <label for="join-nickname">你的暱稱（可空白，會自動取一個）</label>
              <input id="join-nickname" type="text" placeholder="輸入暱稱" maxlength="20" value="${escapeAttr(savedNickname)}" />
            </div>
            <p class="error-msg" id="join-error"></p>
            <button class="btn btn-primary" id="join-btn">加入房間</button>
          </div>
        </div>
      </div>

      <div class="card replay-list-card" id="replay-list-card">
        <p class="card-title">🎬 最近開獎重播</p>
        <div id="replay-list">
          <p style="color:var(--text-dim);font-size:0.85rem">載入中…</p>
        </div>
      </div>
    </div>
  `;

  // Load recent replays
  void loadRecentReplays(container);

  // Collapsible cards — clicking the header toggles
  container.querySelectorAll<HTMLButtonElement>('.collapsible-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset['target'];
      if (targetId === undefined) return;
      const card = container.querySelector(`#${targetId}`);
      card?.classList.toggle('collapsed');
    });
  });

  const createBtn  = container.querySelector<HTMLButtonElement>('#create-btn')!;
  const joinBtn    = container.querySelector<HTMLButtonElement>('#join-btn')!;
  const hostError  = container.querySelector<HTMLParagraphElement>('#host-error')!;
  const joinError  = container.querySelector<HTMLParagraphElement>('#join-error')!;
  const roomCodeInput   = container.querySelector<HTMLInputElement>('#room-code')!;
  const joinNicknameInput = container.querySelector<HTMLInputElement>('#join-nickname')!;

  // Enable join button immediately if both fields are pre-filled
  function updateJoinButtonState(): void {
    const code = roomCodeInput.value.trim();
    const nick = joinNicknameInput.value.trim();
    joinBtn.disabled = !code || !nick;
  }
  updateJoinButtonState();
  roomCodeInput.addEventListener('input', updateJoinButtonState);
  joinNicknameInput.addEventListener('input', updateJoinButtonState);

  // Auto-uppercase room code
  roomCodeInput.addEventListener('input', () => {
    const sel = roomCodeInput.selectionStart;
    roomCodeInput.value = roomCodeInput.value.toUpperCase();
    roomCodeInput.setSelectionRange(sel, sel);
  });


  createBtn.addEventListener('click', async () => {
    const nicknameInput = container.querySelector<HTMLInputElement>('#host-nickname')!;
    let nickname = nicknameInput.value.trim();
    const winnerCount = parseInt((container.querySelector<HTMLInputElement>('#winner-count')!).value, 10);

    hostError.textContent = '';

    if (!nickname) {
      nickname = randomNickname();
      nicknameInput.value = nickname;
    }
    if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 49) {
      hostError.textContent = '中獎人數需在 1–49 之間';
      return;
    }

    createBtn.disabled = true;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostNickname: nickname, winnerCount }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '建立失敗' }));
        hostError.textContent = (err as { message: string }).message;
        return;
      }

      const data = await res.json() as { roomCode: string; playerId: string; token: string };
      LocalStorageService.setNickname(nickname);
      LocalStorageService.setPlayerId(data.playerId);
      setState({ myPlayerId: data.playerId, myToken: data.token });
      // Reflect room code in URL so the host can share via LINE / native share
      // sheet (which uses window.location.href).
      const shareUrl = `${window.location.pathname}?room=${data.roomCode}`;
      window.history.replaceState({}, '', shareUrl);
      connect(data.token);
      setState({ view: 'waiting' });
    } catch (e) {
      hostError.textContent = '網路錯誤，請重試';
    } finally {
      createBtn.disabled = false;
    }
  });

  joinBtn.addEventListener('click', async () => {
    const code     = roomCodeInput.value.trim().toUpperCase();
    let nickname = joinNicknameInput.value.trim();

    joinError.textContent = '';

    if (!code) { joinError.textContent = '請輸入房間代碼'; return; }
    if (!nickname) {
      nickname = randomNickname();
      joinNicknameInput.value = nickname;
    }

    joinBtn.disabled = true;
    try {
      const res = await fetch(`/api/rooms/${code}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '加入失敗' }));
        joinError.textContent = (err as { message: string }).message;
        return;
      }

      const data = await res.json() as { playerId: string; token: string };
      LocalStorageService.setNickname(nickname);
      LocalStorageService.setPlayerId(data.playerId);
      setState({ myPlayerId: data.playerId, myToken: data.token });
      const shareUrl = `${window.location.pathname}?room=${code}`;
      window.history.replaceState({}, '', shareUrl);
      connect(data.token);
      setState({ view: 'waiting' });
    } catch {
      joinError.textContent = '網路錯誤，請重試';
    } finally {
      updateJoinButtonState();
    }
  });

  // Allow Enter key on inputs
  container.querySelectorAll('input').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const card = input.closest('.card');
        card?.querySelector('button')?.click();
      }
    });
  });
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const NICKNAME_ANIMALS = ['獅子','老虎','小狗','貓咪','狐狸','熊貓','無尾熊','青蛙','猴子','兔子','倉鼠','企鵝','小鳥','獨角獸','蜜蜂','烏龜','鯨魚','蝴蝶','章魚','海豚','貓頭鷹','老鷹','斑馬','大象','長頸鹿','鸚鵡','刺蝟'];
function randomNickname(): string {
  const animal = NICKNAME_ANIMALS[Math.floor(Math.random() * NICKNAME_ANIMALS.length)] ?? '玩家';
  const num = Math.floor(Math.random() * 900) + 100;
  return `${animal}${num}`;
}

interface ReplaySummary {
  id: string;
  roomCode: string;
  prize?: string;
  playerCount: number;
  finishedAt: number;
}

async function loadRecentReplays(container: HTMLElement): Promise<void> {
  const list = container.querySelector<HTMLDivElement>('#replay-list');
  if (!list) return;
  try {
    const res = await fetch('/api/replays');
    if (!res.ok) {
      list.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem">無法載入重播列表</p>';
      return;
    }
    const data = await res.json() as { replays: ReplaySummary[] };
    if (data.replays.length === 0) {
      list.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem">尚無公開重播</p>';
      return;
    }
    list.innerHTML = data.replays.map((r) => {
      const when = new Date(r.finishedAt).toLocaleString();
      const prize = r.prize !== undefined && r.prize !== '' ? `🎁 ${escapeHtml(r.prize)}` : '<span style="color:var(--text-dim)">未設獎品</span>';
      return `
        <a class="replay-list-item" href="?replay=${r.id}">
          <span class="replay-list-room">${r.roomCode}</span>
          <span class="replay-list-prize">${prize}</span>
          <span class="replay-list-meta">${r.playerCount} 人 · ${when}</span>
        </a>
      `;
    }).join('');
  } catch {
    list.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem">網路錯誤</p>';
  }
}
