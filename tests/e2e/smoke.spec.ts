/**
 * E2E Smoke Tests — climb_stairs (梯子遊戲)
 *
 * Priority flows:
 *   1. Health check — GET /health
 *   2. Create room  — POST /api/rooms
 *   3. Join room    — POST /api/rooms/:code/players
 *   4. Get room     — GET  /api/rooms/:code
 *   5. UI smoke     — http://localhost:5173 loads without JS errors
 *   6. UI lobby     — Create room through the UI
 *
 * Behaviour contract:
 *   - If the API server (port 3000) is not reachable, all API tests are skipped
 *     and reported as "server not running".
 *   - If the UI server (port 5173) is not reachable, UI tests are skipped.
 *   - No Redis is required by the test suite itself; Redis absence surfaces as
 *     a runtime error from the server (in which case affected tests are marked).
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';
import * as http from 'node:http';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3000';
const UI_BASE  = 'http://localhost:5173';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Probe a URL with Node's built-in http module to avoid the Playwright
 * request fixture's project-scope timeout issue in beforeAll hooks.
 */
function probeUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 0) < 600);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ─── Suite 1: API smoke tests ─────────────────────────────────────────────────

test.describe('API smoke — server on :3000', () => {
  let serverUp = false;
  let redisUp  = false;

  test.beforeAll(async () => {
    serverUp = await probeUrl(`${API_BASE}/health`);
    if (serverUp) {
      // Also detect Redis availability by checking the health response body
      const ctx = await playwrightRequest.newContext();
      try {
        const res = await ctx.get(`${API_BASE}/health`, { timeout: 5000 });
        const body = await res.json() as Record<string, unknown>;
        redisUp = body['redis'] === 'ok';
        console.log(`[INFO] Server up, Redis: ${String(body['redis'])}`);
      } catch { /* ignore */ } finally {
        await ctx.dispose();
      }
    } else {
      console.log('[SKIP] API server not running on port 3000 — all API tests skipped');
    }
  });

  // ── 1. Health check ────────────────────────────────────────────────────────
  test('GET /health returns 200 with status ok', async ({ request }) => {
    test.skip(!serverUp, 'Server not running on :3000');

    const res = await request.get(`${API_BASE}/health`);

    expect(res.status()).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(body['status']).toBe('ok');
    // redis field is present and is a string
    expect(typeof body['redis']).toBe('string');
    // uptime is a non-negative number
    expect(typeof body['uptime']).toBe('number');
    expect(body['uptime'] as number).toBeGreaterThanOrEqual(0);
  });

  // ── 2. Create room ─────────────────────────────────────────────────────────
  test('POST /api/rooms returns 201 with 6-char roomCode', async ({ request }) => {
    test.skip(!serverUp, 'Server not running on :3000');
    test.skip(!redisUp, 'Redis not available — room creation requires Redis');

    const res = await request.post(`${API_BASE}/api/rooms`, {
      data: { hostNickname: 'TestHost', winnerCount: 1 },
    });

    expect(res.status()).toBe(201);

    const body = await res.json() as Record<string, unknown>;
    const roomCode = body['roomCode'] as string;

    expect(typeof roomCode).toBe('string');
    expect(roomCode).toHaveLength(6);
    // roomCode must match the custom alphabet used in the game
    expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(typeof body['playerId']).toBe('string');
    expect(typeof body['token']).toBe('string');
  });

  // ── 3 & 4. Join room + Get room state ─────────────────────────────────────
  test('POST /api/rooms/:code/players returns JWT; GET /api/rooms/:code returns waiting status', async ({ request }) => {
    test.skip(!serverUp, 'Server not running on :3000');
    test.skip(!redisUp, 'Redis not available — room creation requires Redis');

    // Step 1: create a room
    const createRes = await request.post(`${API_BASE}/api/rooms`, {
      data: { hostNickname: 'Alice', winnerCount: 1 },
    });

    expect(createRes.status()).toBe(201);
    const createBody = await createRes.json() as Record<string, unknown>;
    const roomCode = createBody['roomCode'] as string;
    expect(typeof roomCode).toBe('string');
    expect(roomCode).toHaveLength(6);

    // Step 2: join the room as Bob
    const joinRes = await request.post(`${API_BASE}/api/rooms/${roomCode}/players`, {
      data: { nickname: 'Bob' },
    });

    expect(joinRes.status()).toBe(201);
    const joinBody = await joinRes.json() as Record<string, unknown>;
    expect(typeof joinBody['playerId']).toBe('string');
    expect(typeof joinBody['token']).toBe('string');

    // Step 3: get room state
    const roomRes = await request.get(`${API_BASE}/api/rooms/${roomCode}`);

    expect(roomRes.status()).toBe(200);
    const roomBody = await roomRes.json() as Record<string, unknown>;
    expect(roomBody['status']).toBe('waiting');
    expect(roomBody['code']).toBe(roomCode);
    // Should have at least 2 players (host + Bob)
    expect(typeof roomBody['playerCount']).toBe('number');
    expect(roomBody['playerCount'] as number).toBeGreaterThanOrEqual(2);
  });

  // ── Room not found ─────────────────────────────────────────────────────────
  test('GET /api/rooms/ZZZZZZ returns 404 ROOM_NOT_FOUND', async ({ request }) => {
    test.skip(!serverUp, 'Server not running on :3000');
    test.skip(!redisUp, 'Redis not available — room lookup requires Redis');

    const res = await request.get(`${API_BASE}/api/rooms/ZZZZZZ`);

    expect(res.status()).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('ROOM_NOT_FOUND');
  });

  // ── Validation error on missing fields ───────────────────────────────────
  test('POST /api/rooms without body returns 400 VALIDATION_ERROR', async ({ request }) => {
    test.skip(!serverUp, 'Server not running on :3000');

    // This test does NOT need Redis — validation happens before Redis is hit
    const res = await request.post(`${API_BASE}/api/rooms`, {
      data: {},
    });

    expect(res.status()).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('VALIDATION_ERROR');
  });
});

// ─── Suite 2: UI smoke tests ──────────────────────────────────────────────────

test.describe('UI smoke — client on :5173', () => {
  let clientUp = false;

  test.beforeAll(async () => {
    clientUp = await probeUrl(UI_BASE);
    if (!clientUp) {
      console.log('[SKIP] UI dev server not running on port 5173 — all UI tests skipped');
    }
  });

  // ── Page loads ─────────────────────────────────────────────────────────────
  test('Lobby page loads without JS errors', async ({ page }) => {
    test.skip(!clientUp, 'UI server not running on :5173');

    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto(UI_BASE, { waitUntil: 'networkidle', timeout: 10_000 });

    // Title
    await expect(page).toHaveTitle(/爬樓梯抽獎/);

    // Main heading
    const heading = page.locator('h1.page-title');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('爬樓梯');

    // Create room card
    await expect(page.locator('#host-card')).toBeVisible();
    await expect(page.locator('#create-btn')).toBeVisible();

    // Join room card
    await expect(page.locator('#join-card')).toBeVisible();
    await expect(page.locator('#join-btn')).toBeVisible();

    // No JS errors
    expect(jsErrors, `JS errors on lobby load: ${jsErrors.join('; ')}`).toHaveLength(0);
  });

  // ── Input fields exist and accept input ───────────────────────────────────
  test('Lobby form inputs are functional', async ({ page }) => {
    test.skip(!clientUp, 'UI server not running on :5173');

    await page.goto(UI_BASE, { waitUntil: 'networkidle', timeout: 10_000 });

    // Host nickname input
    const hostNicknameInput = page.locator('#host-nickname');
    await expect(hostNicknameInput).toBeVisible();
    await hostNicknameInput.fill('TestPlayer');
    await expect(hostNicknameInput).toHaveValue('TestPlayer');

    // Winner count input
    const winnerCountInput = page.locator('#winner-count');
    await expect(winnerCountInput).toBeVisible();
    await winnerCountInput.fill('3');
    await expect(winnerCountInput).toHaveValue('3');

    // Room code input
    const roomCodeInput = page.locator('#room-code');
    await expect(roomCodeInput).toBeVisible();
    await roomCodeInput.fill('abc123');
    // Auto-uppercasing should apply
    await expect(roomCodeInput).toHaveValue('ABC123');
  });

  // ── Create room via UI (only when both servers are up) ────────────────────
  test('Create room through UI flow navigates to waiting room', async ({ page }) => {
    test.skip(!clientUp, 'UI server not running on :5173');

    // This test requires the API server with Redis too
    const apiUp    = await probeUrl(`${API_BASE}/health`);
    test.skip(!apiUp, 'API server not running on :3000 — skipping UI create room flow');

    // Check Redis availability
    const ctx = await playwrightRequest.newContext();
    let hasRedis = false;
    try {
      const res = await ctx.get(`${API_BASE}/health`, { timeout: 5000 });
      const body = await res.json() as Record<string, unknown>;
      hasRedis = body['redis'] === 'ok';
    } catch { /* ignore */ } finally {
      await ctx.dispose();
    }
    test.skip(!hasRedis, 'Redis not available — UI create room requires Redis');

    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto(UI_BASE, { waitUntil: 'networkidle', timeout: 10_000 });

    // Fill in host nickname
    await page.locator('#host-nickname').fill('UITestHost');

    // Set winner count to 1
    await page.locator('#winner-count').fill('1');

    // Click create
    await page.locator('#create-btn').click();

    // Wait for navigation to waiting room (the view changes from lobby to
    // waiting — the waiting room renders a room-code-box element)
    await page.locator('.room-code-box').waitFor({ state: 'visible', timeout: 8_000 });

    // Confirm we are on the waiting room view
    await expect(page.locator('.room-code-value')).toBeVisible();
    const displayedCode = await page.locator('.room-code-value').textContent();
    expect(displayedCode?.trim()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // No unexpected JS errors during the flow
    expect(jsErrors, `JS errors during create-room flow: ${jsErrors.join('; ')}`).toHaveLength(0);
  });
});
