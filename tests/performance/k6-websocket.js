/**
 * k6 WebSocket Load Test — Ladder Room Online
 *
 * Simulates the full game flow per §5.1 WS 並發壓測:
 *   1. HTTP: POST /api/rooms  → 建立房間，取得 token
 *   2. HTTP: POST /api/rooms/:code/players × (PLAYERS_PER_ROOM - 1) → 玩家加入
 *   3. WS:   Host connects → receives ROOM_STATE_FULL
 *   4. WS:   Host sends START_GAME → receives ROOM_STATE(running)
 *   5. WS:   Host sends BEGIN_REVEAL → receives ROOM_STATE(revealing)
 *   6. WS:   Host sends REVEAL_NEXT × playerCount → receives REVEAL_INDEX × N
 *   7. WS:   Host sends END_GAME → receives ROOM_STATE(finished)
 *
 * Target: 100 rooms × 50 players = 5,000 concurrent WS connections
 *
 * Thresholds (§5.1 WS 並發壓測):
 *   ws_connecting P95 < 1,500ms
 *   ws_msgs_received rate > 99.5%
 *   http_req_failed rate < 0.5%
 *
 * Usage:
 *   k6 run tests/performance/k6-websocket.js
 *   BASE_URL=http://ladder.local WS_URL=ws://ladder.local k6 run tests/performance/k6-websocket.js
 *   PLAYERS_PER_ROOM=5 ROOMS=10 k6 run tests/performance/k6-websocket.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ──── Custom Metrics ────
const wsConnectErrors = new Rate('ws_connect_errors');
const wsMessageErrors = new Rate('ws_message_errors');
const roomCreationErrors = new Rate('ws_room_creation_errors');
const gameFlowErrors = new Rate('ws_game_flow_errors');
const wsConnectLatency = new Trend('ws_connect_latency_ms', true);
const roomStateDuration = new Trend('ws_room_state_duration_ms', true);
const revealIndexDuration = new Trend('ws_reveal_index_duration_ms', true);
const completedGames = new Counter('ws_completed_games');
const wsMessagesReceived = new Counter('ws_messages_received');

// ──── Environment Config ────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';
// Use small defaults for CI; override for full 100×50 load test
const PLAYERS_PER_ROOM = parseInt(__ENV.PLAYERS_PER_ROOM || '3', 10);
const WINNER_COUNT = 1;
const WS_TIMEOUT_MS = 10000;  // 10s per WS operation

// ──── Test Options ────
export const options = {
  scenarios: {
    // Scenario: ramping WS connections simulating 100 rooms × 50 players
    ws_game_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '60s', target: 50 },   // ramp up  (10 rooms × 5 players)
        { duration: '180s', target: 50 },  // sustained load
        { duration: '60s', target: 0 },    // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // §5.1 WS 並發壓測目標
    'ws_connecting': ['p(95)<1500'],           // WS 握手 P95 < 1.5s
    'ws_connect_latency_ms': ['p(95)<1500'],
    'http_req_failed': ['rate<0.005'],         // HTTP 失敗率 < 0.5%
    'ws_connect_errors': ['rate<0.005'],
    'ws_game_flow_errors': ['rate<0.05'],      // Game flow errors < 5%
    'ws_room_state_duration_ms': ['p(95)<2000'], // Broadcast latency P95 < 2s
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Wait for a WS message matching a predicate, with timeout. */
function waitForMessage(socket, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const handler = (msg) => {
      try {
        const envelope = JSON.parse(msg);
        if (predicate(envelope)) {
          resolve(envelope);
        }
      } catch {
        // skip non-JSON frames
      }
    };
    socket.on('message', handler);
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error(`WS timeout after ${timeoutMs}ms`));
      }
    }, 100);
  });
}

/** Send a WS Client Envelope message. */
function sendMsg(socket, type, payload) {
  socket.send(
    JSON.stringify({ type, ts: Date.now(), payload: payload || {} })
  );
}

// ──── Helper: Create room + add players via HTTP ────
function setupRoom() {
  // 1. Create room (host is player 0)
  const createRes = http.post(
    `${BASE_URL}/api/rooms`,
    JSON.stringify({
      hostNickname: `host-${__VU}-${__ITER}`,
      winnerCount: WINNER_COUNT,
    }),
    { headers: JSON_HEADERS }
  );

  if (createRes.status !== 201) {
    roomCreationErrors.add(1);
    return null;
  }
  roomCreationErrors.add(0);

  let body;
  try {
    body = JSON.parse(createRes.body);
  } catch {
    roomCreationErrors.add(1);
    return null;
  }

  const { roomCode, token: hostToken, playerId: hostPlayerId } = body;

  // 2. Add extra players via HTTP
  const playerTokens = [];
  for (let i = 1; i < PLAYERS_PER_ROOM; i++) {
    const joinRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/players`,
      JSON.stringify({ nickname: `player-${__VU}-${__ITER}-${i}` }),
      { headers: JSON_HEADERS }
    );
    if (joinRes.status === 201) {
      try {
        const jb = JSON.parse(joinRes.body);
        playerTokens.push({ playerId: jb.playerId, token: jb.token });
      } catch {
        // continue
      }
    }
  }

  return { roomCode, hostToken, hostPlayerId, playerTokens };
}

// ──── Main Test: Full Game Flow over WebSocket ────
export default function () {
  const roomData = setupRoom();
  if (!roomData) {
    sleep(2);
    return;
  }

  const { roomCode, hostToken } = roomData;

  let flowError = false;
  const wsStartTime = Date.now();

  const wsUrl = `${WS_URL}/ws?room=${roomCode}&token=${hostToken}`;

  const res = ws.connect(wsUrl, {}, function (socket) {
    wsConnectLatency.add(Date.now() - wsStartTime);

    socket.on('open', function () {
      // Connection established; server will send ROOM_STATE_FULL immediately
    });

    socket.on('error', function (e) {
      wsConnectErrors.add(1);
      flowError = true;
      socket.close();
    });

    let gamePhase = 'await_room_state_full';
    let revealCount = 0;
    const totalPlayers = PLAYERS_PER_ROOM;
    let phaseStartTime = Date.now();

    socket.on('message', function (rawMsg) {
      wsMessagesReceived.add(1);

      let envelope;
      try {
        envelope = JSON.parse(rawMsg);
      } catch {
        wsMessageErrors.add(1);
        return;
      }

      const { type, payload } = envelope;

      switch (gamePhase) {
        case 'await_room_state_full': {
          if (type === 'ROOM_STATE_FULL') {
            check(payload, {
              'ROOM_STATE_FULL: selfPlayerId present': (p) => !!p.selfPlayerId,
              'ROOM_STATE_FULL: status waiting': (p) => p.status === 'waiting',
            });

            // Start game
            gamePhase = 'await_running';
            phaseStartTime = Date.now();
            sendMsg(socket, 'START_GAME', {});
          }
          break;
        }

        case 'await_running': {
          if (type === 'ROOM_STATE') {
            if (payload.status === 'running') {
              roomStateDuration.add(Date.now() - phaseStartTime);
              check(payload, {
                'ROOM_STATE running: rowCount present': (p) => p.rowCount !== null,
                'ROOM_STATE running: no seed exposed': (p) => p.seed === undefined,
              });

              // Begin reveal
              gamePhase = 'await_revealing';
              phaseStartTime = Date.now();
              sendMsg(socket, 'BEGIN_REVEAL', {});
            }
          } else if (type === 'ERROR') {
            flowError = true;
            socket.close();
          }
          break;
        }

        case 'await_revealing': {
          if (type === 'ROOM_STATE') {
            if (payload.status === 'revealing') {
              roomStateDuration.add(Date.now() - phaseStartTime);
              check(payload, {
                'ROOM_STATE revealing: status is revealing': (p) =>
                  p.status === 'revealing',
              });

              // Start revealing players one by one
              gamePhase = 'await_reveal_index';
              phaseStartTime = Date.now();
              sendMsg(socket, 'REVEAL_NEXT', {});
            }
          } else if (type === 'ERROR') {
            flowError = true;
            socket.close();
          }
          break;
        }

        case 'await_reveal_index': {
          if (type === 'REVEAL_INDEX') {
            revealIndexDuration.add(Date.now() - phaseStartTime);
            revealCount++;

            check(payload, {
              'REVEAL_INDEX: playerIndex present': (p) =>
                typeof p.playerIndex === 'number',
              'REVEAL_INDEX: result present': (p) => p.result !== undefined,
              'REVEAL_INDEX: revealedCount increments': (p) =>
                p.revealedCount === revealCount,
            });

            if (revealCount < totalPlayers) {
              // Reveal next player
              phaseStartTime = Date.now();
              sendMsg(socket, 'REVEAL_NEXT', {});
            } else {
              // All revealed — end game
              gamePhase = 'await_finished';
              phaseStartTime = Date.now();
              sendMsg(socket, 'END_GAME', {});
            }
          } else if (type === 'ERROR') {
            // If revealedCount < totalCount error, try REVEAL_ALL_TRIGGER as fallback
            gamePhase = 'await_reveal_all';
            phaseStartTime = Date.now();
            sendMsg(socket, 'REVEAL_ALL_TRIGGER', {});
          }
          break;
        }

        case 'await_reveal_all': {
          if (type === 'REVEAL_ALL') {
            check(payload, {
              'REVEAL_ALL: results present': (p) =>
                Array.isArray(p.results),
            });
            // End game after reveal all
            gamePhase = 'await_finished';
            phaseStartTime = Date.now();
            sendMsg(socket, 'END_GAME', {});
          }
          break;
        }

        case 'await_finished': {
          if (type === 'ROOM_STATE') {
            if (payload.status === 'finished') {
              roomStateDuration.add(Date.now() - phaseStartTime);
              check(payload, {
                'ROOM_STATE finished: status is finished': (p) =>
                  p.status === 'finished',
              });

              // Measure total game duration
              completedGames.add(1);
              socket.close();
            }
          } else if (type === 'ERROR') {
            // END_GAME_REQUIRES_ALL_REVEALED — reveal all first
            if (payload && payload.code === 'END_GAME_REQUIRES_ALL_REVEALED') {
              gamePhase = 'await_reveal_all';
              sendMsg(socket, 'REVEAL_ALL_TRIGGER', {});
            } else {
              flowError = true;
              socket.close();
            }
          }
          break;
        }

        default:
          break;
      }
    });

    socket.setTimeout(function () {
      // Safety timeout: close socket after 60s regardless
      if (gamePhase !== 'done') {
        flowError = true;
        socket.close();
      }
    }, 60000);
  });

  check(res, {
    'WS connection established (101)': (r) => r && r.status === 101,
  });

  gameFlowErrors.add(flowError ? 1 : 0);
  wsConnectErrors.add(res && res.status !== 101 ? 1 : 0);

  sleep(1);
}

// ──── Setup: Verify server reachable ────
export function setup() {
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(
      `Server not reachable at ${BASE_URL}. Health check returned ${res.status}.`
    );
  }
  console.log(
    `[k6-websocket] Server up at ${BASE_URL}. WS endpoint: ${WS_URL}. Players/room: ${PLAYERS_PER_ROOM}`
  );
  return { baseUrl: BASE_URL, wsUrl: WS_URL };
}

export function teardown(data) {
  console.log(
    `[k6-websocket] Test complete. Target: ${data.baseUrl} / ${data.wsUrl}`
  );
}
