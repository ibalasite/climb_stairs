import { setState } from '../state/store.js';
import { connect } from '../ws/client.js';
import { LocalStorageService } from '../state/LocalStorageService.js';

export function renderLobby(container: HTMLElement): void {
  // Read URL param and saved nickname before rendering
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomCode = urlParams.get('room')?.toUpperCase() ?? '';
  const savedNickname = LocalStorageService.getNickname();

  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">爬樓梯抽獎</h1>
      <div class="lobby-cards">
        <div class="card" id="host-card">
          <p class="card-title">建立房間</p>
          <div class="field">
            <label for="host-nickname">你的暱稱</label>
            <input id="host-nickname" type="text" placeholder="輸入暱稱" maxlength="20" value="${escapeAttr(savedNickname)}" />
          </div>
          <div class="field">
            <label for="winner-count">中獎人數</label>
            <input id="winner-count" type="number" min="1" max="49" value="1" />
          </div>
          <p class="error-msg" id="host-error"></p>
          <button class="btn btn-primary" id="create-btn">建立房間</button>
        </div>

        <div class="card" id="join-card">
          <p class="card-title">加入房間</p>
          <div class="field">
            <label for="room-code">房間代碼</label>
            <input id="room-code" type="text" placeholder="6位房間碼" maxlength="8" value="${escapeAttr(urlRoomCode)}" />
          </div>
          <div class="field">
            <label for="join-nickname">你的暱稱</label>
            <input id="join-nickname" type="text" placeholder="輸入暱稱" maxlength="20" value="${escapeAttr(savedNickname)}" />
          </div>
          <p class="error-msg" id="join-error"></p>
          <button class="btn btn-ghost" id="join-btn">加入房間</button>
        </div>
      </div>
    </div>
  `;

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

  // Clean invite URL param from address bar once pre-filled (avoids stale param on reload)
  if (urlRoomCode) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }

  createBtn.addEventListener('click', async () => {
    const nickname    = (container.querySelector<HTMLInputElement>('#host-nickname')!).value.trim();
    const winnerCount = parseInt((container.querySelector<HTMLInputElement>('#winner-count')!).value, 10);

    hostError.textContent = '';

    if (!nickname) { hostError.textContent = '請輸入暱稱'; return; }
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
    const nickname = joinNicknameInput.value.trim();

    joinError.textContent = '';

    if (!code) { joinError.textContent = '請輸入房間代碼'; return; }
    if (!nickname) { joinError.textContent = '請輸入暱稱'; return; }

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

      const data = await res.json() as { roomCode: string; playerId: string; token: string };
      LocalStorageService.setNickname(nickname);
      LocalStorageService.setPlayerId(data.playerId);
      setState({ myPlayerId: data.playerId, myToken: data.token });
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
