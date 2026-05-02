import { state, setRenderer, setState } from './state/store.js';
import { renderLobby } from './ui/lobby.js';
import { renderWaitingRoom } from './ui/waitingRoom.js';
import { renderGame, cleanupGame } from './ui/game.js';
import { renderReplay, cleanupReplay } from './ui/replay.js';
import { ensureChatMounted, unmountChat } from './ui/chat.js';

let currentView: string | null = null;

function render(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const { view } = state;

  // Cleanup previous game canvas observers when leaving game view
  if (currentView === 'game' && view !== 'game') {
    cleanupGame();
  }
  if (currentView === 'replay' && view !== 'replay') {
    cleanupReplay();
  }

  currentView = view;

  switch (view) {
    case 'lobby':
      renderLobby(app);
      unmountChat();
      break;

    case 'waiting':
      renderWaitingRoom(app);
      ensureChatMounted();
      break;

    case 'game':
      renderGame(app);
      ensureChatMounted();
      break;

    case 'replay': {
      unmountChat();
      const id = new URLSearchParams(window.location.search).get('replay') ?? '';
      void renderReplay(app, id);
      break;
    }

    default:
      renderLobby(app);
      unmountChat();
  }
}

// Register the renderer so setState can trigger re-renders
setRenderer(render);

// Initial route — ?replay=ID enters replay view, otherwise default lobby
const initialReplayId = new URLSearchParams(window.location.search).get('replay');
if (initialReplayId !== null && initialReplayId !== '') {
  setState({ view: 'replay' });
} else {
  render();
}
