# Local Development Guide

## Prerequisites

- Rancher Desktop (Docker runtime, NOT containerd)
- `kubectl` configured to Rancher Desktop context
- Node.js 20+, npm

## Build & Deploy

### Build Images

```bash
# Server — full multi-stage build
docker build -t ladder-server:local -f Dockerfile .

# Or use the pre-built dist/ shortcut (faster, requires npm run build first)
# npm install && npm run build
# docker build -t ladder-server:local -f Dockerfile.local .

# Client — nginx static server
docker build -t ladder-client:local -f Dockerfile.client .
```

### Load to Rancher Desktop (Docker runtime)

If images are built in the host Docker daemon and Rancher Desktop uses its own daemon:

```bash
docker save ladder-server:local | rdctl shell -- docker load
docker save ladder-client:local | rdctl shell -- docker load
```

If Rancher Desktop is already sharing the host Docker socket (default for Docker runtime mode), no extra step is needed — images are already visible.

### Apply K8s Resources

```bash
kubectl apply -f k8s/
kubectl rollout status deployment/ladder-server -n ladder-room
kubectl rollout status deployment/ladder-client -n ladder-room
kubectl rollout status deployment/redis -n ladder-room
```

### Create Required Secret (first time only)

```bash
kubectl create secret generic ladder-secrets \
  --namespace ladder-room \
  --from-literal=redis-password=localdevpassword \
  --from-literal=jwt-secret=localdevjwtsecret32byteslong1234
```

### Port Forwarding

```bash
kubectl port-forward svc/ladder-server-service -n ladder-room 3000:80 &
kubectl port-forward svc/ladder-client-service -n ladder-room 8090:80 &
```

### Verify

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:8090/
```

## Resource Summary

| File | Resource | Description |
|------|----------|-------------|
| `namespace.yaml` | Namespace `ladder-room` | Isolates all resources |
| `deployment.yaml` | Deployment `ladder-server` | Fastify server pod (`ladder-server:local`) |
| `client-deployment.yaml` | Deployment `ladder-client` + Service | Nginx client pod (`ladder-client:local`) |
| `redis.yaml` | Deployment `redis` | Redis 7 single-node (MVP) |
| `service.yaml` | Services `ladder-server-service`, `redis-service` | ClusterIP endpoints |
| `configmap.yaml` | ConfigMap `ladder-server-config` | Non-sensitive env vars (PORT, REDIS_HOST, etc.) |
| `ingress.yaml` | Ingress `ladder-server-ingress` | Traefik routes `ladder.local` → client/server |
| `hpa.yaml` | HPA `ladder-server-hpa` | Post-MVP autoscaler (disabled for MVP) |

## Troubleshooting

### Pod not starting — ImagePullBackOff

Both server and client images use `imagePullPolicy: Never`. This means they must exist in the cluster's local image store before applying manifests.

```bash
# Check if image is available in Rancher Desktop
rdctl shell -- docker images | grep ladder
```

### Pod not starting — secret not found

```bash
kubectl get secret ladder-secrets -n ladder-room
# If missing, run the kubectl create secret command from the setup section above
```

### View logs

```bash
kubectl logs -n ladder-room deployment/ladder-server -f
kubectl logs -n ladder-room deployment/ladder-client -f
kubectl logs -n ladder-room deployment/redis -f
```

### Restart a deployment

```bash
kubectl rollout restart deployment/ladder-server -n ladder-room
kubectl rollout restart deployment/ladder-client -n ladder-room
```

### Delete and redeploy everything

```bash
kubectl delete namespace ladder-room
kubectl apply -f k8s/
# Re-create secret after namespace deletion
kubectl create secret generic ladder-secrets \
  --namespace ladder-room \
  --from-literal=redis-password=localdevpassword \
  --from-literal=jwt-secret=localdevjwtsecret32byteslong1234
```
