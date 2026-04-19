---
diagram: system-flow
source: EDD.md, PRD.md
generated: 2026-04-19T00:00:00Z
direction: TD
---
# 系統整體流程圖

> 涵蓋 Player 加入 → 等待 → 遊戲 → 揭曉 → 結束的完整生命週期

```mermaid
flowchart TD
    A([開始]) --> B[Host 建立房間\nPOST /api/v1/rooms\n取得 host JWT]
    B --> C[Host WS 連線\nGET /ws?token=hostJWT\nROMM_STATE_FULL unicast]

    C --> D{等待玩家加入\nstatus: waiting}

    D --> E[Player 加入\nPOST /api/v1/rooms/:code/players\n取得 player JWT]
    E --> F[Player WS 連線\nbcast ROOM_STATE 玩家更新]
    F --> D

    D --> G{玩家數 N >= 2\n且 Host 設定 winnerCount?}
    G -- 否 --> D
    G -- 是 --> H[Host 發送 START_GAME\nValidateGameStart N>=2, 1<=W<=N-1\nstatus → running\nbcast ROOM_STATE]

    H --> I[Host 發送 BEGIN_REVEAL\n此時生成 Ladder\ngenerateLadder 使用 seedSource\nstatus → revealing\nbcast ROOM_STATE]

    I --> J{揭示模式\nrevealMode?}

    J -- manual --> K[Host 發送 REVEAL_NEXT\nINCR revealedCount\nbcast REVEAL_INDEX\npath + result]
    J -- auto --> L[計時器自動觸發\nINCR revealedCount\nbcast REVEAL_INDEX\npath + result]

    K --> M{revealedCount == N?}
    L --> M

    M -- 否 --> J

    M -- 是 --> N[bcast REVEAL_ALL\nresults[]\nstatus → finished\nEXPIRE 3600]

    I --> O[Host 發送 REVEAL_ALL_TRIGGER\n一鍵揭示全部剩餘玩家\nbcast REVEAL_ALL\nstatus → finished\nEXPIRE 3600]

    N --> P{Host 選擇?}
    O --> P

    P -- PLAY_AGAIN --> Q[Host 發送 PLAY_AGAIN\n清除 Ladder / Results\nadjust winnerCount if needed\nbcast ROOM_STATE status:waiting\nEXPIRE 86400]
    Q --> D

    P -- 結束 --> R([房間 TTL 到期\nfinished 1h 後自動清除])
```
