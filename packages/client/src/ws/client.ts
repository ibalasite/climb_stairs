import type {
  WsEventType,
  WsMsgType,
  Room,
  ResultSlot,
  RevealIndexPayload,
  RoomStateFullPayload,
  ErrorPayload,
} from '@ladder-room/shared';
import { setState, state } from '../state/store.js';
import { showToast } from '../ui/toast.js';
import { appendChat } from '../ui/chat.js';

type ConnState = 'connected' | 'connecting' | 'disconnected';

let ws: WebSocket | null = null;
let reconnectCount = 0;
const MAX_RECONNECT = 3;
const RECONNECT_DELAY_MS = 2000;
let pingInterval: ReturnType<typeof setInterval> | null = null;

export function getConnState(): ConnState {
  if (!ws) return 'disconnected';
  if (ws.readyState === WebSocket.OPEN) return 'connected';
  if (ws.readyState === WebSocket.CONNECTING) return 'connecting';
  return 'disconnected';
}

export function send(type: WsMsgType, payload?: unknown): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showToast('WebSocket not connected', 'error');
    return;
  }
  ws.send(JSON.stringify({ type, ts: Date.now(), payload: payload ?? {} }));
}

export function connect(token: string): void {
  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  reconnectCount = 0;
  _connect(token);
}

export function disconnect(): void {
  reconnectCount = MAX_RECONNECT + 1;
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = null;
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}

function _connect(token: string): void {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws?token=${encodeURIComponent(token)}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectCount = 0;
    startPing();
    setState({});
  };

  ws.onmessage = (ev: MessageEvent) => {
    let parsed: { type: WsEventType; payload: unknown };
    try {
      parsed = JSON.parse(ev.data as string) as { type: WsEventType; payload: unknown };
    } catch {
      return;
    }
    handleMessage(parsed.type, parsed.payload);
  };

  ws.onerror = () => {
    // onerror is always followed by onclose
  };

  ws.onclose = () => {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = null;
    setState({});
    if (reconnectCount < MAX_RECONNECT) {
      reconnectCount++;
      setTimeout(() => _connect(token), RECONNECT_DELAY_MS);
    } else {
      showToast('與伺服器的連線已中斷', 'error');
    }
  };
}

function startPing(): void {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      send('PING');
    }
  }, 25000);
}

function handleMessage(type: WsEventType, payload: unknown): void {
  switch (type) {
    case 'ROOM_STATE':
    case 'ROOM_STATE_FULL': {
      const p = payload as RoomStateFullPayload & {
        prize?: string;
        revealedPlayerIds?: readonly string[];
      };
      const room: Room = {
        code: p.code,
        status: p.status,
        hostId: p.hostId,
        players: p.players,
        winnerCount: p.winnerCount,
        ladder: (p as { ladder?: Room['ladder'] }).ladder ?? null,
        results: (p as { results?: Room['results'] }).results ?? null,
        revealedCount: p.revealedCount,
        revealMode: p.revealMode,
        autoRevealIntervalSec: p.autoRevealIntervalSec ?? null,
        kickedPlayerIds: (p as { kickedPlayerIds?: readonly string[] }).kickedPlayerIds ?? [],
        ...(p.prize !== undefined ? { prize: p.prize } : {}),
        ...(p.revealedPlayerIds !== undefined ? { revealedPlayerIds: p.revealedPlayerIds } : {}),
        createdAt: '',
        updatedAt: '',
      };

      const nextView = resolveView(room);
      const nextRevealed = buildRevealedFromRoom(room);
      setState({ room, view: nextView, revealedResults: nextRevealed });
      break;
    }

    case 'REVEAL_INDEX': {
      const p = payload as RevealIndexPayload;
      setState({
        revealedResults: [...state.revealedResults, p.result],
      });
      break;
    }

    case 'REVEAL_ALL': {
      const results = payload as { results: ResultSlot[] };
      setState({ revealedResults: results.results ?? [] });
      break;
    }

    case 'PLAYER_KICKED': {
      showToast('你已被踢出房間', 'error');
      disconnect();
      setState({
        view: 'lobby',
        myPlayerId: null,
        myToken: null,
        room: null,
        revealedResults: [],
      });
      break;
    }

    case 'SESSION_REPLACED': {
      showToast('你的帳號已在其他地方登入', 'error');
      disconnect();
      setState({ view: 'lobby', myPlayerId: null, myToken: null, room: null, revealedResults: [] });
      break;
    }

    case 'HOST_TRANSFERRED': {
      showToast('房主已轉移', 'success');
      break;
    }

    case 'REVEAL_PLAYER': {
      const p = payload as { result: ResultSlot };
      setState({ revealedResults: [...state.revealedResults, p.result] });
      break;
    }

    case 'REPLAY_AVAILABLE': {
      const p = payload as { replayId: string };
      setState({ lastReplayId: p.replayId });
      break;
    }

    case 'CHAT_BROADCAST': {
      const p = payload as { playerId: string; text: string; ts: number };
      appendChat(p);
      break;
    }

    case 'ERROR': {
      const err = payload as ErrorPayload;
      showToast(err.message ?? err.code, 'error');
      break;
    }
  }
}

function resolveView(room: Room): AppState['view'] {
  if (room.status === 'waiting') return 'waiting';
  return 'game';
}

function buildRevealedFromRoom(room: Room): ResultSlot[] {
  if (!room.results) return [];
  return room.results.slice(0, room.revealedCount) as ResultSlot[];
}

type AppState = import('../state/store.js').AppState;
