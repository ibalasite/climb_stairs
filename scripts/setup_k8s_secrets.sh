#!/usr/bin/env bash
# Create Kubernetes Secret from macOS Keychain values
# Secrets are never written to disk or version control
set -euo pipefail

SERVICE="ladder-room-online"
NAMESPACE="ladder-room"

echo "=== Ladder Room Online — Kubernetes Secret Setup ==="
echo "Namespace: ${NAMESPACE}"
echo ""

# Read from Keychain (values never touch shell history or files)
REDIS_PASSWORD=$(security find-generic-password -s "${SERVICE}" -a "REDIS_PASSWORD" -w)
JWT_SECRET=$(security find-generic-password -s "${SERVICE}" -a "JWT_SECRET" -w)

if [[ -z "${REDIS_PASSWORD}" || -z "${JWT_SECRET}" ]]; then
  echo "Error: Secrets not found in Keychain."
  echo "Run ./scripts/setup_secrets.sh first."
  exit 1
fi

# Ensure namespace exists
kubectl apply -f k8s/namespace.yaml

# Create or update the k8s Secret (--dry-run + apply for idempotency)
kubectl create secret generic ladder-secrets \
  --namespace="${NAMESPACE}" \
  --from-literal="redis-password=${REDIS_PASSWORD}" \
  --from-literal="jwt-secret=${JWT_SECRET}" \
  --dry-run=client -o yaml \
  | kubectl apply -f -

echo ""
echo "k8s Secret 'ladder-secrets' applied to namespace '${NAMESPACE}'."
echo "Verify: kubectl get secret ladder-secrets -n ${NAMESPACE}"

# Clear variables from memory
unset REDIS_PASSWORD JWT_SECRET
