---
diagram: architecture
source: ARCH.md, EDD.md
generated: 2026-04-19T00:00:00Z
direction: TD
---
# 系統架構圖（Clean Architecture 分層）

> 依 Presentation / Application / Infrastructure 三層結構呈現，
> 並包含 packages/shared（Domain + Use Cases）與前端客戶端

```mermaid
graph TD
    subgraph ClientBrowser["Client Browser — packages/client"]
        direction TB
        UI["Presentation\nHTML5 Canvas\nLadderRenderer · AnimationController"]
        WSC["WsClient + EventBus\n訊息分發"]
        ClientState["ClientState\n本地狀態管理"]
        UI --> ClientState
        WSC --> ClientState
    end

    subgraph Shared["packages/shared（前後端共用，零 I/O）"]
        direction LR
        Domain["Domain Layer\nRoom · Player · Ladder\nLadderSegment · DomainError\nRoomCode · RoomStatus"]
        UseCases["Use Cases Layer\nGenerateLadder\nValidateGameStart\nComputeResults"]
        PRNG["PRNG\ndjb2 · mulberry32\nfisherYatesShuffle"]
        Domain --> UseCases
        PRNG --> UseCases
    end

    subgraph Server["packages/server — Fastify Pod"]
        direction TB

        subgraph Presentation["Presentation Layer"]
            Routes["Fastify Routes\nrooms.ts · players.ts"]
            Schemas["AJV Schemas\nHTTP 輸入驗證"]
            WsUpgrade["WS 升級驗證\nJWT 檢查 + Origin 驗證"]
        end

        subgraph Application["Application Layer"]
            RoomSvc["RoomService\n房間生命週期協調"]
            GameSvc["GameService\n開局 / 揭示 / 結束流程"]
            WsHandler["WsMessageHandler\nSTART_GAME · BEGIN_REVEAL\nREVEAL_NEXT · REVEAL_ALL_TRIGGER\nPLAY_AGAIN · SET_REVEAL_MODE"]
            PubSubHandler["PubSubHandler\n跨 Pod 訊息路由"]
        end

        subgraph Infrastructure["Infrastructure Layer"]
            RedisClient["RedisClient\nioredis singleton"]
            RoomRepo["RoomRepository\nRedis CRUD\nWATCH+MULTI/EXEC 原子操作"]
            PubSub["PubSubBroker\nPUBLISH / SUBSCRIBE\nroom:{code}:events"]
            WsServer["WsServer\nws npm package\nmaxPayload 65536"]
            WsSession["WsSession\n單一連線 session\nSessionId 衝突處理"]
        end

        Presentation --> Application
        Application --> Infrastructure
    end

    subgraph Redis["Redis StatefulSet"]
        RedisMaster["Redis Master\nRead / Write\nport 6379"]
        RedisReplica["Redis Replica\nRead-only\nport 6379"]
        RedisMaster -->|"replication"| RedisReplica
    end

    subgraph Ingress["Nginx Ingress（TLS / HSTS）"]
        NginxHTTP["HTTP /api/*\nRate Limiting\nsticky session cookie"]
        NginxWS["WebSocket /ws\nOrigin 驗證\nsticky session"]
        NginxStatic["/ 靜態資源"]
    end

    subgraph CDN["GitHub Pages CDN"]
        StaticAssets["Vite Build\nbundle < 150KB gzip"]
    end

    ClientBrowser -->|"HTTPS /api"| NginxHTTP
    ClientBrowser -->|"WSS /ws"| NginxWS
    NginxHTTP -->|"forward"| Presentation
    NginxWS -->|"upgrade"| WsServer
    NginxStatic --> StaticAssets

    Infrastructure -->|"COMMAND / SUBSCRIBE"| RedisMaster

    ClientBrowser -.->|"import types\nGenerateLadder\nComputeResults\nPRNG"| Shared
    Application -.->|"import\nValidateGameStart\nGenerateLadder\nComputeResults"| Shared
```

## 分層職責摘要

| 層級 | 所在位置 | 核心職責 | 外部依賴 |
|------|----------|----------|----------|
| Domain | packages/shared | Entity、Value Object、純業務規則 | 無 |
| Use Cases | packages/shared | 協調 Domain 完成業務流程，回傳純資料 | 僅 Domain |
| Application | packages/server/application | 呼叫 Use Cases、協調 Repository、發布 WS 事件 | Use Cases + 抽象 Interface |
| Infrastructure | packages/server/infrastructure | Redis 實作、WS 封裝 | ioredis、ws、jose |
| Presentation | packages/server/presentation | HTTP Route、AJV 驗證、WS 訊息分派 | Application Service |
