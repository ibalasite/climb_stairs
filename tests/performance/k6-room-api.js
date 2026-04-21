/**
 * k6 HTTP Load Test — Ladder Room Online REST API
 *
 * Covers:
 *   POST /api/rooms       — 建立房間
 *   POST /api/rooms/:code/players — 加入房間
 *   GET  /api/rooms/:code — 查詢房間
 *   GET  /health          — 健康檢查
 *
 * Thresholds (§5 Performance Test Plan):
 *   P95 回應時間 < 500ms
 *   HTTP 錯誤率 < 1%
 *
 * Usage:
 *   k6 run tests/performance/k6-room-api.js
 *   BASE_URL=http://ladder.local k6 run tests/performance/k6-room-api.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ──── Custom Metrics ────
const roomCreationErrors = new Rate('room_creation_errors');
const playerJoinErrors = new Rate('player_join_errors');
const roomQueryErrors = new Rate('room_query_errors');
const roomCreationDuration = new Trend('room_creation_duration', true);
const playerJoinDuration = new Trend('player_join_duration', true);
const successfulRooms = new Counter('successful_rooms_created');
const successfulJoins = new Counter('successful_player_joins');

// ──── Test Options ────
export const options = {
  scenarios: {
    // Scenario 1: Ramp-up load test
    ramp_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },  // ramp up to 10 VUs
        { duration: '60s', target: 50 },  // sustained load at 50 VUs
        { duration: '10s', target: 0 },   // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // §5.2 HTTP API 壓測目標
    http_req_duration: ['p(95)<500', 'p(99)<2000'],  // P95 < 500ms, P99 < 2s
    http_req_failed: ['rate<0.01'],                   // < 1% errors
    room_creation_errors: ['rate<0.005'],             // < 0.5% room creation errors
    player_join_errors: ['rate<0.01'],                // < 1% join errors
    room_creation_duration: ['p(95)<500'],
    player_join_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Sanitize a nickname to meet the API constraint:
 * pattern /^[^\x00-\x1F\x7F]{1,20}$/
 */
function makeNickname(prefix, vu, iter) {
  return `${prefix}${vu}-${iter}`.substring(0, 20);
}

// ──── Main Test Function ────
export default function () {
  let roomCode = null;
  let hostToken = null;

  group('POST /api/rooms — 建立房間', function () {
    const payload = JSON.stringify({
      hostNickname: makeNickname('host-', __VU, __ITER),
      winnerCount: 1,
    });

    const res = http.post(`${BASE_URL}/api/rooms`, payload, {
      headers: JSON_HEADERS,
      tags: { endpoint: 'create_room' },
    });

    roomCreationDuration.add(res.timings.duration);

    const created = check(res, {
      'create room: status 201': (r) => r.status === 201,
      'create room: has roomCode': (r) => {
        try {
          return JSON.parse(r.body).roomCode !== undefined;
        } catch {
          return false;
        }
      },
      'create room: roomCode is 6 chars': (r) => {
        try {
          const body = JSON.parse(r.body);
          return typeof body.roomCode === 'string' && body.roomCode.length === 6;
        } catch {
          return false;
        }
      },
      'create room: has token': (r) => {
        try {
          return JSON.parse(r.body).token !== undefined;
        } catch {
          return false;
        }
      },
      'create room: room.status is waiting': (r) => {
        try {
          return JSON.parse(r.body).room.status === 'waiting';
        } catch {
          return false;
        }
      },
    });

    roomCreationErrors.add(!created);

    if (res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        roomCode = body.roomCode;
        hostToken = body.token;
        successfulRooms.add(1);
      } catch {
        roomCode = null;
      }
    }
  });

  if (roomCode === null) {
    sleep(1);
    return;
  }

  group('GET /api/rooms/:code — 查詢房間', function () {
    const res = http.get(`${BASE_URL}/api/rooms/${roomCode}`, {
      tags: { endpoint: 'get_room' },
    });

    const ok = check(res, {
      'get room: status 200': (r) => r.status === 200,
      'get room: code matches': (r) => {
        try {
          return JSON.parse(r.body).code === roomCode;
        } catch {
          return false;
        }
      },
      'get room: status is waiting': (r) => {
        try {
          return JSON.parse(r.body).status === 'waiting';
        } catch {
          return false;
        }
      },
    });

    roomQueryErrors.add(!ok);
  });

  group('POST /api/rooms/:code/players — 加入房間', function () {
    const payload = JSON.stringify({
      nickname: makeNickname('player-', __VU, __ITER),
    });

    const res = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/players`,
      payload,
      {
        headers: JSON_HEADERS,
        tags: { endpoint: 'join_room' },
      }
    );

    playerJoinDuration.add(res.timings.duration);

    const joined = check(res, {
      'join room: status 201': (r) => r.status === 201,
      'join room: has playerId': (r) => {
        try {
          return JSON.parse(r.body).playerId !== undefined;
        } catch {
          return false;
        }
      },
      'join room: has token': (r) => {
        try {
          return JSON.parse(r.body).token !== undefined;
        } catch {
          return false;
        }
      },
    });

    playerJoinErrors.add(!joined);
    if (res.status === 201) {
      successfulJoins.add(1);
    }
  });

  group('GET /health — 健康檢查', function () {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { endpoint: 'health' },
    });

    check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: status ok': (r) => {
        try {
          return JSON.parse(r.body).status === 'ok';
        } catch {
          return false;
        }
      },
      'health: redis ok': (r) => {
        try {
          return JSON.parse(r.body).redis === 'ok';
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}

// ──── Setup: Verify server is reachable before test ────
export function setup() {
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(
      `Server is not reachable at ${BASE_URL}. Health check returned ${res.status}.`
    );
  }
  console.log(`[k6-room-api] Server is up at ${BASE_URL}`);
  return { baseUrl: BASE_URL };
}

// ──── Teardown: Summary ────
export function teardown(data) {
  console.log(`[k6-room-api] Test complete. Target was: ${data.baseUrl}`);
}
