# PDD — Client Design Document
# Ladder Room Online UI/UX 設計規範

## Document Control

| 欄位 | 內容 |
|------|------|
| Version | 1.0 |
| Status | Draft |
| Date | 2026-04-21 |
| Author | AI Design Agent（devsop-autodev STEP-05） |
| Based On | PRD v1.0 + legacy-PDD v2.2 + BRD v1.0 + codebase（renderer.ts, index.html, colors.ts） |
| Stakeholders | 前端工程師、設計師、QA |

---

## §1 Design Philosophy & Direction

### §1.1 視覺風格定位

**Dark Gaming Aesthetic — 深宮夜光**

以深藍黑為底，搭配霓虹紫（#6c63ff）與金色（#ffd700）作為核心強調色。整體氛圍接近現代電競 HUD 介面，強調即時感、張力與儀式感。目標用戶（尾牙主持人、直播主）需要一個在投影或直播畫面上高對比、清晰易讀的介面。

**四個設計核心原則**：

1. **張力感**：每次揭曉動作都應該帶有儀式感，動畫和顏色搭配要製造緊張與期待
2. **清晰層次**：即使 50 人同框，每位玩家的路徑顏色都必須可分辨
3. **手機優先實用性**：玩家多以手機參與，核心操作（加入、查看結果）在 320px 寬度下必須流暢無折
4. **主持人控制感**：主持人介面需突顯控制操作，讓主持人在直播或投影時可以自信操作

### §1.2 Style Direction 關鍵詞

- Dark luxury gaming
- Neon purple accent on deep space background
- Gold winner moment
- Minimalist layout with intentional hierarchy
- Motion that reveals, not distracts

---

## §2 Color System

### §2.1 Background Palette（深色底層）

| Token | Hex | 用途 |
|-------|-----|------|
| `--bg` | `#0f0f1a` | 最底層背景、Canvas 區域底色 |
| `--card` | `#1a1a2e` | Card、Sidebar、Header 背景 |
| `--card-2` | `#16213e` | 次級卡片、Toast 背景 |
| `--border` | `#2a2a45` | 所有分隔線、卡片邊框 |

### §2.2 Accent & Interactive

| Token | Hex | 用途 |
|-------|-----|------|
| `--accent` | `#6c63ff` | 主要按鈕、焦點狀態、Player dot、Room Code |
| `--accent-dim` | `#4a44c0` | Hover 加深版、次要強調 |
| `--gold` | `#ffd700` | 中獎者專用：路徑光暈、勝者星號、得獎 badge |
| `--gold-dim` | `#b8960a` | 中獎結果卡片邊框、次要金色 |

### §2.3 Text System

| Token | Hex | 用途 |
|-------|-----|------|
| `--text` | `#e8e8f0` | 主要文字 |
| `--text-dim` | `#9090b0` | 次要文字、Label、提示說明 |
| Placeholder | `#555570` | Input placeholder |

### §2.4 Semantic Colors

| Token | Hex | 用途 |
|-------|-----|------|
| `--success` | `#55c855` | 已連線指示燈、操作成功 |
| `--danger` | `#e05555` | 錯誤訊息、斷線指示 |
| `--gold`（winner） | `#ffd700` | 中獎路徑發光、勝者標記 |

### §2.5 玩家顏色系統（Player Color System）

每位玩家（最多 50 人）對應一個獨特 HSL 顏色，由 `colorIndex` 決定：

```
colorIndex → hue = (colorIndex × 7.2) % 360
完整色：hsl(hue, 70%, 60%)    → 用於路徑、動畫球、玩家名稱
減淡色：hsl(hue, 45%, 38%)    → 用於垂直軌道（未揭曉時）
```

**顏色語意**：
- 垂直軌道（未揭曉）：`colorFromIndexDim()` 減淡色，表示「等待」
- 已揭曉路徑：`colorFromIndex()` 完整色，`globalAlpha = 0.6`（已完成，半透明讓後來路徑不被遮擋）
- 正在動畫路徑：完整色，`globalAlpha = 1.0`（當前焦點）
- 中獎路徑：疊加金色 `shadowColor: #ffd700`，`shadowBlur = 10`（勝者光暈）
- 玩家自己（myPlayerId）：名稱改用 `#a78bfa`（淡紫）並加粗，進一步強調

**顏色衝突處理**：7.2° 間距確保前 8 名玩家顏色差距 > 45°，視覺差異顯著；50 人時間距 7.2°，仍維持 16 種色相區域的差異。

---

## §3 Typography

### §3.1 字型選擇策略

```css
font-family: system-ui, -apple-system, 'Segoe UI',
             'PingFang TC', 'Microsoft JhengHei', sans-serif;
```

**選型理由**：
- `system-ui / -apple-system`：macOS/iOS 使用 SF Pro，渲染精準
- `'PingFang TC'`：macOS/iOS 繁體中文，字形圓潤現代
- `'Microsoft JhengHei'`：Windows 繁體中文 fallback，螢幕可讀性強
- 不引入 Google Fonts，避免增加 bundle 與外部依賴

### §3.2 字型尺寸規格

| 層級 | 尺寸 | 用途 |
|------|------|------|
| Page Title | `clamp(1.6rem, 4vw, 2.4rem)` | 大廳頁主標題 |
| Card Title | `1rem` | Card 區塊標題 |
| Body | `0.95rem / 0.9rem` | 表單文字、按鈕文字 |
| Label | `0.82rem` | 欄位標籤（大寫 + 字距） |
| Small | `0.72–0.78rem` | Badge、提示文字、離線標記 |
| Canvas Player Name | `13px system-ui` | Canvas 頂部玩家名稱 |
| Canvas Winner Star | `11px system-ui` | Canvas 底部 ★ 標記 |

### §3.3 字型裝飾

- Page Title：漸層字（`linear-gradient(135deg, #6c63ff, #a78bfa)` + `-webkit-background-clip: text`）
- Card Title：`text-transform: uppercase`，`letter-spacing: 0.08em`
- Room Code：`letter-spacing: 0.25em`，`font-weight: 800`

---

## §4 Component Library

### §4.1 Button（按鈕）

```
.btn          → 基礎：flex, border-radius: 8px, font-weight: 600
.btn-primary  → 主要操作：background: #6c63ff
.btn-gold     → 重要揭曉操作：background: #ffd700, color: #111
.btn-danger   → 危險操作（踢除）：background: #e05555
.btn-ghost    → 次要操作：透明背景 + 邊框，hover 變紫色
.btn-sm       → 小尺寸版本：width: auto，padding 縮小
```

**Hover / Active 狀態**：
- Hover（未 disabled）：`opacity: 0.88; transform: translateY(-1px)`
- Active：`transform: translateY(0)`
- Disabled：`opacity: 0.4; cursor: not-allowed`
- Transition：`200ms`（`--duration`）

### §4.2 Input（輸入框）

```
background: var(--bg)          → 深色底
border: 1px solid var(--border)
border-radius: 8px
color: var(--text)
transition: border-color 200ms
```

**Focus 狀態**：`border-color: var(--accent)`（#6c63ff 紫色邊框）

**Room Code Input**：額外加入 `text-transform: uppercase`，輸入自動大寫

### §4.3 Card（卡片）

```
background: var(--card)     → #1a1a2e
border: 1px solid var(--border)
border-radius: 12px
padding: 1.5rem
max-width: 420px
```

大廳與等待室的所有功能區塊均以 Card 包裝，最大寬度 420px，手機全寬展示。

### §4.4 Badge（徽章）

```
.player-badge   → 主持人標記：background: #6c63ff, color: #fff, font-size: 0.7rem
.status-badge   → 房間狀態：圓角 pill，各狀態對應顏色
.result-crown   → 中獎冠冕：color: #ffd700
```

**狀態 Badge 對應色**：

| 狀態 | 背景 | 文字 | 邊框 |
|------|------|------|------|
| waiting | `var(--card-2)` | `var(--text-dim)` | `var(--border)` |
| running | `#1a3a1a` | `#55c855` | `#55c855` |
| revealing | `#3a2a0a` | `#ffd700` | `#ffd700` |
| finished | `#1a1a3a` | `#6c63ff` | `#6c63ff` |

### §4.5 Toast（訊息提示）

```
position: fixed, bottom: 1.5rem, left: 50%（水平置中）
background: var(--card-2)
border-radius: 8px
transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1)
z-index: 9999
```

**狀態分類**：
- `.toast-error`：`border-color: var(--danger); color: var(--danger)`
- `.toast-success`：`border-color: var(--success); color: var(--success)`
- 預設：中性色

### §4.6 Player Dot（玩家狀態指示器）

```
width: 10px; height: 10px; border-radius: 50%
顏色：colorFromIndex(player.colorIndex)（玩家對應顏色）
.offline → opacity: 0.35（斷線狀態）
```

### §4.7 Connection Dot（連線狀態指示器）

```
width: 8px; height: 8px; border-radius: 50%
.connected    → background: #55c855（綠）
.connecting   → background: #ffd700（金，pulse 動畫）
.disconnected → background: #e05555（紅）
```

---

## §5 Page/View Specifications

### §5.1 Lobby（大廳/首頁）

**用途**：主持人建立房間 / 玩家加入房間的入口頁面

**佈局**：垂直排列，`align-items: center`，手機全屏，桌機最大寬 420px

```
┌─────────────────────────────────────────┐
│       [漸層] 爬樓梯抽獎                 │  .page-title（漸層字）
├─────────────────────────────────────────┤
│ ┌───────────────────────────────────┐   │
│ │  CARD-TITLE: 建立房間              │   │
│ │  ──────────────────────────────── │   │
│ │  [暱稱 input]（主持人用）          │   │
│ │  [房間名稱 input]（選填）          │   │
│ │  [btn-primary: 建立房間]           │   │
│ └───────────────────────────────────┘   │
│ ┌───────────────────────────────────┐   │
│ │  CARD-TITLE: 加入房間              │   │
│ │  ──────────────────────────────── │   │
│ │  [暱稱 input]（自動預填 localStorage）│  │
│ │  [房間碼 input]（URL 參數自動預填） │   │
│ │  [btn-ghost: 加入]                 │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**行為細節**：
- 暱稱欄位：讀取 `localStorage.getItem('ladder_last_nickname')` 自動預填
- 房間碼欄位：讀取 `?room=` URL 參數自動預填；輸入時強制大寫（`text-transform: uppercase`）
- 暱稱 + 房間碼均有值時，「加入」按鈕自動啟用
- 建立房間失敗：顯示 error toast，不清除輸入值
- 連線中狀態：按鈕顯示「建立中…」並 disabled

**驗證規則**：
- 暱稱：1～20 Unicode 字元，空白或超過時前端即時顯示 `.error-msg`
- 房間碼：6 碼大寫英數字（A-Z 排除 O/I，2-9 排除 0/1）

### §5.2 Waiting Room（等待室）

**用途**：玩家等待遊戲開始；主持人管理玩家並設定遊戲參數

**佈局**：垂直排列，Card 堆疊，最大寬 420px

```
┌─────────────────────────────────────────┐
│  [連線狀態 dot] + 房間名稱              │  頂部小 header bar
├─────────────────────────────────────────┤
│ ┌───────────────────────────────────┐   │
│ │  ROOM CODE                        │   │
│ │  ┌─────────────────────────────┐  │   │
│ │  │  A7K29M   （大字，accent色） │  │   │
│ │  │  點我複製邀請連結              │  │   │
│ │  └─────────────────────────────┘  │   │
│ └───────────────────────────────────┘   │
│ ┌───────────────────────────────────┐   │
│ │  PLAYERS（N 人）                  │   │
│ │  ● [color] Alice  [主持人 badge]  │   │
│ │  ● [color] Bob                   │   │
│ │  ○ [color] Carol  [離線]          │   │
│ │  [踢除按鈕]（主持人限定，hover顯示）│   │
│ └───────────────────────────────────┘   │
│ ┌───────────────────────────────────┐   │
│ │  遊戲設定（主持人限定）             │   │
│ │  中獎名額：[1-N-1 number input]    │   │
│ │  [btn-primary: 開始遊戲]           │   │
│ └───────────────────────────────────┘   │
│ ┌───────────────────────────────────┐   │
│ │  等待主持人開始…（玩家視角）        │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**玩家列表項目（`.player-item`）**：
- Player Dot：玩家顏色（`colorFromIndex(colorIndex)`），離線時 `opacity: 0.35`
- 主持人標記：`.player-badge`（紫色 pill badge）
- 離線玩家：名稱後附 `.player-offline-label`「離線」
- 踢除按鈕（主持人限定）：`.btn-danger.btn-sm`，僅自己不是被踢對象時顯示

**Room Code 區塊**：
- 點擊觸發 Clipboard API 複製邀請連結（`{origin}/?room={roomCode}`）
- 複製成功：Toast「已複製！」
- Clipboard API 不可用：顯示 `<input>` 文字框（已全選）供手動複製
- `.room-code-box` hover：border 由 `--accent` 轉為 `#a78bfa`（偏淡紫）

**開始遊戲按鈕**：
- 房間人數 < 2 或中獎名額未設定：按鈕 disabled
- 點擊後顯示「開始中...」過渡狀態

### §5.3 Game View（遊戲畫面）

**佈局**：全螢幕 CSS Grid，桌機分左右兩欄，手機縱向排列

```
桌機版（768px+）：
┌──────────────────────────────────┬──────────┐
│  HEADER（game-title + status）   │  HEADER  │
├──────────────────────────────────┼──────────┤
│                                  │  SIDEBAR │
│    Canvas（ladder-canvas）       │  結果列表 │
│                                  │  控制面板 │
│                                  │          │
└──────────────────────────────────┴──────────┘

手機版（< 768px）：
┌──────────────────────────────────────────────┐
│  HEADER（game-title + status badge）         │
├──────────────────────────────────────────────┤
│                                              │
│    Canvas（ladder-canvas）                   │
│                                              │
├──────────────────────────────────────────────┤
│  SIDEBAR（橫向捲動，max-height: 200px）       │
│  → 結果列表（橫向 flex）                      │
├──────────────────────────────────────────────┤
│  主持人控制欄（底部固定）                       │
└──────────────────────────────────────────────┘
```

**Canvas 區域**：
- `background: var(--bg)`（#0f0f1a 深底）
- 100% 寬高自適應父容器
- `devicePixelRatio` 縮放，確保 Retina 清晰度
- Canvas 內邊距常數（來自 `renderer.ts`）：
  - `PADDING_TOP = 60`（px，玩家名稱區域）
  - `PADDING_SIDE = 24`（px，左右各留白）
  - `PADDING_BOT = 32`（px，底部結果槽空間）

**Canvas 視覺層次**（由底到頂）：
1. 垂直軌道（rail）：`RAIL_WIDTH = 3px`，顏色 `colorFromIndexDim`
2. 橫槓（rung）：`RUNG_WIDTH = 2px`，顏色 `#3a3a60`
3. 已揭曉路徑：`PATH_WIDTH = 5px`，玩家色 `opacity: 0.6`
4. 動畫中路徑：同上，`opacity: 1.0`（當前焦點）
5. 中獎光暈：`shadowColor: #ffd700`, `shadowBlur: 10`
6. 動畫球（ball marker）：`BALL_RADIUS = 8px`，白芯 + 玩家色 + `shadowBlur: 16`
7. 底部端點：`radius: 6px`，中獎時金色光暈
8. 玩家名稱（頂）：`13px system-ui`，自己粗體紫色（`#a78bfa`），他人玩家色
9. 中獎星號（底）：`11px`, `★` 金色

**Header 元素**：
- 左：房間名稱（`.game-title`）+ 狀態 Badge（`.status-badge`）
- 右：連線狀態指示燈（`.conn-dot`）
- 背景：`var(--card)`，`border-bottom: 1px solid var(--border)`

**Sidebar（桌機右欄 280px / 手機底部）**：
- 上方：主持人控制區（`.sidebar-section`）
- 下方：結果列表（`.result-list`，可捲動）

**主持人控制面板（`.sidebar-section`）**：
- `running` 狀態：「開始揭曉」按鈕（`.btn-primary`）
- `revealing` 狀態：
  - 「下一位」按鈕（`.btn-primary`）
  - 「全部揭曉」按鈕（`.btn-gold`）
  - 自動揭曉間隔設定（`1-30` 秒 number input + 切換開關）
- `finished` 狀態：「再玩一局」按鈕（`.btn-ghost`）

### §5.4 Result View（結果顯示）

結果在 Game View 的 Sidebar 中即時顯示，並在 `finished` 狀態後全螢幕呈現得獎名單。

**結果列表項目（`.result-item`）**：

```
中獎者：
┌─────────────────────────────────────────┐
│  1.  ♛ Alice              [YOU]         │  background: #1c1600, border: #b8960a
└─────────────────────────────────────────┘

未中獎者：
┌─────────────────────────────────────────┐
│  2.    Bob                              │  background: var(--bg), text-dim
└─────────────────────────────────────────┘
```

**結果項目元素**：
- `.result-rank`：序號（`0.75rem, text-dim`）
- `.result-crown`：中獎者顯示 ♛（`color: #ffd700`）
- `.result-name`：玩家暱稱（`font-weight: 500`）
- `.result-you`：自己額外顯示「(你)」標記（`color: #6c63ff, font-size: 0.72rem`）

**動畫**：每個 result-item 進場動畫 `fadeSlideIn 300ms ease both`（`opacity: 0 → 1`, `translateY(8px → 0)`）

**`finished` 全螢幕結果頁**：
- 金色勝者路徑光暈持續顯示於 Canvas
- 底部 Sidebar 結果列表可捲動查看全部
- 主持人額外看到「再玩一局」按鈕（`.btn-ghost`）
- 玩家看到自己的結果醒目標示（紫色邊框高亮）

---

## §6 Interaction Design

### §6.1 WebSocket 狀態視覺反饋

| 連線狀態 | `.conn-dot` class | 顏色 | 動畫 |
|---------|-------------------|------|------|
| connected | `.connected` | `#55c855`（綠） | 無 |
| connecting（重連中） | `.connecting` | `#ffd700`（金） | `pulse 1s ease infinite`（opacity 1→0.3→1） |
| disconnected | `.disconnected` | `#e05555`（紅） | 無 |

**重連行為**：
- 玩家斷線：Toast「連線中斷，重新連線中…」，conn-dot 轉金色 pulse
- 重連成功：Toast「重新連線成功」，conn-dot 恢復綠色
- 重連失敗超過 3 秒：顯示錯誤 Toast 並提示重新整理頁面

**被踢除提示**：
- Toast + 全頁遮罩提示「你已被主持人移出房間」
- 3 秒後導回首頁（大廳頁）
- 同時清除 localStorage 中的 playerId

**Session 被取代（SESSION_REPLACED）**：
- Toast「此帳號已在其他分頁登入，此頁面已斷開」
- 頁面顯示靜態錯誤畫面，不自動重連

### §6.2 Animation Specifications

**樓梯路徑揭曉動畫**：

| 參數 | 規格 |
|------|------|
| 驅動方式 | `requestAnimationFrame`（瀏覽器原生 60fps） |
| Progress 計算 | 線性進度（0→1），基於時間 delta 累積 |
| 動畫球（Ball Marker） | 白芯圓（radius = 10px）+ 玩家色（radius = 8px）+ `shadowBlur: 16` |
| 已完成路徑 | `globalAlpha = 0.6`（半透明，讓後來的路徑不被遮擋） |
| 動畫中路徑 | `globalAlpha = 1.0`（全不透明，視覺焦點） |
| 中獎光暈觸發 | `progress >= 1` 且 `isWinner`：`shadowColor = #ffd700`, `shadowBlur = 10` |
| REVEAL_ALL 時限 | 全部動畫 2 秒內完成；超過 2 秒直接跳至終止幀（final frame） |

**路徑插值方式**（`drawPath` 函數）：
- 將路徑步驟轉換為 waypoints 陣列
- 計算每段 segment 的歐幾里得距離
- 依總長度比例插值當前 ball 位置
- `lineCap: 'round'`, `lineJoin: 'round'`（平滑轉角）

**其他動畫**：

| 動畫 | 規格 |
|------|------|
| Toast 進場 | `transform: translateY(6rem → 0)`, `280ms cubic-bezier(0.16, 1, 0.3, 1)` |
| Result item 進場 | `fadeSlideIn 300ms ease both`（opacity + translateY） |
| Button hover | `transform: translateY(-1px)`, `opacity: 0.88`, `200ms` |
| Conn dot pulse | `opacity 1→0.3→1`, `1s ease infinite` |

### §6.3 Responsive Design

| 斷點 | 佈局策略 |
|------|---------|
| < 320px | 最小支援寬度；不保證完整體驗 |
| 320–767px | 手機版：所有 Card 全寬；Game View 縱向排列；Sidebar 橫向捲動 |
| 768–1023px | 平板：Game View 左右分欄（Canvas + 280px Sidebar） |
| 1024px+ | 桌機：同上，Canvas 更大空間 |

**手機版 Game View 特殊調整**：
- `grid-template-rows: auto 1fr auto auto`（Header / Canvas / Sidebar / Controls）
- Sidebar `max-height: 200px`，水平捲動
- Result list 轉為橫向排列（`flex-direction: row; overflow-x: auto`）
- Sidebar section 邊框改為右側（`border-right`）

**Canvas 響應式**：
- Canvas CSS 尺寸 100% 填充父容器（`width: 100%; height: 100%`）
- Canvas 實際像素 = `Math.round(cssWidth * devicePixelRatio)`（支援 Retina / 高 DPI）
- 最小有效寬度：320px - 2 × PADDING_SIDE = 272px 可用繪圖區

---

## §7 Accessibility

### §7.1 Color Contrast

| 元素 | 前景 | 背景 | WCAG 目標 |
|------|------|------|----------|
| 主要文字（`--text`） | `#e8e8f0` | `#0f0f1a` | AA（約 13:1） |
| 次要文字（`--text-dim`） | `#9090b0` | `#0f0f1a` | AA（約 4.5:1） |
| 主要按鈕文字（`#fff`） | `#ffffff` | `#6c63ff` | AA |
| 金色按鈕文字（`#111`） | `#111111` | `#ffd700` | AAA（約 14:1） |
| 中獎邊框 | `#b8960a` | `#1c1600` | AA |

### §7.2 ARIA Labels

- Room Code 複製按鈕：`aria-label="複製邀請連結"`
- 連線狀態燈：`aria-label="連線狀態：已連線/連線中/已斷線"`
- 踢除按鈕：`aria-label="踢除 {玩家暱稱}"`
- Canvas：`aria-label="爬樓梯遊戲畫布"`（裝飾性視覺，非核心操作路徑）

### §7.3 Keyboard Navigation

- 所有按鈕、連結可鍵盤 Tab 操作
- Input focus 狀態：`border-color: var(--accent)`（紫色邊框，清晰可見）
- 按鈕 focus-visible：瀏覽器預設 outline（不覆蓋）
- 模態提示（被踢除等）：focus trap 至確認按鈕

### §7.4 Motion Sensitivity

- Canvas 動畫為遊戲核心，無法完全移除
- 若需支援 `prefers-reduced-motion`：動畫球消失（direct path），路徑 `progress` 直接跳至 1.0
- Toast 動畫：`prefers-reduced-motion` 下改為 `opacity` 淡入（不移動）

---

## §8 State Management UI Patterns

### §8.1 LocalStorage 使用規範

| Key | 類型 | 用途 | 清除條件 |
|-----|------|------|---------|
| `ladder_last_nickname` | string | 記憶上次暱稱，加入頁自動預填 | 永不自動清除（使用者自行清除） |
| `playerId` | string（UUID v4） | 玩家身份識別，用於斷線重連 | 被踢除時立即清除（live 路徑 + 重連路徑均清除） |

### §8.2 狀態快照（重連後 UI 行為）

| 重連時房間狀態 | 前端 UI 行為 |
|--------------|------------|
| `waiting` | 自動恢復等待室，顯示玩家列表 |
| `running` | 進入 Game View，顯示梯子（尚未揭曉） |
| `revealing`（部分揭曉） | 進入 Game View，直接呈現已揭曉的靜態結果（不重播已完成動畫） |
| `finished` | 進入 Game View，顯示完整結算頁 |

### §8.3 錯誤 UI 層次

1. **欄位層**（inline）：`.error-msg` 紅色文字，緊接在欄位下方
2. **操作層**（toast）：底部浮動 Toast，3 秒自動消失，可手動關閉
3. **全頁層**（blocking）：全頁遮罩 + 說明 + 行動按鈕（如被踢除、Session 取代）

### §8.4 過渡畫面（Loading States）

| 操作 | 過渡 UI |
|------|---------|
| 建立房間中 | 按鈕文字「建立中…」+ disabled |
| 加入房間中 | 按鈕文字「加入中…」+ disabled |
| 開始遊戲中（running 轉換） | 全頁「遊戲開始中，請稍候…」15 秒計時器（fallback） |
| 原子寫入超時（10s rollback） | Toast 顯示「開始失敗，請重試」，狀態恢復 waiting |

---

## Appendix A: Design Token Summary

```css
:root {
  /* Background */
  --bg:          #0f0f1a;
  --card:        #1a1a2e;
  --card-2:      #16213e;
  --border:      #2a2a45;

  /* Accent */
  --accent:      #6c63ff;
  --accent-dim:  #4a44c0;
  --gold:        #ffd700;
  --gold-dim:    #b8960a;

  /* Text */
  --text:        #e8e8f0;
  --text-dim:    #9090b0;

  /* Semantic */
  --success:     #55c855;
  --danger:      #e05555;

  /* Shape */
  --radius:      12px;
  --radius-sm:   8px;
  --duration:    200ms;
}
```

## Appendix B: Canvas Renderer Constants（來自 renderer.ts）

```typescript
const RAIL_WIDTH   = 3;    // 垂直軌道線寬
const RUNG_WIDTH   = 2;    // 橫槓線寬
const PATH_WIDTH   = 5;    // 揭曉路徑線寬
const BALL_RADIUS  = 8;    // 動畫球半徑
const PADDING_TOP  = 60;   // 頂部留白（玩家名稱區）
const PADDING_SIDE = 24;   // 左右各留白
const PADDING_BOT  = 32;   // 底部留白（結果槽區）
const NAME_FONT    = '13px system-ui, sans-serif';
const GOLD         = '#ffd700';
```

## Appendix C: Player Color Formula

```typescript
// 完整色（路徑、動畫球、玩家名稱）
colorFromIndex(index: number): string {
  const hue = (index * 7.2) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

// 減淡色（未揭曉垂直軌道）
colorFromIndexDim(index: number): string {
  const hue = (index * 7.2) % 360;
  return `hsl(${hue}, 45%, 38%)`;
}
```

---

*PDD 版本：v1.0*
*生成時間：2026-04-21*
*基於：PRD v1.0 + legacy-PDD v2.2 + BRD v1.0 + codebase（renderer.ts, index.html, colors.ts）*
