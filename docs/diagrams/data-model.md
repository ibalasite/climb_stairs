---
diagram: data-model
source: SCHEMA.md, EDD.md
generated: 2026-04-19T00:00:00Z
direction: TD
---
# 資料模型圖

> 呈現 Room、Player、LadderData、ResultSlot 的核心關係，
> 並標示 LadderDataPublic（省略 seed）用於 WS 廣播的設計決策

```mermaid
erDiagram
    ROOM {
        string code PK "6-char [A-HJ-NP-Z2-9] 房間代碼"
        string status "waiting | running | revealing | finished"
        string hostId "FK → PLAYER.id（可移交）"
        int_or_null winnerCount "1 <= W <= N-1；null 未設定"
        string revealMode "manual | auto"
        int_or_null autoRevealIntervalSec "1-30s；manual 時 null"
        string_array kickedPlayerIds "冗余鏡像，Redis Set 為準"
        int createdAt "Unix ms"
        int updatedAt "Unix ms"
    }

    PLAYER {
        string id PK "UUID v4"
        string roomCode FK "→ ROOM.code"
        string nickname "1-20 字元，禁控制字元"
        int colorIndex "0-49，Canvas 顏色索引"
        bool isHost "由 ROOM.hostId 決定"
        bool isOnline "WS 連線存活狀態"
        int joinedAt "Unix ms"
        string_or_null result "揭示後填入（win/lose）"
    }

    LADDER_DATA {
        string roomCode FK "→ ROOM.code"
        int seed "Mulberry32 seed = djb2(seedSource) >>> 0"
        string seedSource "UUID v4 hex，BEGIN_REVEAL 時生成，供稽核"
        int rowCount "clamp(N*3, 20, 60)"
        int colCount "= N（含離線玩家）"
    }

    LADDER_DATA_PUBLIC {
        string roomCode FK "→ ROOM.code"
        int rowCount "同 LADDER_DATA"
        int colCount "同 LADDER_DATA"
        note "★ 省略 seed / seedSource\n用於 WS 廣播（BEGIN_REVEAL bcast）\n防止 Client 端預算結果"
    }

    LADDER_SEGMENT {
        string roomCode FK "→ ROOM.code"
        int row "0-indexed 列"
        int col "橫槓左端欄位（col <-> col+1 之間）"
    }

    RESULT_SLOT {
        int playerIndex PK "Canvas 列索引（0-based）"
        string roomCode FK "→ ROOM.code"
        string playerId FK "→ PLAYER.id"
        int startCol "起始欄位"
        int endCol "落點欄位"
        bool isWinner "win / lose（無命名獎項）"
    }

    PATH_STEP {
        string roomCode FK "→ ROOM.code"
        int playerIndex FK "→ RESULT_SLOT.playerIndex"
        int row "步驟所在列"
        int col "步驟所在欄"
        string direction "down | left | right"
    }

    ROOM_REVEALED_COUNT {
        string roomCode FK "→ ROOM.code"
        int revealedCount "INCR 原子計數（Redis: room:{code}:revealedCount）"
        note "真相來源，與 status=finished 同步"
    }

    ROOM_KICKED_SET {
        string roomCode FK "→ ROOM.code"
        string playerId "UUID v4（Redis Set 成員）"
        note "Redis key: room:{code}:kicked"
    }

    ROOM_SESSIONS_HASH {
        string roomCode FK "→ ROOM.code"
        string playerId "Hash field"
        string sessionId "Hash value（WS 連線 UUID）"
        note "Redis key: room:{code}:sessions\n用於 SESSION_REPLACED 偵測"
    }

    ROOM ||--o{ PLAYER : "has（max 50）"
    ROOM ||--o| LADDER_DATA : "has（BEGIN_REVEAL 後生成）"
    LADDER_DATA ||--|| LADDER_DATA_PUBLIC : "公開版本（省略 seed）\nbcast via WS"
    ROOM ||--|| ROOM_REVEALED_COUNT : "揭示計數器"
    ROOM ||--o{ ROOM_KICKED_SET : "被踢玩家集合"
    ROOM ||--o{ ROOM_SESSIONS_HASH : "活躍連線 Map"
    LADDER_DATA ||--o{ LADDER_SEGMENT : "包含橫槓"
    LADDER_DATA ||--o{ RESULT_SLOT : "產生結果"
    RESULT_SLOT ||--o{ PATH_STEP : "追蹤路徑"
    PLAYER ||--o| RESULT_SLOT : "對應結果（揭示後）"
```

## 關鍵設計決策說明

| 決策 | 說明 |
|------|------|
| **LadderDataPublic** | `LADDER_DATA` 含 `seed`（用於稽核），WS 廣播使用 `LadderDataPublic`（省略 `seed` / `seedSource`），防止 Client 預算結果 |
| **Ladder 生成時機** | `LADDER_DATA` 在 `BEGIN_REVEAL` 時由 `generateLadder(seedSource, N)` 生成，非 `START_GAME`，確保玩家名單在遊戲開始前不再變動 |
| **revealedCount** | 使用 Redis INCR 原子操作維護，為揭示進度的唯一真相來源 |
| **isWinner** | `RESULT_SLOT.isWinner` 為布林值，無命名獎項，winnerCount 決定前 W 名落點為 winner |
