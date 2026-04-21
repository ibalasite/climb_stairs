#!/bin/bash
# 輪替 JWT_SECRET 並重新 deploy ladder-server
# Usage: ./scripts/rotate-secrets.sh [--namespace <ns>] [--jwt-secret <value>]
set -e

NAMESPACE="${NAMESPACE:-ladder-room}"
NEW_JWT_SECRET=""

# 解析參數
while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --jwt-secret)
      NEW_JWT_SECRET="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--namespace <ns>] [--jwt-secret <value>]"
      exit 1
      ;;
  esac
done

# 確認 namespace 存在
kubectl get namespace "$NAMESPACE" > /dev/null 2>&1 || {
  echo "Error: namespace $NAMESPACE not found."
  exit 1
}

# 確認現有 secret 存在
kubectl get secret ladder-secrets --namespace="$NAMESPACE" > /dev/null 2>&1 || {
  echo "Error: secret 'ladder-secrets' not found in namespace $NAMESPACE."
  echo "Run ./scripts/create-secrets.sh first."
  exit 1
}

# 生成新 JWT_SECRET（若未提供）
if [ -z "$NEW_JWT_SECRET" ]; then
  echo "Generating new JWT_SECRET..."
  NEW_JWT_SECRET=$(openssl rand -base64 48)
  echo "New JWT_SECRET generated (save this for rollback!)"
fi

# 讀取現有 REDIS_PASSWORD（保留不變）
REDIS_PASSWORD=$(kubectl get secret ladder-secrets \
  --namespace="$NAMESPACE" \
  -o jsonpath='{.data.redis-password}' | base64 --decode)

if [ -z "$REDIS_PASSWORD" ]; then
  echo "Error: could not read existing redis-password from secret."
  exit 1
fi

echo "Rotating JWT_SECRET in namespace: $NAMESPACE"

# 更新 secret（保留 redis-password 不變）
kubectl create secret generic ladder-secrets \
  --namespace="$NAMESPACE" \
  --from-literal=jwt-secret="$NEW_JWT_SECRET" \
  --from-literal=redis-password="$REDIS_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secret 'ladder-secrets' updated with new JWT_SECRET."

# 重新 rollout ladder-server 以取得新 secret
echo "Rolling out ladder-server deployment..."
kubectl rollout restart deployment/ladder-server --namespace="$NAMESPACE"

echo "Waiting for rollout to complete..."
kubectl rollout status deployment/ladder-server --namespace="$NAMESPACE" --timeout=120s

echo "Rotation complete. ladder-server is running with the new JWT_SECRET."
echo "Active sessions signed with the old secret will be invalidated."

# Clear variables from memory
unset NEW_JWT_SECRET REDIS_PASSWORD
