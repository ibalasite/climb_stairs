# WebSocket Protocol

> 生成自 devsop-autodev STEP 13

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant S as Fastify Server (ws)
    participant R as Redis

    Note over C,S: 連線建立
    C->>S: WSS /ws?room={code}&token={token}
    S->>S: 1. 驗證 Origin（CORS_ORIGIN 白名單）
    S->>S: 2. 驗證 JWT HS256 + exp（允許 30s clock skew）
    S->>S: 3. 比對 JWT.roomCode === query.room
    S->>R: SISMEMBER room:{code}:kicked {playerId}
    alt playerId 已被踢
        S-->>C: PLAYER_KICKED → WS close 4003
    else 驗證通過
        S-->>C: HTTP 101 WS Connected
        S->>C: ROOM_STATE_FULL { room, ladder, results, selfPlayerId }
    end

    Note over C,S: 遊戲訊息流
    C->>S: { type: "JOIN_ROOM", ts, payload: {} }
    S->>R: PUBLISH room:{code}:events ROOM_STATE
    S-->>C: Broadcast ROOM_STATE { players[] }

    C->>S: { type: "START_GAME", ts, payload: {} }
    S-->>C: Broadcast ROOM_STATE { status: "running", rowCount }

    C->>S: { type: "BEGIN_REVEAL", ts, payload: {} }
    S-->>C: Broadcast ROOM_STATE { status: "revealing" }

    C->>S: { type: "REVEAL_NEXT", ts, payload: {} }
    S-->>C: Broadcast REVEAL_INDEX { playerIndex, result, revealedCount, totalCount }

    C->>S: { type: "REVEAL_ALL_TRIGGER", ts, payload: {} }
    S-->>C: Broadcast REVEAL_ALL { results: ResultSlotPublic[] }

    C->>S: { type: "END_GAME", ts, payload: {} }
    S-->>C: Broadcast ROOM_STATE { status: "finished", seed, results[] }

    Note over C,S: 心跳（每 30 秒）
    S->>C: WebSocket Protocol-level PING frame
    C-->>S: WebSocket Protocol-level PONG frame
    Note over S: 30s 未收到 PONG → close 1001

    C->>S: { type: "PING", ts, payload: {} }
    S-->>C: { type: "PONG", ts, payload: { ts: echo } }

    Note over C,S: 斷線重連（指數退避）
    C->>C: WS 斷線 → 指數退避 1s/2s/4s/8s/30s
    C->>S: WSS /ws?room={code}&token={token} (重連)
    S->>R: SISMEMBER room:{code}:kicked
    R-->>S: 0 (未被踢)
    S->>S: PlayerSessionIndex.get(playerId) → 舊 sessionId
    S-->>C: SESSION_REPLACED (unicast 給舊連線 → close)
    S->>R: pipeline GET room:{code} + ladder + revealedCount
    S->>R: WATCH+MULTI/EXEC SET player.isOnline=true
    S->>R: PUBLISH ROOM_STATE (player 重新上線)
    S-->>C: ROOM_STATE_FULL (unicast，重建完整畫面)
```

## 說明

WebSocket 協定涵蓋三個主要階段：連線建立時進行 Origin 驗證、JWT 驗證與踢除攔截；遊戲進行中透過訊息 Envelope（type/ts/payload）驅動狀態流轉；斷線時採指數退避重連（1/2/4/8/30s），重連後發送 SESSION_REPLACED 至舊連線並以 ROOM_STATE_FULL 恢復完整畫面。速率限制為 60 msg/min/連線，超限以 close 4029 關閉。
