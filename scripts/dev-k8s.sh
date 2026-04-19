#!/usr/bin/env bash
# dev-k8s.sh — 一鍵啟動本地 k8s 開發環境
# 用法：./scripts/dev-k8s.sh [up|down|restart|logs]
set -euo pipefail

NAMESPACE="ladder-room"
ACTION="${1:-up}"

case "$ACTION" in

up)
  echo "► Build server image..."
  docker build -t ladder-server:local -f Dockerfile .

  echo "► Build client image..."
  docker build -t ladder-client:local -f Dockerfile.client .

  echo "► Apply k8s manifests..."
  kubectl apply -f k8s/namespace.yaml
  kubectl apply -f k8s/configmap.yaml
  kubectl apply -f k8s/redis.yaml
  kubectl apply -f k8s/deployment.yaml
  kubectl apply -f k8s/service.yaml
  kubectl apply -f k8s/client-deployment.yaml
  kubectl apply -f k8s/ingress.yaml

  echo "► Waiting for pods..."
  kubectl rollout status deployment/ladder-server -n "$NAMESPACE" --timeout=60s
  kubectl rollout status deployment/ladder-client -n "$NAMESPACE" --timeout=60s

  echo ""
  echo "✅ 完成！開啟 http://ladder.local"
  echo "   （需要 /etc/hosts: 127.0.0.1 ladder.local）"
  echo ""
  kubectl get pods -n "$NAMESPACE"
  ;;

down)
  kubectl delete namespace "$NAMESPACE" --ignore-not-found
  echo "✅ 已清除"
  ;;

restart)
  echo "► Rebuild images..."
  docker build -t ladder-server:local -f Dockerfile .
  docker build -t ladder-client:local -f Dockerfile.client .

  kubectl rollout restart deployment/ladder-server -n "$NAMESPACE"
  kubectl rollout restart deployment/ladder-client -n "$NAMESPACE"

  kubectl rollout status deployment/ladder-server -n "$NAMESPACE" --timeout=60s
  kubectl rollout status deployment/ladder-client -n "$NAMESPACE" --timeout=60s
  echo "✅ 重啟完成"
  ;;

logs)
  echo "=== Server logs ==="
  kubectl logs -n "$NAMESPACE" -l app=ladder-server --tail=50 -f &
  echo "=== Client logs ==="
  kubectl logs -n "$NAMESPACE" -l app=ladder-client --tail=20
  wait
  ;;

*)
  echo "用法: $0 [up|down|restart|logs]"
  exit 1
  ;;

esac
