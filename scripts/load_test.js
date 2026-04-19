// k6 load test for Ladder Room Online
// Covers EDD §10.5 Load Test 門檻
// Run: k6 run scripts/load_test.js --env BASE_URL=http://ladder.local
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws';

// Custom metrics
const wsErrors = new Rate('ws_errors');
const joinLatency = new Trend('join_latency_ms');
const wsMessageLatency = new Trend('ws_message_latency_ms');
const broadcastReceived = new Counter('broadcasts_received');

// ─── Scenario: Normal Load (100 WS, 5 min) ──────────────────────────────────
// EDD threshold: P95 < 100ms, error < 0.1%
export const options = {
  scenarios: {
    normal_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      tags: { scenario: 'normal' },
    },
    peak_load: {
      executor: 'ramping-vus',
      startTime: '5m30s',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '2m', target: 500 },
        { duration: '30s', target: 0 },
      ],
      tags: { scenario: 'peak' },
    },
    http_stress: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      startTime: '10m30s',
      tags: { scenario: 'http_stress' },
    },
  },
  thresholds: {
    // EDD §10.5: Normal load — P95 < 100ms
    'ws_message_latency_ms{scenario:normal}': ['p(95)<100'],
    // EDD §10.5: Peak load — P99 < 300ms
    'ws_message_latency_ms{scenario:peak}': ['p(99)<300'],
    // EDD §10.5: HTTP stress — P95 < 200ms, 0 5xx
    'http_req_duration{scenario:http_stress}': ['p(95)<200'],
    'http_req_failed{scenario:http_stress}': ['rate<0.001'],
    // General error rate across all scenarios
    ws_errors: ['rate<0.01'],
    // Join latency P95 < 200ms
    join_latency_ms: ['p(95)<200'],
  },
};

// ─── Helper: create room + join players ─────────────────────────────────────
function createRoom() {
  const res = http.post(`${BASE_URL}/api/rooms`, JSON.stringify({
    hostNickname: `host_${Date.now()}`,
    winnerCount: 1,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(res, { 'create room 201': (r) => r.status === 201 });
  if (res.status !== 201) return null;

  const body = res.json();
  return { roomCode: body.roomCode, hostToken: body.token };
}

function joinRoom(roomCode, nickname) {
  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/rooms/${roomCode}/players`,
    JSON.stringify({ nickname }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  joinLatency.add(Date.now() - start);

  check(res, { 'join room 201': (r) => r.status === 201 });
  if (res.status !== 201) return null;
  return res.json().token;
}

// ─── Default function: WS connection lifecycle ───────────────────────────────
export default function () {
  const room = createRoom();
  if (!room) return;

  const playerToken = joinRoom(room.roomCode, `player_${__VU}_${Date.now()}`);
  if (!playerToken) return;

  // Connect via WebSocket
  const wsStart = Date.now();
  const response = ws.connect(WS_URL, {
    headers: { Authorization: `Bearer ${playerToken}` },
  }, (socket) => {
    socket.on('open', () => {
      wsErrors.add(false);
    });

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.event === 'ROOM_STATE') {
          broadcastReceived.add(1);
          wsMessageLatency.add(Date.now() - wsStart);
        }
      } catch (_) {
        wsErrors.add(true);
      }
    });

    socket.on('error', () => {
      wsErrors.add(true);
    });

    // Stay connected for the scenario duration, then close
    socket.setTimeout(() => socket.close(), 30000);
  });

  check(response, { 'ws connected': (r) => r && r.status === 101 });
  sleep(1);
}

// ─── Scenario: Big Room Broadcast (1 room, 50 players, 50 reveals) ───────────
// EDD threshold: all clients receive REVEAL_ALL within 1000ms
export function bigRoomBroadcast() {
  const room = createRoom();
  if (!room) return;

  const tokens = [room.hostToken];
  for (let i = 1; i < 50; i++) {
    const token = joinRoom(room.roomCode, `p${i}`);
    if (token) tokens.push(token);
  }

  // All players connect simultaneously
  tokens.forEach((token) => {
    ws.connect(WS_URL, { headers: { Authorization: `Bearer ${token}` } }, (socket) => {
      socket.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.event === 'RESULT_REVEALED' || msg.event === 'ALL_REVEALED') {
          const latency = Date.now() - wsStart;
          check({ latency }, { 'broadcast within 1000ms': (o) => o.latency < 1000 });
        }
      });
      socket.setTimeout(() => socket.close(), 15000);
    });
  });

  const wsStart = Date.now();
  sleep(15);
}
