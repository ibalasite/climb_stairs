#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
SCENARIO="${2:-normal_load}"

echo "=== Ladder Room Online — k6 Load Test ==="
echo "Target: ${BASE_URL}"
echo "Scenario: ${SCENARIO}"
echo ""

# Check k6 is installed
if ! command -v k6 &>/dev/null; then
  echo "Error: k6 not found. Install via:"
  echo "  brew install k6          # macOS"
  echo "  sudo apt install k6      # Ubuntu"
  exit 1
fi

k6 run \
  --env BASE_URL="${BASE_URL}" \
  --out json=results/k6_${SCENARIO}_$(date +%Y%m%d_%H%M%S).json \
  --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
  scripts/load_test.js

echo ""
echo "Results saved to results/k6_*.json"
