#!/usr/bin/env bash
# Setup Ladder Room Online secrets in macOS Keychain
# Usage: ./scripts/setup_secrets.sh
set -euo pipefail

SERVICE="ladder-room-online"

store_secret() {
  local key="$1"
  local prompt="$2"
  local default_gen="$3"

  echo ""
  echo "─── ${key} ───────────────────────────────────────────"
  echo "${prompt}"

  # Check if already exists
  existing=$(security find-generic-password -s "${SERVICE}" -a "${key}" -w 2>/dev/null || true)
  if [[ -n "${existing}" ]]; then
    read -r -p "Already set. Overwrite? [y/N] " overwrite
    [[ "${overwrite,,}" != "y" ]] && echo "Skipped." && return
    security delete-generic-password -s "${SERVICE}" -a "${key}" 2>/dev/null || true
  fi

  if [[ -n "${default_gen}" ]]; then
    read -r -p "Generate automatically? [Y/n] " gen
    if [[ "${gen,,}" != "n" ]]; then
      value=$(eval "${default_gen}")
      echo "Generated: ${value:0:8}... (truncated for safety)"
    else
      read -r -s -p "Enter value: " value
      echo ""
    fi
  else
    read -r -s -p "Enter value: " value
    echo ""
  fi

  security add-generic-password -s "${SERVICE}" -a "${key}" -w "${value}"
  echo "Stored ${key} in Keychain."
}

echo "=== Ladder Room Online — macOS Keychain Secret Setup ==="
echo "Service: ${SERVICE}"

store_secret "REDIS_PASSWORD" \
  "Redis authentication password (min 32 chars recommended)" \
  "openssl rand -hex 24"

store_secret "JWT_SECRET" \
  "JWT signing secret (64-byte hex, HS256)" \
  "openssl rand -hex 64"

echo ""
echo "=== Setup Complete ==="
echo "Run ./scripts/verify_secrets.sh to confirm all keys are stored."
echo "Run ./scripts/setup_k8s_secrets.sh to push to Kubernetes."
