# Room Lifecycle

> 生成自 devsop-autodev STEP 13

```mermaid
stateDiagram-v2
    [*] --> waiting : POST /api/rooms 建立房間

    waiting --> waiting : player_joined / player_left\nhost 更新 winnerCount / title
    waiting --> running : host START_GAME\n條件: N>=2 AND 1<=W<=N-1\n原子生成 seedSource（不含梯子）

    running --> revealing : host BEGIN_REVEAL\n原子生成 LadderData + ResultSlots\nbcast ROOM_STATE status:revealing

    revealing --> revealing : REVEAL_NEXT（手動）/ auto-timer（自動）\nrevealedCount < totalCount\nbcast REVEAL_INDEX path result
    revealing --> revealing : SET_REVEAL_MODE 切換手動↔自動
    revealing --> revealing : REVEAL_ALL_TRIGGER\nbcast REVEAL_ALL（剩餘路徑省略 path）

    revealing --> finished : host END_GAME\n條件: revealedCount === totalCount\nbcast ROOM_STATE status:finished 含 seed\nRedis TTL 降至 1h

    finished --> waiting : host PLAY_AGAIN\n剔除 isOnline=false 玩家\n清空 kickedPlayerIds\nbcast ROOM_STATE waiting

    waiting --> waiting : host RESET_ROOM（任意狀態）\n清空 ladder / results / kickedPlayerIds
    running --> waiting : host RESET_ROOM
    revealing --> waiting : host RESET_ROOM
    finished --> waiting : host RESET_ROOM

    waiting --> [*] : room TTL 24h 過期
    running --> [*] : 所有玩家斷線 5 分鐘
    finished --> [*] : room TTL 1h 過期
```

## 說明

房間生命週期包含四個核心狀態：waiting（等待玩家加入）、running（遊戲已開始，等待揭曉）、revealing（逐步揭曉路徑中）、finished（本局結束，seed 首次公開）。RESET_ROOM 可在任意狀態觸發回到 waiting，PLAY_AGAIN 則僅限 finished 狀態且自動剔除離線玩家。
