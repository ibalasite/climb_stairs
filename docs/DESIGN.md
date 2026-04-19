# DESIGN — Ladder Room Online Client UI Spec

> Version: v1.1
> Date: 2026-04-19
> Based on: PRD v1.3 · ARCH v1.2 · EDD v1.3 · API v1.1
> Tech: Vanilla TypeScript + Vite · HTML5 Canvas · No UI framework

---

## 1. 設計方向

### 視覺風格

**輕量遊戲感 × 現代簡約**：以明亮、歡樂的色調配合清晰的幾何感，讓玩家在手機上一眼看懂當前狀態。避免模板化的深色儀表板風格，選擇接近日系抽獎小遊戲的輕快感——乾淨的白底/淺底、強調色做點睛、動態揭曉是核心視覺高潮。

### 設計原則

1. **Mobile-first**：320px 最小寬度，垂直滾動，單欄佈局優先
2. **狀態即畫面**：每個房間狀態（waiting / running / revealing / finished）對應獨一無二的 UI 組合，玩家不會迷路
3. **Canvas 為主角**：揭曉動畫佔主要可視區域，控制元素靠邊退讓
4. **清晰的角色區分**：主持人看到控制面板，玩家只看觀眾介面；不同角色的 UI 層次清晰

---

## 2. 設計 Token（CSS Custom Properties）

```css
:root {
  /* Palette */
  --color-bg:          oklch(98% 0 0);        /* 接近白色背景 */
  --color-surface:     oklch(100% 0 0);        /* 卡片白 */
  --color-border:      oklch(88% 0 0);         /* 淡灰邊框 */
  --color-text:        oklch(18% 0 0);         /* 主文字深色 */
  --color-text-sub:    oklch(52% 0 0);         /* 次要文字灰 */

  --color-accent:      oklch(62% 0.22 250);    /* 主強調藍紫 */
  --color-accent-light:oklch(94% 0.06 250);    /* 強調淡背景 */
  --color-success:     oklch(60% 0.18 150);    /* 中獎綠 */
  --color-success-light:oklch(94% 0.05 150);
  --color-danger:      oklch(58% 0.20 25);     /* 警告紅 */
  --color-host-badge:  oklch(70% 0.22 40);     /* 主持人徽章橘 */

  /* Ladder player path colours (最多 50 人，循環) */
  --color-path-self:   oklch(62% 0.22 250);    /* 自己的路徑：強調藍紫 */
  --color-path-winner: oklch(60% 0.18 150);    /* 已揭曉中獎：綠 */
  --color-path-loser:  oklch(58% 0.20 25);     /* 已揭曉未中獎：紅 */
  --color-path-hidden: oklch(82% 0 0);         /* 未揭曉：淺灰虛線 */

  /* Typography */
  --font-base: 'Noto Sans TC', system-ui, sans-serif;
  --text-xs:   clamp(0.75rem, 0.7rem + 0.2vw, 0.875rem);
  --text-sm:   clamp(0.875rem, 0.82rem + 0.25vw, 1rem);
  --text-base: clamp(1rem, 0.92rem + 0.4vw, 1.125rem);
  --text-lg:   clamp(1.125rem, 1rem + 0.6vw, 1.375rem);
  --text-xl:   clamp(1.375rem, 1.2rem + 0.9vw, 1.75rem);
  --text-2xl:  clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem);

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-section: clamp(2rem, 1.5rem + 2.5vw, 4rem);

  /* Motion */
  --duration-fast:   150ms;
  --duration-normal: 300ms;
  --duration-slow:   600ms;
  --ease-out-expo:   cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-pill: 9999px;

  /* Shadow */
  --shadow-card: 0 1px 3px oklch(0% 0 0 / 0.08), 0 4px 12px oklch(0% 0 0 / 0.06);
  --shadow-raised: 0 4px 16px oklch(0% 0 0 / 0.12);
}
```

---

## 3. 頁面清單

| 頁面 | URL Pattern | 適用角色 | 房間狀態 |
|------|------------|---------|---------|
| 首頁 / 入口 | `/` | 所有人 | — |
| 建立房間 | `/` → Modal / 子流程 | 主持人 | — |
| 加入房間 | `/?room=XXXXXX` | 玩家 | — |
| 等待大廳 | `/room/:code` | 主持人 + 玩家 | `waiting` |
| 遊戲主畫面（梯子）| `/room/:code` | 主持人 + 玩家 | `running` / `revealing` |
| 結果頁面 | `/room/:code` | 主持人 + 玩家 | `finished` |
| 被踢出 | `/kicked` | 被踢玩家 | — |

> 頁面路由為 SPA，所有狀態切換在 `/room/:code` 內部依 WebSocket 事件動態渲染，不換 URL。

---

## 4. 首頁 / 入口

### 4.1 版面

```
┌──────────────────────────────┐
│  [Logo + 標題]               │
│  爬樓梯抽獎                   │
│                              │
│  ┌─────────────────────────┐ │
│  │  房間碼  [______]        │ │
│  │  暱稱    [______]        │ │
│  │  [加入房間]              │ │
│  └─────────────────────────┘ │
│                              │
│  ─────  或  ─────            │
│                              │
│  [建立新房間]                 │
└──────────────────────────────┘
```

### 4.2 核心 UI 元件

**RoomCodeInput**
- 6 格獨立字元輸入（每格一個 `<input maxlength="1">`）或單一輸入框自動分割
- 自動轉大寫（`text-transform: uppercase`）
- 排除 O / I / 0 / 1 的軟性提示
- 透過 URL param `?room=XXXXXX` 自動預填
- 錯誤狀態：紅框 + 下方錯誤文字（ROOM_NOT_FOUND / ROOM_FULL 等）

**NicknameInput**
- 單行 `<input>` ，1-20 字 Unicode 限制
- 即時 character count 提示（`x / 20`）
- 前端驗證失敗：inline 錯誤（不 submit）

**ActionButton（主要）**
- 高度 48px（觸控最小目標）
- 全寬於 mobile
- Loading spinner 狀態
- Disabled 狀態（表單未填完）

### 4.3 建立房間流程

點擊「建立新房間」展開 inline form：
- 選填：房間名稱（0-50 字）
- 操作：POST `/api/rooms` → 取得 `roomCode` + `token` → 跳轉至等待大廳

---

## 5. 等待大廳（`waiting` 狀態）

### 5.1 版面（主持人視角）

```
┌──────────────────────────────┐
│  [房間名稱或預設文字]          │
│  房間碼：  AB3K7X  [複製]     │
│                              │
│  玩家列表（n / 50）           │
│  ┌───────────────────────┐   │
│  │ 👑 Alice（你）         │   │
│  │    Bob            [踢]│   │
│  │    Carol          [踢]│   │
│  │    Dave ◌ 離線    [踢]│   │
│  └───────────────────────┘   │
│                              │
│  中獎名額                     │
│  [  1  ] / 4 人  [−] [+]    │
│                              │
│  自動揭曉間隔（選填）          │
│  [  5  ] 秒                  │
│                              │
│  [開始遊戲]                   │
└──────────────────────────────┘
```

### 5.2 版面（玩家視角）

```
┌──────────────────────────────┐
│  [房間名稱]                   │
│  房間碼：  AB3K7X             │
│                              │
│  玩家列表（n / 50）           │
│  ┌───────────────────────┐   │
│  │ 👑 Alice（主持人）      │   │
│  │    You（你）           │   │
│  │    Carol               │   │
│  └───────────────────────┘   │
│                              │
│  等待主持人開始遊戲…           │
│  [loading spinner]           │
└──────────────────────────────┘
```

### 5.3 核心 UI 元件

**RoomCodeDisplay**
- 大字顯示 6 碼（`var(--text-2xl)`，等寬字體或字母間距加大）
- [複製] 按鈕：點擊後短暫改為「已複製 ✓」（1.5s 後復原）

**PlayerList**
- 每個 PlayerItem：頭像占位符（首字母圓形背景）+ 暱稱 + 狀態 badge
- 主持人顯示 👑 badge
- 自己顯示「（你）」標示
- 離線玩家：暱稱灰色 + `◌ 離線` chip
- 主持人專屬：每個非主持人旁顯示 [踢] 按鈕（`waiting` 狀態才顯示）
- 玩家加入 / 離線：無刷新即時更新（ROOM_STATE 事件觸發）

**WinnerCountInput**
- Stepper（[−] 數字輸入 [+]）
- 範圍限制：1 ≤ W ≤ N-1（即時 validate，N = 含離線玩家的總人數）
- 設定後立即送出 `UPDATE_WINNER_COUNT`

**StartGameButton**
- Disabled 條件：W 未設定 OR N < 2
- Disabled 時顯示原因 tooltip（「需至少 2 位玩家」或「請設定中獎名額」）

---

## 6. 遊戲主畫面（`running` / `revealing` 狀態）

### 6.1 版面

```
┌──────────────────────────────┐
│  頂部 StatusBar               │
│  [房間碼]  [揭曉進度 x/N]     │
├──────────────────────────────┤
│                              │
│  [頂部玩家名字列 - 起點標籤]  │
│                              │
│  ┌────── Canvas Area ──────┐ │
│  │                         │ │
│  │   梯子主體               │ │
│  │   橫槓動畫               │ │
│  │   路徑高亮               │ │
│  │                         │ │
│  └─────────────────────────┘ │
│                              │
│  [底部結果槽 - 終點標籤]      │
│                              │
├──────────────────────────────┤
│  [主持人控制面板]             │
│  （玩家不顯示此區）           │
└──────────────────────────────┘
```

### 6.2 Canvas 規格

**LadderCanvas（`<canvas id="ladder">`）**

| 屬性 | 規格 |
|------|------|
| 最小寬度 | 320px（配合 NFR-08） |
| 高度 | `min(80dvh, 600px)`，響應式 |
| 縱欄數 | = N（玩家人數，2–50） |
| 橫列數 | `rowCount = clamp(N×3, 20, 60)` |
| 縱線（柱） | 等寬分佈，理想欄寬 = `canvasWidth / N`；**最小欄寬 = 14px**，N > 22 時（320px 容器）Canvas 實際寬度超出容器，採橫向捲動（見 Section 11） |
| 橫槓 | `max(1, round(N/4))` 條 / 列，粗 2px |
| 路徑動畫 | `requestAnimationFrame` 驅動，目標 24fps（手機）/ 30fps（桌機）|
| 座標系 | 原點左上角；x 軸向右，y 軸向下；欄 i 的中心 x = `colWidth * i + colWidth / 2`；列 j 的 y = `rowHeight * j`（rowHeight = canvasHeight / rowCount） |
| running 狀態（梯子尚未下發）| 繪製 N 條等寬灰色虛線（`--color-path-hidden`）佔位；無橫槓；等待 BEGIN_REVEAL 後以 ladderMap 重繪 |

**路徑顏色語意**

| 狀態 | 顏色 Token | 線條樣式 |
|------|-----------|---------|
| 未揭曉 | `--color-path-hidden` | 灰色虛線（dashed） |
| 揭曉動畫中（當前玩家） | `--color-path-self`（如非本人）或 accent | 實線，寬度 3px，帶光暈 |
| 揭曉完成，自己，中獎 | `--color-success` | 實線寬 3px |
| 揭曉完成，自己，未中獎 | `--color-danger` | 實線寬 2px |
| 揭曉完成，他人 | 調色盤循環色（淡化 alpha 0.5） | 實線寬 1.5px |
| 自己（未輪到） | `--color-accent` | 虛線 dashed，寬 2px |

**頂部玩家名字標籤**
- 每欄對應一個玩家名字 chip
- 高亮（動畫進行中的玩家）：accent 底色 + 白字
- 長名字超過欄寬：`text-overflow: ellipsis`

**底部結果槽**
- 每個終點槽：顯示「中獎 🎉」或「謝謝參與」
- 揭曉動畫到達底部後，結果持久顯示
- 未揭曉的槽：`?` 占位符

### 6.3 揭曉動畫流程（AnimationController）

```
REVEAL_INDEX 事件到達
  ↓
取得目標玩家 index 的 startColumn / path segments
  ↓
requestAnimationFrame loop 開始
  ↓
沿 segments 逐格前進（每格 duration = rowCount 決定速度）
  ↓
抵達底部 endColumn
  ↓
在底部結果槽顯示 result（winner / loser）
  ↓
自己中獎：觸發 WinnerOverlay 動畫
  ↓
動畫結束 → 等待下一個 REVEAL_INDEX
```

**REVEAL_ALL 處理**
- 收到 `REVEAL_ALL` 後，同時播放所有未揭曉路徑（壓縮動畫時長）
- 若 2 秒內未完成，直接跳至終止幀（final frame），所有路徑顯示靜態完成態

### 6.4 主持人控制面板（HostControlPanel）

僅 `role === "host"` 時顯示，固定於畫面底部或側邊欄。

**`running` 狀態**
```
[開始揭曉]
```

**`revealing` 狀態（手動模式）**
```
進度：x / N
[下一位]    [全部揭曉]
[切換自動模式]
```

**`revealing` 狀態（自動模式）**
```
進度：x / N
每隔 [___] 秒自動揭曉
[暫停/切換手動]
```

**所有路徑揭曉完畢後**
```
[結束本局]
```

按鈕狀態：
- `[下一位]`：所有路徑已揭曉時 disabled
- `[全部揭曉]`：所有路徑已揭曉時 disabled
- `[開始揭曉]`：狀態非 `running` 時隱藏

---

## 7. 結果頁面（`finished` 狀態）

### 7.1 版面

```
┌──────────────────────────────┐
│  🎉 抽獎結果                  │
│  [房間名稱]                   │
│                              │
│  得獎名單                     │
│  ┌───────────────────────┐   │
│  │ 🏆 Alice        中獎   │   │
│  │ 🏆 Bob          中獎   │   │
│  └───────────────────────┘   │
│                              │
│  未中獎                       │
│  ┌───────────────────────┐   │
│  │    Carol       謝謝參與│   │
│  │    Dave        謝謝參與│   │
│  └───────────────────────┘   │
│                              │
│  Seed：xxxxxxxx（可驗證）     │
│                              │
│  [回首頁]                     │
│  （主持人額外顯示↓）           │
│  [再玩一局]                   │
└──────────────────────────────┘
```

### 7.2 核心 UI 元件

**ResultList**
- 分區：「得獎 🏆」區 + 「未中獎」區
- 每行：暱稱 + 結果 badge（中獎綠 / 未中獎灰）
- 排序：依 startColumn 順序（與梯子欄位對應）

**SeedDisplay**
- 小字顯示 seed 值（可供玩家自行驗算）
- 提示文字：「以下 seed 可用於獨立驗證本局結果」

**PlayAgainButton**（僅主持人可見）
- 點擊後送出 `PLAY_AGAIN`，頁面切回等待大廳
- 若在線玩家 < 2，顯示錯誤提示 toast

---

## 8. Overlay 與通知元件

### 8.1 WinnerOverlay（自己中獎）

觸發條件：自己的路徑動畫抵達中獎結果槽

```
┌──────────────────────────────┐
│  🎊  恭喜！                   │
│  你中獎了！                   │
│  [繼續觀看]                   │
└──────────────────────────────┘
```

- 動畫：從畫面中央 scale-in + opacity 0→1
- 彩帶粒子效果（純 CSS 或 Canvas 輕量實作）
- 3 秒後自動淡出，或點擊關閉

### 8.2 LoserNotice（自己未中獎）

觸發條件：自己的路徑動畫抵達未中獎結果槽

- 底部 toast 形式，小型且不搶主視覺
- 文字：「很遺憾，謝謝參與」
- 2 秒自動消失

### 8.3 Toast 通知系統

**ToastStack** — 固定在畫面右上角（mobile: 全寬底部）

| Type | 觸發事件 / 錯誤碼 | 範例文字 |
|------|-----------------|---------|
| info | 玩家加入 | 「Bob 加入了房間」 |
| info | `PLAYER_KICKED`（他人被踢）| 「Carol 已被主持人移出」 |
| warning | 玩家離線 | 「Carol 離線中」 |
| warning | `INVALID_STATE` | 「操作與目前房間狀態不符，請重試」 |
| warning | `INVALID_AUTO_REVEAL_INTERVAL` | 「自動揭曉間隔需介於 1–30 秒之間」 |
| warning | `INSUFFICIENT_ONLINE_PLAYERS`（再玩一局）| 「在線玩家不足 2 人，請等候玩家上線後重試」 |
| warning | Room TTL 即將到期（前端倒數提示，剩 5 分鐘）| 「房間將在 5 分鐘內關閉」 |
| error | 伺服器錯誤 / `SYS_REDIS_ERROR` | 「伺服器暫時不可用，請稍後再試」|
| error | `ROOM_FULL`（加入時）| 「此房間已滿 50 人，無法加入」 |
| error | `AUTH_TOKEN_EXPIRED`（玩家 token）| 「連線憑證已過期，請重新整理後加入」 |
| success | 中獎名額更新 | 「中獎名額已更新」 |
| success | 房間碼複製成功 | 「房間碼已複製至剪貼簿」 |

- 堆疊最多顯示 3 條，新的從底部入場
- 每條顯示 3 秒後自動消失（可手動點關閉）
- 動畫：`translateY` + `opacity`，compositor-only

### 8.4 KickedScreen（被踢出）

觸發條件：收到 `PLAYER_KICKED` 且 `playerId` 符合自己

```
┌──────────────────────────────┐
│  你已被主持人移出房間          │
│                              │
│  [回首頁]                     │
└──────────────────────────────┘
```

- WebSocket 連線立即關閉
- 不提供重新加入同一局的入口

### 8.5 ErrorBoundary

全域 WebSocket 錯誤顯示（阻塞型，覆蓋當前畫面）：
- `ROOM_NOT_FOUND`：「找不到此房間，請確認房間碼」→ [回首頁]
- `AUTH_TOKEN_EXPIRED`（主持人）：「主持人身份已過期，請重新整理頁面」→ [重新整理]
- `AUTH_TOKEN_EXPIRED`（玩家）：「連線憑證已過期，請重新整理後加入」→ [回首頁]
- `SESSION_REPLACED`：「你的連線已在另一裝置開啟，請重新整理」→ [重新整理]
- `SYS_REDIS_ERROR`：「伺服器暫時不可用，請稍後再試」→ [重試]（自動觸發斷線重連）
- Room TTL 自然過期（WS 斷開，重連失敗 `ROOM_NOT_FOUND`）：顯示「此房間已結束或過期」→ [回首頁]

---

## 9. 互動流程

### 9.1 玩家加入流程

```
首頁
  ↓ 填入房間碼 + 暱稱
  ↓ [加入房間] → POST /api/rooms/:code/players
  ↓ 取得 token + playerId → 存入 localStorage
  ↓ 建立 WebSocket 連線（帶 token 作 query param）
  ↓ 收到 ROOM_STATE（status=waiting）
  → 等待大廳（玩家視角）
```

### 9.2 主持人控制流程

```
建立房間 → POST /api/rooms
  ↓ 取得 token + roomCode → 存入 localStorage
  ↓ 建立 WebSocket 連線
  ↓ 收到 ROOM_STATE（status=waiting）
  → 等待大廳（主持人視角）
       ↓ 設定中獎名額 → WS UPDATE_WINNER_COUNT
       ↓ 等待玩家加入
       ↓ [開始遊戲] → POST /api/rooms/:code/game/start
       ↓ 收到 ROOM_STATE（status=running）
  → 遊戲主畫面（顯示梯子）
       ↓ [開始揭曉] → WS BEGIN_REVEAL
       ↓ 收到 ROOM_STATE（status=revealing）
       ↓ [下一位] → WS REVEAL_NEXT  ×N 次
           └─ 或 [全部揭曉] → WS REVEAL_ALL
       ↓ 所有路徑揭曉完畢
       ↓ [結束本局] → POST /api/rooms/:code/game/end
       ↓ 收到 ROOM_STATE（status=finished，含 seed）
  → 結果頁面
       ↓ [再玩一局] → POST /api/rooms/:code/game/play-again
       ↓ 收到 ROOM_STATE（status=waiting，在線玩家重置）
  → 等待大廳（循環）
```

### 9.3 揭曉動畫流程

```
收到 REVEAL_INDEX { index, result }
  ↓
AnimationController.reveal(index)
  ↓
取得玩家 startColumn → 追蹤 ladderMap → 計算完整路徑 segments
  ↓
requestAnimationFrame loop：
  每幀計算當前位置 → drawPath()
  遇到橫槓：路徑轉向
  到達底部：停止
  ↓
顯示底部結果槽（winner / loser）
  ↓
若 result.playerId === self.playerId：
  顯示 WinnerOverlay 或 LoserNotice
```

### 9.4 斷線重連流程

```
WebSocket 連線中斷
  ↓
指數退避重連（100ms → 200ms → 400ms → ...，最長 30s）
  ↓
重連時帶 localStorage 的 playerId
  ↓
伺服器驗證後回傳 ROOM_STATE_FULL
  ↓
依當前 status 恢復 UI（revealing 狀態不重播已完成動畫，直接顯示靜態結果）
```

---

## 10. WebSocket 狀態 → UI 狀態對應表

| WS 事件 | payload 關鍵欄位 | UI 變化 |
|---------|----------------|---------|
| `ROOM_STATE` status=`waiting` | players[], winnerCount | 顯示等待大廳；更新玩家列表 |
| `ROOM_STATE` status=`running` | rowCount | 顯示梯子佔位（全灰虛線 N 欄，梯子結構尚未下發）；主持人出現「開始揭曉」按鈕；此時 ladderMap 為 null |
| `ROOM_STATE` status=`revealing` | ladderMap, resultSlots, revealedCount | 梯子以 ladderMap 渲染完整結構；主持人出現揭曉控制面板；非主持人靜待揭曉 |
| `ROOM_STATE` status=`finished` | results, seed | 切換至結果頁面；顯示得獎名單 + seed |
| `ROOM_STATE_FULL` | 完整 Room snapshot | 重連恢復：依 status 渲染對應頁面（revealing 直接跳 final frame，不重播動畫） |
| `REVEAL_INDEX` | index, result | 播放對應玩家路徑動畫；更新揭曉進度計數 |
| `REVEAL_ALL` | revealData[] | 同時播放所有剩餘路徑（壓縮時長）；2s 超時跳 final frame；房間仍維持 `revealing`，等待主持人點擊「結束本局」才轉 `finished` |
| `SET_REVEAL_MODE` ack（`ROOM_STATE`）| mode, intervalSec | 主持人控制面板切換手動 / 自動模式；自動模式顯示倒數秒數；intervalSec 不合法時顯示 error toast `INVALID_AUTO_REVEAL_INTERVAL` |
| `UPDATE_TITLE` ack（`ROOM_STATE`）| title | StatusBar / 等待大廳標題即時更新；非主持人無感知（後端廣播 ROOM_STATE） |
| `PLAYER_KICKED` | playerId | 若 playerId === self：顯示 KickedScreen；否則 Toast info「X 已被移出」+ 玩家列表更新 |
| `SESSION_REPLACED` | — | 顯示「連線已被取代」提示，關閉舊連線 |
| `ERROR` | code, message | Toast 顯示 message；依 code 決定是否阻塞操作（見 8.3 錯誤碼映射） |

---

## 11. 響應式設計（Mobile-first）

### 斷點

| Breakpoint | 寬度 | 主要調整 |
|-----------|------|---------|
| xs（預設）| 320px+ | 單欄，Canvas 全寬，控制面板底部固定 |
| sm | 480px+ | 微調 padding，玩家列表可容納更多行 |
| md | 768px+ | Canvas + 控制面板可並排（Canvas 左，面板右） |
| lg | 1024px+ | 最大寬度容器，居中佈局 |

### Mobile 特殊考量

- **Canvas 高度**：`min(80dvh, 600px)` 以避免溢出視窗
- **觸控目標**：所有互動元素高度 ≥ 48px
- **玩家欄寬**：N > 10 時頂部名字標籤縮小字號（`--text-xs`）並截斷（`text-overflow: ellipsis`）
- **Canvas 大玩家數橫向捲動**：N > 22 時（320px 容器下欄寬不足 14px），Canvas 實際寬度 = `N × 14px`；外層 wrapper 設定 `overflow-x: auto; -webkit-overflow-scrolling: touch`；頂部名字列與 Canvas 同步橫向捲動（共用同一捲動容器）
- **觸控手勢（Canvas 區域）**：僅支援橫向滑動以捲動大玩家數梯子；不支援 pinch-zoom（防止意外縮放，`touch-action: pan-x`）；垂直滑動保留給頁面整體捲動（`touch-action: pan-y` 於頁面容器）
- **主持人控制面板**：mobile 固定在畫面底部（`position: sticky; bottom: 0`），避免遮擋 Canvas 主視覺；面板高度固定 80px，Canvas 區域底部留 80px padding
- **房間碼輸入**：自動彈出英文鍵盤（`inputmode="text"`，`autocapitalize="characters"`）；軟鍵盤彈出時 Canvas 區域以 `dvh` 自動縮短，不固定高度

---

## 12. 效能預算

| 資源 | 預算（gzip） |
|------|------------|
| 首頁 JS bundle | < 80KB |
| 遊戲頁 JS bundle | < 150KB |
| CSS | < 30KB |

- Canvas 動畫：compositor-only（transform / opacity），不使用 layout-bound 屬性
- `requestAnimationFrame` 驅動路徑動畫，不使用 `setInterval`
- 50 人滿員時 Canvas 重繪：僅 dirty-rect 更新（非全畫布 clearRect）
- 玩家頭像占位符：首字母 + HSL 色環自動配色（無外部圖片請求）
- 字體：Noto Sans TC Subset（僅中英數字部分，`font-display: swap`）

---

## 13. 無障礙設計（Accessibility）

- 所有互動元素有可見的 focus ring（`outline: 2px solid var(--color-accent)`）
- 色彩對比度：文字與背景 ≥ 4.5:1（WCAG AA）
- Canvas 揭曉結果同步更新 `aria-live="polite"` 文字區，供螢幕閱讀器播報
- 按鈕 disabled 狀態以 `aria-disabled="true"` 標記
- 縮減動態（`prefers-reduced-motion`）：Canvas 動畫跳過逐格播放，直接顯示結果

---

*DESIGN 版本：v1.1*
*生成時間：2026-04-19*
*基於 PRD v1.3 · ARCH v1.2 · EDD v1.3 · API v1.1*
*STEP-07c Round 1 Design Review：補全遺漏 WS 事件映射、Canvas 座標系與大人數橫捲規格、錯誤碼 Toast 映射、觸控手勢與 RoomTTL 失效流程*
