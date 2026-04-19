#!/usr/bin/env bash
# Verify all required secrets exist in macOS Keychain (does NOT display values)
set -euo pipefail

SERVICE="ladder-room-online"
REQUIRED_KEYS=("REDIS_PASSWORD" "JWT_SECRET")

echo "=== Ladder Room Online — Secret Verification ==="
echo "Service: ${SERVICE}"
echo ""

all_ok=true

for key in "${REQUIRED_KEYS[@]}"; do
  if security find-generic-password -s "${SERVICE}" -a "${key}" -w &>/dev/null; then
    echo "✓ ${key} — present (value hidden)"
  else
    echo "✗ ${key} — MISSING"
    all_ok=false
  fi
done

echo ""
if [[ "${all_ok}" == "true" ]]; then
  echo "All secrets verified. ✓"
  exit 0
else
  echo "Some secrets are missing. Run ./scripts/setup_secrets.sh first."
  exit 1
fi
