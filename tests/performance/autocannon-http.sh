#!/usr/bin/env bash
# =============================================================================
# autocannon-http.sh — HTTP Benchmark for Ladder Room Online REST API
#
# Uses autocannon to measure throughput and latency for key REST endpoints.
# Targets from §5.2 HTTP API 壓測:
#   POST /api/rooms        → P99 < 2s, success rate > 99.5%
#   POST /api/rooms/:code/players → P99 < 2s, success rate > 99.5%
#   GET  /api/rooms/:code  → P99 < 2s
#
# Usage:
#   bash tests/performance/autocannon-http.sh
#   BASE_URL=http://ladder.local bash tests/performance/autocannon-http.sh
#
# Prerequisites:
#   Node.js 20+ installed
#   npx available (comes with npm 5.2+)
#   Server running and healthy at BASE_URL
# =============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CONNECTIONS="${CONNECTIONS:-50}"      # concurrent connections
DURATION="${DURATION:-30}"           # seconds
PIPELINING="${PIPELINING:-10}"       # HTTP pipelining factor

echo "========================================================"
echo " Ladder Room Online — HTTP Benchmark (autocannon)"
echo "========================================================"
echo " BASE_URL     : ${BASE_URL}"
echo " Connections  : ${CONNECTIONS}"
echo " Duration     : ${DURATION}s"
echo " Pipelining   : ${PIPELINING}"
echo "========================================================"
echo ""

# ── Prerequisite check ──────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "ERROR: node not found. Install Node.js 20+." >&2
  exit 1
fi

# Health check before running benchmarks
echo ">> Checking server health at ${BASE_URL}/health ..."
STATUS=$(node -e "
const http = require('http');
const url = new URL('/health', '${BASE_URL}');
const req = http.get({ host: url.hostname, port: url.port || 3000, path: url.pathname }, (res) => {
  process.stdout.write(String(res.statusCode));
  process.exit(0);
});
req.on('error', () => { process.stdout.write('0'); process.exit(1); });
" 2>/dev/null || echo "0")

if [ "$STATUS" != "200" ]; then
  echo "ERROR: Server health check failed (status=${STATUS}). Is the server running?" >&2
  exit 1
fi
echo ">> Server is healthy. Starting benchmarks..."
echo ""

# ── Benchmark 1: POST /api/rooms ────────────────────────────
echo "────────────────────────────────────────────────────────"
echo "BENCHMARK 1: POST /api/rooms — 建立房間"
echo "Target: P99 < 2s, success rate > 99.5%"
echo "────────────────────────────────────────────────────────"
npx --yes autocannon \
  --connections "${CONNECTIONS}" \
  --duration "${DURATION}" \
  --pipelining "${PIPELINING}" \
  --method POST \
  --header "Content-Type: application/json" \
  --body '{"hostNickname":"bench-host","winnerCount":1}' \
  --json \
  "${BASE_URL}/api/rooms" \
  | node -e "
const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString());
    console.log('Requests/sec  :', result.requests.average);
    console.log('Latency P50   :', result.latency.p50, 'ms');
    console.log('Latency P97.5 :', result.latency.p97_5, 'ms');
    console.log('Latency P99   :', result.latency.p99, 'ms');
    console.log('Non-2xx       :', result.non2xx, '/', result.requests.total, 'requests');
    const errorRate = result.non2xx / result.requests.total;
    if (result.latency.p99 > 2000) {
      console.warn('WARNING: P99 latency exceeds 2000ms threshold!');
    }
    if (errorRate > 0.005) {
      console.warn('WARNING: Error rate', (errorRate*100).toFixed(2) + '%', 'exceeds 0.5% threshold!');
    } else {
      console.log('PASS: Error rate', (errorRate*100).toFixed(2) + '%', '< 0.5%');
    }
  } catch(e) {
    console.error('Failed to parse autocannon output:', e.message);
  }
});" \
  2>/dev/null || echo "(JSON output unavailable — raw output above)"

echo ""

# ── Benchmark 2: GET /health ─────────────────────────────────
echo "────────────────────────────────────────────────────────"
echo "BENCHMARK 2: GET /health — 健康檢查 (Baseline)"
echo "────────────────────────────────────────────────────────"
npx autocannon \
  --connections "${CONNECTIONS}" \
  --duration "${DURATION}" \
  --pipelining "${PIPELINING}" \
  --method GET \
  "${BASE_URL}/health" \
  2>/dev/null

echo ""

# ── Benchmark 3: GET /ready ──────────────────────────────────
echo "────────────────────────────────────────────────────────"
echo "BENCHMARK 3: GET /ready — 就緒檢查 (Baseline)"
echo "────────────────────────────────────────────────────────"
npx autocannon \
  --connections "${CONNECTIONS}" \
  --duration "${DURATION}" \
  --pipelining "${PIPELINING}" \
  --method GET \
  "${BASE_URL}/ready" \
  2>/dev/null

echo ""
echo "========================================================"
echo " Benchmarks complete."
echo "========================================================"
echo ""
echo "Thresholds to pass (§5.2 Performance Test Plan):"
echo "  POST /api/rooms       : P99 < 2,000ms, error rate < 0.5%"
echo "  POST /api/rooms/:code/players : P99 < 2,000ms, error rate < 1%"
echo ""
echo "For full 100-room × 50-player WS load test, use:"
echo "  docker run --rm -i grafana/k6:latest run - < tests/performance/k6-websocket.js"
