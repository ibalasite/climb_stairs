# System Overview

> 生成自 devsop-autodev STEP 13

```mermaid
flowchart LR
    Browser["Client Browser\nVanilla TS + Vite\nHTML5 Canvas"]

    subgraph K8s["Kubernetes Cluster (namespace: ladder-room)"]
        Ingress["K8s Ingress\nTraefik\nTLS 終止 / sticky session"]

        subgraph ClientPod["Client Pod"]
            Nginx["Nginx 1.27-alpine\nSPA static files\nport:80"]
        end

        subgraph ServerPod["Fastify Server Pod"]
            Fastify["Fastify + ws\nREST /api/* + WebSocket /ws\nport:3000"]
        end

        subgraph RedisPod["Redis Pod"]
            Redis["Redis StatefulSet\nRoom 狀態 / Pub-Sub\nport:6379"]
        end
    end

    Browser -->|"HTTPS /api/*\nWSS /ws"| Ingress
    Ingress -->|"/ catch-all"| Nginx
    Ingress -->|"/api/* /ws sticky"| Fastify
    Fastify -->|"CRUD / WATCH-MULTI-EXEC"| Redis
    Fastify -->|"PUBLISH / PSUBSCRIBE"| Redis
```

## 說明

系統採用四層架構：Client Browser 透過 Traefik Ingress 路由至兩個獨立 K8s Pod。靜態資源由 Nginx Client Pod 提供，REST API 與 WebSocket 即時事件則由 Fastify Server Pod 處理，房間狀態與跨 Pod 廣播使用 Redis StatefulSet 持久化。
