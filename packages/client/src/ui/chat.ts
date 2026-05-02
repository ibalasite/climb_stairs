import { state } from '../state/store.js';
import { send } from '../ws/client.js';
import { colorFromIndex } from '../canvas/colors.js';

interface ChatEntry {
  playerId: string;
  text: string;
  ts: number;
}

const MAX_HISTORY = 100;
const TICKER_DURATION_MS = 5000;
const history: ChatEntry[] = [];
let collapsed = false;
let mounted = false;
let unreadCount = 0;
let tickerTimer: ReturnType<typeof setTimeout> | null = null;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nicknameOf(playerId: string): { name: string; color: string } {
  const p = state.room?.players.find(x => x.id === playerId);
  if (!p) return { name: '???', color: '#888' };
  return { name: p.nickname, color: colorFromIndex(p.colorIndex) };
}

function renderHistory(): string {
  if (history.length === 0) {
    return '<div class="chat-empty">尚無訊息</div>';
  }
  return history.map((e) => {
    const { name, color } = nicknameOf(e.playerId);
    const isMe = e.playerId === state.myPlayerId;
    return `
      <div class="chat-line${isMe ? ' chat-line-me' : ''}">
        <span class="chat-name" style="color:${color}">${escapeHtml(name)}</span>
        <span class="chat-text">${escapeHtml(e.text)}</span>
      </div>
    `;
  }).join('');
}

export function appendChat(entry: ChatEntry): void {
  history.push(entry);
  if (history.length > MAX_HISTORY) history.shift();
  const list = document.querySelector<HTMLDivElement>('#chat-list');
  if (list) {
    list.innerHTML = renderHistory();
    list.scrollTop = list.scrollHeight;
  }
  // Show ticker preview + unread badge when collapsed and message isn't from self
  if (collapsed && entry.playerId !== state.myPlayerId) {
    unreadCount += 1;
    showTicker(entry);
    updateBadge();
  }
}

function showTicker(entry: ChatEntry): void {
  const ticker = document.querySelector<HTMLDivElement>('#chat-ticker');
  if (!ticker) return;
  const { name, color } = nicknameOf(entry.playerId);
  ticker.innerHTML = `
    <span class="chat-ticker-inner">
      <span class="chat-name" style="color:${color}">${escapeHtml(name)}</span>
      <span class="chat-text">${escapeHtml(entry.text)}</span>
    </span>
  `;
  ticker.classList.add('visible');
  if (tickerTimer) clearTimeout(tickerTimer);
  tickerTimer = setTimeout(() => {
    ticker.classList.remove('visible');
  }, TICKER_DURATION_MS);
}

function updateBadge(): void {
  const badge = document.querySelector<HTMLSpanElement>('#chat-badge');
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

export function ensureChatMounted(): void {
  // Re-parent if a sidebar slot exists and chat is currently in body (or vice
  // versa). This makes view transitions (waiting → game) move the chat.
  const slot = document.querySelector<HTMLElement>('#sidebar-chat-slot');
  const existing = document.getElementById('chat-widget');
  if (existing !== null) {
    const desiredParent = slot ?? document.body;
    if (existing.parentElement !== desiredParent) {
      desiredParent.appendChild(existing);
    }
    existing.classList.toggle('chat-embedded', slot !== null);
    updateVisibility();
    return;
  }
  const root = document.createElement('div');
  root.id = 'chat-widget';
  root.innerHTML = `
    <div class="chat-ticker" id="chat-ticker"></div>
    <div class="chat-header" id="chat-header">
      <span class="chat-title">
        聊天室<span class="chat-badge" id="chat-badge" style="display:none">0</span>
      </span>
      <button class="chat-toggle" id="chat-toggle" type="button" aria-label="收合/展開">▾</button>
    </div>
    <div class="chat-body" id="chat-body">
      <div class="chat-list" id="chat-list">${renderHistory()}</div>
      <form class="chat-form" id="chat-form">
        <input class="chat-input" id="chat-input" type="text" maxlength="200"
               placeholder="輸入訊息…" autocomplete="off" enterkeyhint="send" />
        <button class="chat-send" id="chat-send" type="submit" aria-label="送出">送出</button>
      </form>
    </div>
  `;
  (slot ?? document.body).appendChild(root);
  if (slot !== null) root.classList.add('chat-embedded');
  mounted = true;

  const toggle = root.querySelector<HTMLButtonElement>('#chat-toggle');
  const header = root.querySelector<HTMLDivElement>('#chat-header');
  const ticker = root.querySelector<HTMLDivElement>('#chat-ticker');
  const setCollapsed = (c: boolean): void => {
    collapsed = c;
    root.classList.toggle('collapsed', collapsed);
    if (toggle) toggle.textContent = collapsed ? '▴' : '▾';
    if (!collapsed) {
      unreadCount = 0;
      updateBadge();
      if (tickerTimer) { clearTimeout(tickerTimer); tickerTimer = null; }
      ticker?.classList.remove('visible');
      // Re-scroll to bottom on expand
      const list = root.querySelector<HTMLDivElement>('#chat-list');
      if (list) list.scrollTop = list.scrollHeight;
    }
  };
  const onToggle = (e: Event): void => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  };
  toggle?.addEventListener('click', onToggle);
  header?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id !== 'chat-toggle') onToggle(e);
  });
  // Tap ticker → expand
  ticker?.addEventListener('click', () => { if (collapsed) setCollapsed(false); });

  const form = root.querySelector<HTMLFormElement>('#chat-form');
  const input = root.querySelector<HTMLInputElement>('#chat-input');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input?.value.trim() ?? '';
    if (text === '') return;
    send('CHAT_MESSAGE', { text });
    if (input) input.value = '';
  });

  updateVisibility();
}

function updateVisibility(): void {
  const root = document.getElementById('chat-widget');
  if (!root) return;
  const inRoom = state.room !== null && state.view !== 'lobby';
  root.style.display = inRoom ? '' : 'none';
}

export function unmountChat(): void {
  const root = document.getElementById('chat-widget');
  if (root) root.remove();
  mounted = false;
  history.length = 0;
  collapsed = false;
}
