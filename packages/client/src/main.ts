import { state, setRenderer } from './state/store.js';
import { renderLobby } from './ui/lobby.js';
import { renderWaitingRoom } from './ui/waitingRoom.js';
import { renderGame, cleanupGame } from './ui/game.js';

let currentView: string | null = null;

function render(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const { view } = state;

  // Cleanup previous game canvas observers when leaving game view
  if (currentView === 'game' && view !== 'game') {
    cleanupGame();
  }

  currentView = view;

  switch (view) {
    case 'lobby':
      renderLobby(app);
      break;

    case 'waiting':
      renderWaitingRoom(app);
      break;

    case 'game':
      renderGame(app);
      break;

    default:
      renderLobby(app);
  }
}

// Register the renderer so setState can trigger re-renders
setRenderer(render);

// Initial render
render();
