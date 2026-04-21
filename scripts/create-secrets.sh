#!/bin/bash
# 建立 K8s Secret for ladder-room namespace
# Usage: JWT_SECRET=<value> REDIS_PASSWORD=<value> ./scripts/create-secrets.sh
set -e

NAMESPACE="${NAMESPACE:-ladder-room}"

# 檢查 namespace 存在
kubectl get namespace "$NAMESPACE" > /dev/null 2>&1 || {
  echo "Creating namespace $NAMESPACE..."
  kubectl apply -f k8s/namespace.yaml
}

# JWT_SECRET
if [ -z "${JWT_SECRET}" ]; then
  echo "WARNING: JWT_SECRET not set, generating random secret..."
  JWT_SECRET=$(openssl rand -base64 32)
  echo "Generated JWT_SECRET (save this!): $JWT_SECRET"
fi

# REDIS_PASSWORD
if [ -z "${REDIS_PASSWORD}" ]; then
  echo "WARNING: REDIS_PASSWORD not set, generating random password..."
  REDIS_PASSWORD=$(openssl rand -hex 24)
  echo "Generated REDIS_PASSWORD (save this!): $REDIS_PASSWORD"
fi

# 建立或更新 secret
kubectl create secret generic ladder-secrets \
  --namespace="$NAMESPACE" \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --from-literal=redis-password="$REDIS_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secrets created/updated in namespace: $NAMESPACE"
echo "Verify: kubectl get secret ladder-secrets -n $NAMESPACE"

# Clear variables from memory
unset JWT_SECRET REDIS_PASSWORD
