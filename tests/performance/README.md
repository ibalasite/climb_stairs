# Performance Tests — Ladder Room Online

效能測試腳本集（§5 Performance Test Plan）。包含：k6 REST API 壓測、k6 WebSocket 並發測試、Autocannon HTTP 基準測試。

---

## 前置條件

| 工具 | 版本 | 安裝方式 |
|------|------|---------|
| k6 | latest | `brew install k6` 或 Docker |
| Node.js | 20 LTS | https://nodejs.org |
| autocannon | latest | 透過 `npx` 自動安裝 |
| Docker | 20+ | 執行 k6 Docker image 時需要 |

伺服器需在測試前啟動並通過健康檢查：

```bash
curl http://localhost:3000/health
# 預期: { "status": "ok", "redis": "ok", ... }
```

---

## 測試腳本說明

### 1. `k6-room-api.js` — REST API 負載測試

測試 REST 端點在持續負載下的回應時間與錯誤率。

**涵蓋端點：**
- `POST /api/rooms` — 建立房間
- `POST /api/rooms/:code/players` — 加入房間
- `GET  /api/rooms/:code` — 查詢房間
- `GET  /health` — 健康檢查

**測試階段：**
- 0→30s：ramp up 至 10 VUs
- 30→90s：穩定 50 VUs
- 90→100s：ramp down

**通過門檻：**
- P95 回應時間 < 500ms
- P99 回應時間 < 2,000ms
- HTTP 錯誤率 < 1%
- 建立房間錯誤率 < 0.5%

**執行方式：**

```bash
# 本地執行（需安裝 k6）
k6 run tests/performance/k6-room-api.js

# 指定目標伺服器
BASE_URL=http://ladder.local k6 run tests/performance/k6-room-api.js

# 使用 Docker（不需本地安裝 k6）
docker run --rm -i --network host grafana/k6:latest run - \
  < tests/performance/k6-room-api.js

# 輸出 JSON 結果
k6 run --out json=results/k6-room-api-result.json tests/performance/k6-room-api.js
```

---

### 2. `k6-websocket.js` — WebSocket 並發壓測

完整模擬遊戲流程：建立房間 → 玩家加入 → WS 連線 → START_GAME → BEGIN_REVEAL → REVEAL_NEXT × N → END_GAME。

**目標：100 房間 × 50 人 = 5,000 並發 WS 連線**

**測試階段：**
- 0→60s：ramp up 至 50 VUs
- 60→240s：穩定 50 VUs
- 240→300s：ramp down

**通過門檻（§5.1）：**
- WS 握手延遲 P95 < 1,500ms
- HTTP 失敗率 < 0.5%
- WS 連線錯誤率 < 0.5%
- WS 廣播延遲 P95 < 2,000ms

**環境變數：**

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `BASE_URL` | `http://localhost:3000` | HTTP REST 端點 |
| `WS_URL` | `ws://localhost:3000` | WebSocket 端點 |
| `PLAYERS_PER_ROOM` | `3` | 每房間玩家數（完整測試用 `50`） |

**執行方式：**

```bash
# 快速驗證（3 玩家/房間）
k6 run tests/performance/k6-websocket.js

# 完整 100 房間 × 50 人壓測
BASE_URL=http://ladder.local WS_URL=ws://ladder.local \
  PLAYERS_PER_ROOM=50 \
  k6 run tests/performance/k6-websocket.js

# 使用 Docker（K8s 環境，不需本地 k6）
docker run --rm -i --add-host ladder.local:$(ipconfig getifaddr en0) \
  -e BASE_URL=http://ladder.local \
  -e WS_URL=ws://ladder.local \
  -e PLAYERS_PER_ROOM=50 \
  grafana/k6:latest run - \
  < tests/performance/k6-websocket.js

# 輸出 JSON 結果
PLAYERS_PER_ROOM=50 k6 run \
  --out json=results/k6-ws-result.json \
  tests/performance/k6-websocket.js
```

---

### 3. `autocannon-http.sh` — HTTP 基準測試

使用 autocannon 進行 HTTP 端點基準測試，確認 P99 < 2s、成功率 > 99.5%。

**環境變數：**

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `BASE_URL` | `http://localhost:3000` | 目標伺服器 |
| `CONNECTIONS` | `50` | 並發連線數 |
| `DURATION` | `30` | 測試持續秒數 |
| `PIPELINING` | `10` | HTTP pipelining factor |

**執行方式：**

```bash
# 本地執行
bash tests/performance/autocannon-http.sh

# 指定目標
BASE_URL=http://ladder.local bash tests/performance/autocannon-http.sh

# 高負載設定
CONNECTIONS=100 DURATION=60 \
  BASE_URL=http://ladder.local \
  bash tests/performance/autocannon-http.sh
```

---

## 測試環境設定

### Local（Rancher Desktop K8s）

```bash
# 啟動 K8s 環境
./scripts/dev-k8s.sh up

# 確認服務可用
curl http://ladder.local/health

# 執行 REST API 壓測
BASE_URL=http://ladder.local k6 run tests/performance/k6-room-api.js

# 執行 WS 並發壓測（完整 50 人/房間）
BASE_URL=http://ladder.local \
  WS_URL=ws://ladder.local \
  PLAYERS_PER_ROOM=50 \
  k6 run tests/performance/k6-websocket.js
```

### Docker Compose（快速本地測試）

```bash
docker compose up -d

# 等待服務就緒
until curl -sf http://localhost:3000/ready; do sleep 2; done

# 執行壓測
k6 run tests/performance/k6-room-api.js
bash tests/performance/autocannon-http.sh
```

---

## 結果輸出

建議建立 `tests/performance/results/` 目錄存放測試結果：

```bash
mkdir -p tests/performance/results

# k6 JSON 輸出
k6 run --out json=tests/performance/results/k6-room-api-$(date +%Y%m%d-%H%M).json \
  tests/performance/k6-room-api.js

# k6 Prometheus 輸出（需 k6 Extension）
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  k6 run --out experimental-prometheus-rw \
  tests/performance/k6-websocket.js
```

---

## 效能指標總覽（§5 Performance Test Plan）

| 指標 | 目標值 | 工具 |
|------|--------|------|
| HTTP P95 回應時間 | < 500ms | k6-room-api.js |
| HTTP P99 回應時間 | < 2,000ms | autocannon-http.sh |
| HTTP 錯誤率 | < 0.5% | k6-room-api.js + autocannon |
| WS 握手延遲 P95 | < 1,500ms | k6-websocket.js |
| WS 廣播延遲 P95 | < 2,000ms | k6-websocket.js |
| WS 並發連線數 | 5,000（100房間 × 50人） | k6-websocket.js |
| WS 訊息接收成功率 | > 99.5% | k6-websocket.js |
| 斷線重連時間 P95 | < 3s | k6-websocket.js（自訂 metric） |

---

*生成時間：2026-04-21（devsop-autodev STEP-19）*
*基於 TEST_PLAN.md §5 + API.md v2.1*
