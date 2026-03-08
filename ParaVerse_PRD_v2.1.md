# ParaVerse｜平行世界預測引擎
## Product Requirements Document v2.1

> **技術棧更新**：前端由 Vue 3 改為 **React 18 + TypeScript**
> 版本：v2.1 · 2026 Q2 · 雙引擎架構版
> 出品：Plusblocks Technology Limited

---

## 目錄

1. [產品定位與核心理念](#1-產品定位與核心理念)
2. [雙引擎核心架構](#2-雙引擎核心架構)
3. [六大應用場景模組規格](#3-六大應用場景模組規格)
4. [系統架構與技術設計](#4-系統架構與技術設計)
5. [完整技術棧](#5-完整技術棧)
6. [前端設計規格（React 18）](#6-前端設計規格react-18)
7. [API 設計規格](#7-api-設計規格)
8. [實作路線圖](#8-實作路線圖)
9. [開源版權合規聲明](#9-開源版權合規聲明)
10. [風險分析](#10-風險分析)
11. [商業模式](#11-商業模式)
12. [附錄](#12-附錄)

---

## 1. 產品定位與核心理念

**ParaVerse（平行世界）** 是一款面向 B2B 企業的群體智能預測分析平台。系統透過建構高保真的數位平行世界——讓數百個具備獨立人格、記憶與行為邏輯的 AI 智能體在模擬現實中自由演化——從而揭示傳統統計模型無法捕捉的輿論動態、群體反應與未來情境分布。

> **核心洞察**：傳統預測工具是「靜態快照」，ParaVerse 建構的是「動態平行世界」。不是預測一個結果，而是讓未來在平行宇宙中自行演化，觀察哪些情境最可能浮現。

| 維度 | 說明 |
|---|---|
| 產品定位 | B2B 群體智能預測 SaaS 平台，支援六大應用場景 |
| 核心技術 | Multi-Agent 社會模擬 + GraphRAG + ReACT 推理 + 雙引擎架構 |
| 引擎一：OASIS | CAMEL-AI 出品，Apache 2.0，社群輿論傳播場景 |
| 引擎二：Concordia | Google DeepMind 出品，Apache 2.0，複雜決策推理場景 |
| 後端引擎 | Bun (TypeScript) + Hono，REST API + WebSocket |
| 前端框架 | **React 18 + TypeScript + Vite + TailwindCSS v4** |
| 資料庫 | PostgreSQL 17 + pgvector |
| 輸出格式 | 情境分布報告（Scenario Distribution），非單點預測 |
| 授權模式 | 按月訂閱 + 按模擬次數超量計費 |

---

## 2. 雙引擎核心架構

### 2.1 兩大引擎設計哲學對比

```
OASIS 設計哲學
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
「模擬一個社交媒體平台，智能體是其中的使用者」
從平台出發 → 帖子、推薦算法、關注圖、熱度排序開箱即用
強項：社群動態、資訊傳播、群體極化、羊群效應
弱項：平台以外的一切

Concordia 設計哲學
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
「建構一個世界規則，Game Master 是裁判」
從智能體出發 → 環境規則完全可編程
強項：任何場景的通用模擬、精密決策推理、分支情境
弱項：社交媒體的開箱即用能力
```

### 2.2 引擎詳細對比表

| 維度 | OASIS（輿論引擎） | Concordia（決策引擎） |
|---|---|---|
| 出品方 | CAMEL-AI | Google DeepMind |
| 版本 | v0.2.5+ | v2.0+ |
| 授權 | Apache 2.0 ✅ | Apache 2.0 ✅ |
| 社群平台環境 | ✅ 開箱即用（Twitter/Reddit-like） | ❌ 需自建 GM 規則 |
| 推薦算法 | ✅ 內建熱度 + 興趣推薦 | ❌ 需自行實作 |
| 智能體行為數量 | 23 種預定義社交行為 | 組件化自由組合 |
| 情境分支（A/B/C） | ❌ 需多次獨立模擬 | ✅ GM 在同一模擬內管理分支 |
| 數值變數追蹤 | ❌ 無內建數值系統 | ✅ Grounded Variables（聲譽分/票數等） |
| 人機互動 | ❌ 純自動化 | ✅ ManualAction 支援人類介入 |
| 存檔 / 回放 | ❌ 不支援 | ✅ 原生 Checkpoint + 序列化 |
| 認知框架建模 | ❌ 靠 Persona 文字 | ✅ Component 可注入 March & Olsen 認知框架 |
| 模擬規模 | 最高百萬智能體 | 適合 10–500 智能體精密場景 |
| 適用場景 | 金融情緒、娛樂 IP | 危機公關、政策評估、戰略推演、教育培訓 |

### 2.3 雙引擎統一架構圖

```
┌──────────────────────────────────────────────────────────────┐
│                   ParaVerse 統一 API 層                       │
│           Bun + Hono  ·  REST + WebSocket                    │
│      認證 / 限流 / 任務管理 / 多租戶隔離                        │
└───────────────────────┬──────────────────────────────────────┘
                        │ SimulationService 場景路由
           ┌────────────┴─────────────┐
           ▼                          ▼
┌──────────────────┐       ┌──────────────────────┐
│   OASIS Runner   │       │  Concordia Runner    │
│  ─────────────── │       │  ──────────────────  │
│  Python 子程序   │       │  Python 子程序       │
│  Twitter-like    │       │  Game Master 環境    │
│  Reddit-like     │       │  Sequential Engine   │
│  推薦系統        │       │  Simultaneous Engine │
│  熱度算法        │       │  Grounded Variables  │
│  23 種行為       │       │  Checkpoint / 序列化 │
└────────┬─────────┘       └──────────┬───────────┘
         │ JSONL 事件串流               │ JSONL 事件串流
         └─────────────┬───────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL 17 + pgvector                        │
│  documents  │  agent_profiles  │  simulation_events          │
│  ontology   │  scenario_branches │  report_sections          │
│  interaction_sessions  │  projects  │  simulations           │
└──────────────────────────────────────────────────────────────┘
```

### 2.4 場景-引擎路由矩陣

| 應用場景 | 指派引擎 | 核心理由 |
|---|---|---|
| 金融情緒預測 | **OASIS** | 社群傳播核心，推薦算法開箱即用，羊群效應已論文驗證 |
| 娛樂 IP 測試 | **OASIS** | 粉絲社群天然契合，快速設定，短週期驗證 |
| 危機公關壓測 | **Concordia** | A/B/C 策略分支、聲譽數值追蹤、媒體記者複雜決策邏輯 |
| 政策影響評估 | **Concordia** | 認知框架建模、學術可信度（DeepMind 背書）、公聽會場景 |
| 戰略情報推演 | **Concordia** | 嵌套世界、多角色決策邏輯、現實約束、外交 API 整合 |
| 教育培訓模擬器 | **Concordia** | ManualAction 人機互動、Checkpoint、Prefabs 模板 |

### 2.5 雙引擎 IPC 指令集

| 指令 | OASIS | Concordia | Payload |
|---|---|---|---|
| `start_simulation` | ✅ | ✅ | `{ config, agents[], seed_context }` |
| `inject_event` | ✅ | ✅ | `{ tick, event_type, content }` |
| `interview_agent` | ✅ | ✅ | `{ agent_id, prompt }` |
| `get_status` | ✅ | ✅ | `{ progress, events_count }` |
| `stop_simulation` | ✅ | ✅ | `{ reason }` |
| `save_checkpoint` | ❌ | ✅ | `{ checkpoint_path }` |
| `load_checkpoint` | ❌ | ✅ | `{ checkpoint_path }` |
| `inject_manual_action` | ❌ | ✅ | `{ actor_id, action_text }` |
| `set_grounded_var` | ❌ | ✅ | `{ var_name, value }` |
| `fork_scenario` | ❌ | ✅ | `{ scenario_label, override_vars }` |

---

## 3. 六大應用場景模組規格

### 3.1 金融情緒預測（FinSentiment）

> **引擎**：OASIS v0.2.5+ · Apache 2.0

| 項目 | 規格 |
|---|---|
| 使用場景 | 財報發布後輿情演化、央行政策聲明市場反應、IPO 散戶情緒預測、黑天鵝事件壓力測試 |
| 種子材料 | 財報 PDF、央行聲明全文、新聞稿、券商研報、社群關鍵字詞典 |
| 智能體族群 | 散戶投資人 60%（保守/積極/衝動三型）+ 媒體財經分析師 20% + 法人代表 20% |
| 平台模擬 | Twitter 金融標籤 + PTT Stock 板（台灣本地化擴展）+ 股票論壇 |
| 注入事件 | 財報 EPS 數字、突發黑天鵝（地緣政治/競品消息）、大戶異常買賣報告 |
| OASIS 核心能力 | 推薦算法推送財經帖子 → 智能體看到不同內容 → 觀點自然分化 → 羊群效應湧現 |
| 輸出報告 | 情緒走向分布圖（正面/中性/負面比例時序曲線）、輿論高峰時間預測、族群差異矩陣、KOL 節點識別、風險訊號清單 |
| Backtest 策略 | 用歷史已知財報事件（如台積電法說會）驗證預測準確率 |
| Token 成本控制 | Redis 快取同 Prompt 回應（TTL 30 分鐘）；散戶用 qwen-plus，分析師用 qwen-max |

---

### 3.2 危機公關壓力測試（CrisisSimulator）

> **引擎**：Concordia v2.0+ · Apache 2.0

| 項目 | 規格 |
|---|---|
| 使用場景 | 危機回應策略 A/B/C 測試、競品輿論攻勢預演、重大決策（漲價/裁員/下架）輿情衝擊評估 |
| 種子材料 | 品牌歷史資料、過往危機案例、競品分析報告、核心客群描述 |
| 智能體族群 | 一般消費者 50% + 媒體記者 20% + 品牌死忠粉 15% + 批評者/競品粉 15% |
| Concordia 核心能力 | GM 在同一模擬內管理 A/B/C 三分支；Grounded Variable 追蹤 `brand_reputation_score`；媒體記者 Component 定義「追問/查核」特殊邏輯 |
| 情境分支設計 | `fork_scenario` 指令：同一危機事件，注入三種品牌回應聲明，觀察各分支走向差異 |
| 輸出報告 | 三策略輿論走向對比圖、聲譽分恢復曲線、媒體追問高峰預測、最優策略建議 |
| 差異化價值 | 業界唯一「危機回應策略模擬器」，A/B/C 可在單次模擬完成 |

---

### 3.3 政策影響評估（PolicyLab）

> **引擎**：Concordia v2.0+ · Apache 2.0

| 項目 | 規格 |
|---|---|
| 使用場景 | 法案草稿社會反應預演、政策溝通框架 A/B 測試、跨部會利益衝突模擬 |
| 種子材料 | 政策草稿文件、歷史類似政策案例（含社會反應記錄）、學術研究報告 |
| 智能體族群 | 依政策影響族群動態配置（稅改：高/中/低收入；能源：環保/產業/一般民眾） |
| Concordia 核心能力 | March & Olsen 認知框架建模；Sequential Engine 模擬公聽會發言順序；Grounded Variables 追蹤抗議強度指數 |
| 學術可信度路徑 | Concordia 由 DeepMind 出品並在頂級學術期刊發表；報告可作為政策研究方法論補充 |
| 輸出報告 | 各族群接受度矩陣、抗議強度時序預測、最優溝通框架建議、關鍵反對意見摘要 |

---

### 3.4 戰略情報推演（WarGame）

> **引擎**：Concordia v2.0+ · Apache 2.0

| 項目 | 規格 |
|---|---|
| 使用場景 | 地緣政治事件多國輿論連鎖反應、信息戰虛假訊息傳播路徑分析、認知作戰防禦研究 |
| 種子材料 | 情報摘要（去敏感化版）、新聞語料庫、歷史外交案例 |
| 智能體族群 | 各國民眾代表性樣本 + 媒體機構 + 政府/外交官角色 |
| Concordia 核心能力 | 嵌套世界架構（Nested Simulation）：每個國家輿論空間作為獨立 Sub-GM；Simultaneous Engine 多國並行；GM 整合外部 API 呼叫（模擬外交電報）；Grounded Variables 追蹤各國「信任指數」 |
| 多語系模擬 | GM 管理不同語言環境（中/英/日），各語言圈接收不同資訊源 |
| 客戶資格管控 | 僅服務學術機構、智庫、政府研究部門；需簽署使用聲明；定位為防禦性研究工具 |
| 輸出報告 | 各國輿論反應差異熱力圖、信息傳播路徑樹、最優反制策略建議 |

---

### 3.5 娛樂 IP 測試（ContentLab）

> **引擎**：OASIS v0.2.5+ · Apache 2.0

| 項目 | 規格 |
|---|---|
| 使用場景 | 劇本/小說結局方案比較、遊戲新角色接受度測試、預告片輿論反應預測、KOL 危機粉絲反應評估 |
| 種子材料 | 劇本大綱/角色設定文件、現有用戶調查數據、競品 IP 分析報告 |
| 智能體族群 | 依粉絲群特徵建構（年齡、性別、黏著度：死忠/普通/路人） |
| 平台模擬 | Twitter 粉絲標籤社群 + 巴哈姆特動漫板 + Dcard 娛樂板（台灣本地化） |
| OASIS 核心能力 | 快速設定；熱度算法反映「討論熱度 vs 時間衰減」；情緒極化模擬（捍衛派 vs 批評派） |
| 結局對比 | 分別執行兩次 OASIS 模擬（結局 A / 結局 B），比較 48 小時後輿論走向差異 |
| 輸出報告 | 各方案口碑預測分數、熱議關鍵詞雲、觀眾情緒走向曲線、最優方案建議 |

---

### 3.6 教育培訓模擬器（TrainLab）

> **引擎**：Concordia v2.0+ · Apache 2.0

| 項目 | 規格 |
|---|---|
| 使用場景 | MBA 企業決策案例教學、外交官培訓、新聞系假新聞傳播素養、公關系危機管理演練 |
| Concordia 核心能力 | `ManualAction`：學生即時注入自然語言決策；`Checkpoint`：存檔/讀檔；`Prefabs`：課程模板；Sequential Engine：記者會有序發言 |
| 人機互動流程 | 教師設定初始狀態 → 學生輸入決策文字 → GM 解析執行 → 模擬世界響應 → 學生觀察後調整 |
| 評分機制 | Grounded Variables：`brand_score` / `approval_rate` / `media_trust` 三項指標，GM 自動計算最終得分 |
| 課程模板庫 | 企業危機管理（基礎/進階）、外交談判、政策溝通、品牌重建 |
| 商業模式 | 按校/機構年訂閱，含課程模板庫授權；支援 LMS 整合（Canvas/Moodle API） |

---

## 4. 系統架構與技術設計

### 4.1 五階段預測管線（雙引擎共用）

> 五階段管線對外界透明——無論底層使用 OASIS 或 Concordia，使用者介面和 API 規格完全一致。引擎的選擇由 `scenario_type` 自動路由。

| 階段 | 名稱 | 核心處理 | 產出物 |
|---|---|---|---|
| 1 | 知識圖譜建構 | 文件解析 → 分塊 → Embedding → pgvector；LLM 本體論提取（實體/關係/時序） | `documents` 向量索引 + `ontology` JSON |
| 2 | 環境建構 | 依場景選擇引擎；生成 N 個智能體 Persona（人口統計分布）；生成模擬配置 | `agent_profiles` + `simulation_config` |
| 3 | 模擬執行 | SimulationService 啟動對應引擎子程序；JSONL 事件串流存入 DB；支援即時訪談 IPC | `simulation_events` 記錄集 |
| 4 | 報告生成 | ReACT 迴圈：規劃大綱 → 工具呼叫（pgvector 搜索/圖查詢/智能體訪談）→ 合成 Markdown | `report_sections` + `report.md` |
| 5 | 深度互動 | WebSocket 對話：與任意智能體或 ReportAgent 追問；Concordia 場景支援情境再模擬 | `interaction_sessions` |

### 4.2 SimulationService 引擎路由（TypeScript）

```typescript
type ScenarioType =
  | "fin_sentiment"   // → OASIS
  | "content_lab"     // → OASIS
  | "crisis_pr"       // → Concordia
  | "policy_lab"      // → Concordia
  | "war_game"        // → Concordia
  | "train_lab"       // → Concordia

const ENGINE_MAP: Record<ScenarioType, "oasis" | "concordia"> = {
  fin_sentiment: "oasis",
  content_lab:   "oasis",
  crisis_pr:     "concordia",
  policy_lab:    "concordia",
  war_game:      "concordia",
  train_lab:     "concordia",
}

class SimulationService {
  private runners = {
    oasis:     new OasisRunner(),
    concordia: new ConcordiaRunner(),
  }

  async startSimulation(simId: string, config: SimConfig) {
    const engine = ENGINE_MAP[config.scenarioType]
    return this.runners[engine].start(simId, config)
  }

  async forkScenario(simId: string, label: string, overrides: object) {
    // 僅 Concordia 支援
    return this.runners.concordia.sendCommand({
      type: "fork_scenario", label, overrides
    })
  }

  async injectManualAction(simId: string, actorId: string, action: string) {
    // 僅 Concordia 支援（TrainLab 用）
    return this.runners.concordia.sendCommand({
      type: "inject_manual_action", actorId, action
    })
  }
}
```

### 4.3 後端目錄結構（Bun TypeScript）

```
backend/
├── src/
│   ├── index.ts                      # Bun + Hono 應用入口
│   ├── routes/
│   │   ├── projects.ts               # 專案 CRUD
│   │   ├── graph.ts                  # 圖譜建構 API
│   │   ├── simulation.ts             # 模擬執行 API（雙引擎透明）
│   │   ├── report.ts                 # 報告生成 API
│   │   └── interaction.ts            # 深度互動 WebSocket
│   ├── services/
│   │   ├── documentService.ts        # 文件解析/分塊/Embedding
│   │   ├── graphService.ts           # 本體論提取 + pgvector 圖查詢
│   │   ├── agentService.ts           # 智能體人設生成
│   │   ├── simulationService.ts      # 引擎路由核心
│   │   ├── runners/
│   │   │   ├── oasisRunner.ts        # OASIS 子程序管理
│   │   │   └── concordiaRunner.ts    # Concordia 子程序 + Checkpoint
│   │   ├── reportService.ts          # ReACT 報告生成
│   │   ├── vectorService.ts          # pgvector CRUD 抽象層
│   │   └── llmService.ts             # LLM API 統一封裝
│   ├── db/
│   │   ├── client.ts                 # PostgreSQL 連線池（pg）
│   │   ├── migrations/               # SQL Migration 腳本
│   │   └── queries/                  # 型別安全 SQL 查詢函式
│   ├── workers/
│   │   ├── embeddingWorker.ts        # 批量 Embedding（Bun Worker）
│   │   └── reportWorker.ts           # 非同步報告生成
│   └── utils/
│       ├── taskManager.ts            # 背景任務追蹤
│       ├── chunkText.ts              # 文字分塊策略
│       └── logger.ts                 # 結構化日誌（pino）
├── simulations/
│   ├── oasis/
│   │   ├── run_oasis_simulation.py   # OASIS 雙平台模擬器
│   │   ├── oasis_ipc.py              # stdin/stdout IPC
│   │   └── requirements.txt          # camel-oasis==0.2.5
│   └── concordia/
│       ├── run_concordia_sim.py      # Concordia GM 模擬器
│       ├── concordia_ipc.py          # IPC + Checkpoint
│       ├── game_masters/
│       │   ├── crisis_pr_gm.py
│       │   ├── policy_lab_gm.py
│       │   ├── war_game_gm.py
│       │   └── train_lab_gm.py
│       └── requirements.txt          # concordia==2.0.*
├── package.json
├── bunfig.toml
└── docker-compose.yml
```

---

## 5. 完整技術棧

### 5.1 核心引擎（雙引擎 Python）

| 框架 | 出品方 | 版本 | 授權 | 適用場景 |
|---|---|---|---|---|
| OASIS | CAMEL-AI | 0.2.5+ | Apache 2.0 ✅ | 金融情緒、娛樂 IP |
| Concordia | Google DeepMind | v2.0+ | Apache 2.0 ✅ | 危機公關、政策、戰略、教育 |

### 5.2 後端（Bun TypeScript）

| 套件 | 版本 | 用途 | 選用理由 |
|---|---|---|---|
| **Bun** | ≥ 1.1 | JS/TS Runtime | 比 Node.js 快 3–4x，內建 TS，無需 tsconfig |
| **Hono** | ≥ 4.x | Web Framework | 超輕量，Bun 原生，Edge 友好 |
| **openai** | latest | LLM 客戶端 | 相容任何 OpenAI 格式 API |
| **pg** | ≥ 8.x | PostgreSQL 客戶端 | 成熟穩定，Bun 相容 |
| **ioredis** | latest | Redis 客戶端 | 任務快取、LLM 回應 Cache |
| **zod** | latest | 型別驗證 | API 輸入驗證與 Schema 定義 |
| **pino** | latest | 結構化日誌 | 極低開銷，JSON 輸出 |
| **jose** | latest | JWT 認證 | 純 JS 實作，Bun 相容 |
| **pdf-parse** | latest | PDF 文字提取 | 輕量，無二進位依賴 |

### 5.3 資料庫與向量存儲

| 技術 | 版本 | 用途 | 關鍵配置 |
|---|---|---|---|
| **PostgreSQL** | 17 | 主資料庫 | 分區表（`simulation_events` 依 `simulation_id` HASH 分區） |
| **pgvector** | ≥ 0.7 | 向量索引 | HNSW：`m=16, ef_construction=64`（documents/events）；IVFFlat：`lists=50`（agents） |
| **Redis** | 7 | 任務佇列/快取 | LLM 回應 TTL 1h；任務狀態記憶體存儲 |

### 5.4 模擬引擎 Python 依賴

| 套件 | 版本 | 用途 |
|---|---|---|
| Python | 3.11 | 模擬引擎統一運行環境 |
| camel-ai | 0.2.78 | Multi-Agent 編排框架 |
| camel-oasis | 0.2.5 | Twitter/Reddit 社交模擬環境 |
| concordia | 2.0.* | Google DeepMind 通用 Agent 模擬框架 |
| openai (Python) | latest | 模擬引擎 LLM 調用 |
| uv | latest | Python 套件管理器 |

---

## 6. 前端設計規格（React 18）

### 6.1 技術選型

| 技術 | 版本 | 用途 | 選用理由 |
|---|---|---|---|
| **React** | 18 | UI 框架 | 成熟生態、Concurrent Mode、豐富的企業 UI 套件 |
| **TypeScript** | 5.x | 型別安全 | 與後端 Bun TS 共享型別定義（monorepo shared/types） |
| **Vite** | 6.x | 建構工具 | HMR 極快，原生支援 React + TS |
| **TailwindCSS** | v4 | 原子化 CSS | 快速客製化，企業 UI 一致性 |
| **React Router** | v7 | 前端路由 | 對應五步驟工作流導航 |
| **TanStack Query** | v5 | 伺服器狀態管理 | 輪詢任務狀態、自動快取、背景更新 |
| **Zustand** | v5 | 客戶端狀態 | 輕量，無 boilerplate，模擬工作流全域狀態 |
| **D3.js** | v7 | 圖譜視覺化 | 知識圖譜力導向圖、情緒傳播路徑樹 |
| **Recharts** | v2 | 數據圖表 | 情緒走向折線圖、情境分布柱圖 |
| **Axios** | latest | HTTP 客戶端 | 攔截器處理 JWT、統一錯誤處理 |

### 6.2 前端目錄結構

```
frontend/
├── src/
│   ├── main.tsx                      # React 18 入口（createRoot）
│   ├── App.tsx                       # Router + 全域 Provider
│   ├── router/
│   │   └── index.tsx                 # React Router v7 路由配置
│   ├── pages/
│   │   ├── Home.tsx                  # 首頁 / 新建專案
│   │   ├── Step1Graph.tsx            # 步驟 1：圖譜建構
│   │   ├── Step2Setup.tsx            # 步驟 2：環境建構
│   │   ├── Step3Simulation.tsx       # 步驟 3：模擬執行監控
│   │   ├── Step4Report.tsx           # 步驟 4：報告展示
│   │   ├── Step5Interaction.tsx      # 步驟 5：深度互動
│   │   └── TrainLab.tsx              # TrainLab 特殊互動頁（Concordia）
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx          # 整體 Layout（側邊欄 + 主內容）
│   │   │   ├── Sidebar.tsx           # 專案導航側邊欄
│   │   │   └── StepProgress.tsx      # 五步驟進度條組件
│   │   ├── graph/
│   │   │   ├── KnowledgeGraph.tsx    # D3 力導向知識圖譜
│   │   │   └── GraphControls.tsx     # 圖譜縮放/過濾控制
│   │   ├── simulation/
│   │   │   ├── AgentFeed.tsx         # 智能體即時事件串流
│   │   │   ├── SimulationStatus.tsx  # 進度條 + 統計數字
│   │   │   ├── EventTimeline.tsx     # 事件時序軸
│   │   │   ├── ScenarioBranch.tsx    # A/B/C 分支對比（Concordia）
│   │   │   └── ManualActionPanel.tsx # 人機互動面板（TrainLab）
│   │   ├── report/
│   │   │   ├── ReportViewer.tsx      # Markdown 報告渲染
│   │   │   ├── EmotionChart.tsx      # Recharts 情緒走向折線圖
│   │   │   ├── ScenarioDist.tsx      # 情境分布柱狀圖
│   │   │   └── ExportButton.tsx      # PDF/DOCX 匯出
│   │   ├── interaction/
│   │   │   ├── ChatPanel.tsx         # WebSocket 對話面板
│   │   │   └── AgentSelector.tsx     # 智能體選擇器
│   │   └── ui/
│   │       ├── EngineTag.tsx         # OASIS / Concordia 標籤徽章
│   │       ├── ScenarioCard.tsx      # 場景選擇卡片
│   │       ├── TaskProgress.tsx      # 非同步任務輪詢進度條
│   │       └── FileUpload.tsx        # 種子材料上傳（拖放）
│   ├── hooks/
│   │   ├── useSimulation.ts          # 模擬狀態 + TanStack Query 輪詢
│   │   ├── useWebSocket.ts           # WebSocket 連線管理 Hook
│   │   ├── useReport.ts              # 報告生成 + 輪詢
│   │   └── useCheckpoint.ts          # Concordia Checkpoint 操作
│   ├── store/
│   │   ├── projectStore.ts           # Zustand：當前專案狀態
│   │   ├── simulationStore.ts        # Zustand：模擬全域狀態
│   │   └── uiStore.ts                # Zustand：UI 狀態（側邊欄/主題）
│   ├── api/
│   │   ├── client.ts                 # Axios 實例（JWT 攔截器）
│   │   ├── projects.ts               # 專案 API 函式
│   │   ├── simulation.ts             # 模擬 API 函式
│   │   ├── report.ts                 # 報告 API 函式
│   │   └── types.ts                  # API 回應型別（與後端共享）
│   ├── utils/
│   │   ├── engineLabel.ts            # 引擎名稱/顏色映射工具
│   │   └── formatters.ts             # 日期/數字格式化
│   └── styles/
│       └── globals.css               # TailwindCSS 全域樣式
├── shared/                           # monorepo 共用型別（後端也引用）
│   └── types/
│       ├── simulation.ts
│       ├── report.ts
│       └── agent.ts
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 6.3 核心頁面與組件規格

#### Step3Simulation.tsx — 模擬執行監控頁

```tsx
// TanStack Query 輪詢模擬狀態
const { data: status } = useQuery({
  queryKey: ['simulation', simId],
  queryFn: () => api.simulation.getStatus(simId),
  refetchInterval: (data) =>
    data?.status === 'running' ? 2000 : false,  // 執行中每 2 秒輪詢
})

// WebSocket 訂閱即時事件串流
const { events } = useWebSocket(`/ws/simulations/${simId}`)

// 引擎類型決定顯示元件
const engineSpecific = engine === 'concordia'
  ? <ScenarioBranch branches={branches} />    // 顯示 A/B/C 分支
  : <AgentFeed events={events} />             // 顯示事件串流
```

#### ScenarioBranch.tsx — Concordia A/B/C 分支對比（CrisisSimulator 用）

```tsx
interface Branch {
  label: 'A' | 'B' | 'C'
  description: string           // 策略描述
  reputationScore: number       // brand_reputation_score 即時值
  emotionTrend: DataPoint[]     // 情緒走向時序數據
}

// 三欄並排展示各策略的即時演化
<div className="grid grid-cols-3 gap-4">
  {branches.map(branch => (
    <BranchCard key={branch.label} branch={branch} />
  ))}
</div>
```

#### ManualActionPanel.tsx — TrainLab 人機互動面板

```tsx
// 學生輸入決策 → 注入 Concordia ManualAction
const handleAction = async (actionText: string) => {
  await api.simulation.injectManualAction(simId, actorId, actionText)
  // WebSocket 自動接收世界響應
}

// Checkpoint 操作
const { save, load } = useCheckpoint(simId)
```

#### useWebSocket.ts — WebSocket Hook

```tsx
export function useWebSocket(url: string) {
  const [events, setEvents] = useState<SimEvent[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:5001${url}`)

    ws.onmessage = (msg) => {
      const event: SimEvent = JSON.parse(msg.data)
      setEvents(prev => [...prev.slice(-200), event]) // 保留最近 200 筆
    }

    ws.onerror = () => {
      // 自動重連（3 秒後）
      setTimeout(() => { wsRef.current = new WebSocket(url) }, 3000)
    }

    wsRef.current = ws
    return () => ws.close()
  }, [url])

  return { events }
}
```

### 6.4 狀態管理架構

```
TanStack Query（伺服器狀態）
  ├── 模擬狀態輪詢（refetchInterval）
  ├── 報告生成輪詢
  └── 任務進度追蹤

Zustand（客戶端狀態）
  ├── projectStore：{ currentProject, stepIndex }
  ├── simulationStore：{ simId, engine, status, branches[] }
  └── uiStore：{ sidebarOpen, theme }

WebSocket（即時串流）
  └── useWebSocket Hook → events[]（即時智能體行為串流）
```

### 6.5 引擎視覺識別系統

```
OASIS 場景
  主色：#F59E0B（amber）
  標籤：<EngineTag type="oasis" />  →  「OASIS 引擎」
  圖示：社群泡泡圖示

Concordia 場景
  主色：#00C4B4（teal）
  標籤：<EngineTag type="concordia" />  →  「Concordia 引擎」
  圖示：世界分支圖示

頁面整體
  主色：#0F2847（deep navy）
  強調：#6C3FC5（violet，平行世界感）
  背景：#FAFAF9
```

### 6.6 前端路由結構

```tsx
// React Router v7 路由配置
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'projects/:projectId', children: [
        { path: 'step/1', element: <Step1Graph /> },
        { path: 'step/2', element: <Step2Setup /> },
        { path: 'step/3', element: <Step3Simulation /> },
        { path: 'step/4', element: <Step4Report /> },
        { path: 'step/5', element: <Step5Interaction /> },
        { path: 'trainlab', element: <TrainLab /> }, // TrainLab 特殊頁
      ]},
    ]
  }
])
```

---

## 7. API 設計規格

### 7.1 基礎規範

| 規範項目 | 說明 |
|---|---|
| 基礎路徑 | `/api/v1` |
| 認證 | Bearer JWT（`Authorization` 標頭） |
| 統一回應格式 | `{ success, data, error, meta }` |
| 長時任務 | 立即回傳 `task_id` → 前端 TanStack Query 輪詢 `/tasks/:id/status` 或訂閱 WebSocket |
| 引擎透明性 | 所有端點不暴露底層引擎；引擎由 `scenario_type` 自動路由 |
| 分頁格式 | Cursor-based：`{ data[], next_cursor, has_more }` |

### 7.2 核心端點

#### 專案管理

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/projects` | 建立新專案（含 `scenario_type`） |
| `GET` | `/projects` | 列出專案（分頁） |
| `GET` | `/projects/:id` | 取得專案詳情 |
| `DELETE` | `/projects/:id` | 刪除專案 |

#### 圖譜建構（Stage 1）

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/projects/:id/documents` | 上傳種子文件（multipart）→ 非同步 `task_id` |
| `POST` | `/projects/:id/graph/build` | 觸發圖譜建構 → 非同步 `task_id` |
| `GET` | `/projects/:id/graph` | 取得圖譜節點與邊 |
| `POST` | `/projects/:id/graph/search` | 語義搜索圖譜 |

#### 模擬（Stage 2–3）

| 方法 | 路徑 | 說明 | 引擎限制 |
|---|---|---|---|
| `POST` | `/simulations` | 建立模擬 | 無 |
| `POST` | `/simulations/:id/start` | 啟動模擬 | 無 |
| `GET` | `/simulations/:id/status` | 查詢進度 | 無 |
| `GET` | `/simulations/:id/events` | 查詢事件串流 | 無 |
| `POST` | `/simulations/:id/interview` | 訪談智能體 | 無 |
| `POST` | `/simulations/:id/fork` | 分支情境 A/B/C | Concordia 限定 |
| `POST` | `/simulations/:id/checkpoint` | 存檔當前狀態 | Concordia 限定 |
| `POST` | `/simulations/:id/manual-action` | 人類玩家介入 | Concordia 限定（TrainLab） |
| `POST` | `/simulations/:id/set-var` | 設定 Grounded Variable | Concordia 限定 |
| `WS` | `/ws/simulations/:id` | 即時進度推送 | 無 |
| `WS` | `/ws/interactions/:id` | 深度對話 | 無 |

#### 報告（Stage 4–5）

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/simulations/:id/report` | 觸發報告生成 → 非同步 `task_id` |
| `GET` | `/simulations/:id/report` | 取得已生成報告 |
| `GET` | `/simulations/:id/report/export` | 匯出 PDF/DOCX |

---

## 8. 實作路線圖

### 8.1 第一階段 MVP（0–8 週）

> 優先完成 OASIS 路徑（金融情緒），建立第一個可驗證的 Backtest 案例；Concordia 路徑（危機公關）緊接完成；前端使用 React 18 + Vite 建構。

| 週次 | 任務 | 模組 | 完成標準 |
|---|---|---|---|
| W1 | 環境建置：Bun 專案、PostgreSQL + pgvector、Redis、Docker Compose | 基礎設施 | `docker-compose up` 全部健康 |
| W1 | DB Schema + Migration（雙引擎共用表結構） | `db/migrations` | 所有表建立成功 |
| W2 | `llmService` + `vectorService` + `documentService` | `services/` | Unit Test 通過 |
| W2 | `graphService`：本體論提取 + 圖查詢 | `graphService` | 實體提取準確率 ≥ 80% |
| W3 | `OasisRunner`：子程序管理 + JSONL 解析 + DB 存入 | `runners/oasisRunner` | OASIS 模擬完成不崩潰 |
| W3 | `agentService`：人設生成（金融族群模板） | `agentService` | 生成 100 個人設 ≤ 3 分鐘 |
| W4 | `reportService`：ReACT 迴圈 + 工具集 | `reportService` | 生成 3000 字以上結構化報告 |
| W4 | REST API 路由層 + JWT 認證 | `routes/` | Postman Collection 測試通過 |
| W5 | WebSocket 即時進度 + 智能體訪談 IPC（OASIS） | `interaction.ts` | 前端接收即時事件 |
| W5 | React 18 + Vite 前端骨架：AppShell + 路由 + Zustand | `frontend/` | 頁面可切換 |
| W5 | FinSentiment Backtest：台積電法說會歷史案例 | 驗證 | Backtest 報告完成可展示 |
| W6 | `ConcordiaRunner`：子程序 + Checkpoint + `fork_scenario` | `runners/concordiaRunner` | A/B/C 分支輸出差異可觀察 |
| W7 | CrisisSimulator GM 設計（`brand_reputation_score`） | `game_masters/crisis_pr_gm` | 三策略對比圖輸出 |
| W8 | 前端完整五步驟流程 + `EngineTag` + `ScenarioBranch` | `frontend/` | 端對端流程可完整操作 |

### 8.2 第二階段（9–16 週）

| 週次 | 任務 | 完成標準 |
|---|---|---|
| W9–10 | PolicyLab GM（Concordia，公聽會 Sequential Engine）+ 前端族群矩陣視覺化 | 各族群接受度矩陣輸出 |
| W11–12 | TrainLab：`ManualActionPanel` + Checkpoint + 評分 Grounded Variables | 學生可存檔/讀檔/重試，評分自動計算 |
| W13–14 | pgvector Hybrid Search（向量 + BM25 全文混合） | Recall@10 ≥ 85% Benchmark |
| W15–16 | 多租戶支援（資料隔離/配額）+ 報告 PDF/DOCX 匯出 | Pilot 客戶資料隔離；匯出可正常開啟 |

### 8.3 第三階段（17–28 週）

| 週次 | 任務 |
|---|---|
| W17–20 | ContentLab（OASIS）+ WarGame GM（嵌套世界 + 多語系）模組上線 |
| W21–23 | 效能優化：Bun Worker 並行 Embedding；pgvector HNSW 調優；Redis 快取策略 |
| W24–26 | WarGame 客戶資格管控系統 + 學術機構合作通道 |
| W27–28 | API-first：Scalar UI 公開文件 + openapi-ts SDK 生成 |

---

## 9. 開源版權合規聲明

### 9.1 授權摘要

| 框架 | 授權 | 商業使用 | 修改 | 需開源自身程式碼 |
|---|---|---|---|---|
| OASIS（CAMEL-AI） | Apache 2.0 | ✅ | ✅ | ❌ 不需要 |
| Concordia（Google DeepMind） | Apache 2.0 | ✅ | ✅ | ❌ 不需要 |

> Apache 2.0 為「寬鬆授權（Permissive License）」，無 Copyleft 條款。ParaVerse 商業程式碼完全私有。

### 9.2 合規清單

| 合規項目 | OASIS | Concordia | 實作方式 |
|---|---|---|---|
| 文件中標注使用 | ✅ 必要 | ✅ 必要 | 官網「技術支撐」頁面標注 |
| 部署包附 LICENSE 文件 | ✅ 必要 | ✅ 必要 | Docker 映像中包含 `/licenses/OASIS_LICENSE` + `/licenses/CONCORDIA_LICENSE` |
| 商標使用限制 | 不得暗示官方認可 | 不得暗示官方認可 | 行銷材料用「基於 OASIS 引擎」，非「OASIS 官方產品」 |
| 學術引用（發表研究時） | arXiv:2411.11581 | arXiv:2312.03664 | PolicyLab/WarGame 輸出用於學術發表時附引用 |

---

## 10. 風險分析

| 風險 | 影響 | 緩解策略 |
|---|---|---|
| LLM 幻覺導致系統性預測偏誤（最大技術風險） | 高 | 歷史事件 Backtest 量化偏誤率；輸出情境分布而非單點預測；報告明確標注「AI 生成，僅供參考」 |
| Concordia v2.0 尚未大規模商業場景驗證 | 中 | MVP 先以小規模（20–50 智能體）穩定性測試；保留 OASIS 作為 fallback |
| 雙引擎維護成本（Python 依賴升級） | 中 | 各引擎獨立 venv；固定版本 lock file；CI/CD 自動化依賴測試 |
| Token 消耗成本過高 | 高 | Redis LLM 回應快取（TTL 30 分鐘）；提供低成本「草稿模式」（20 智能體/10 回合） |
| 選舉預測被媒體放大 | 高 | 初期聚焦 B2B 場景；輸出情境分布規避單一預測責任 |
| pgvector HNSW 百萬向量性能下降 | 中 | 分表策略（每個 simulation 獨立向量表）；定期 VACUUM ANALYZE |
| React 前端與 Bun 後端 CORS 設定 | 低 | Hono 內建 CORS middleware；開發環境用 Vite proxy |

---

## 11. 商業模式

### 11.1 定價方案

| 方案 | 月費（NTD） | 模擬次數/月 | 智能體上限 | 引擎 | 適用對象 |
|---|---|---|---|---|---|
| Starter（免費） | 0 | 2 次 | 50 個 | OASIS | 新創、學術研究 |
| Professional | 9,900 | 10 次 | 200 個 | 雙引擎 | 中小企業、顧問公司 |
| Business | 29,900 | 40 次 | 500 個 | 雙引擎 | 大型企業、PR 公司 |
| Enterprise | 客製化 | 無上限 | 1,000+ 個 | 雙引擎 + On-premise | 金融機構、政府機關 |

> **WarGame 場景**（戰略情報推演）僅開放通過資格審查的學術機構與智庫，採個案洽談模式。

### 11.2 三段式市場攻略

| 階段 | 時間 | 主攻場景 | 引擎重點 | 里程碑 |
|---|---|---|---|---|
| 第一階段 | 0–6 個月 | FinSentiment + ContentLab | OASIS 先行 | 2 個 Backtest 案例；5 個 Pilot 客戶；ARR NTD 60 萬 |
| 第二階段 | 6–18 個月 | CrisisSimulator（付費意願最高） | Concordia 主攻 | 10 個付費企業客戶；ARR NTD 300 萬 |
| 第三階段 | 18 個月+ | PolicyLab + WarGame（智庫/政府） | 雙引擎全開 | 政府框架合約；ARR NTD 1,200 萬 |

---

## 12. 附錄

### 附錄 A：資料庫完整 Schema（PostgreSQL + pgvector）

```sql
-- 啟用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 專案（含場景類型 → 決定引擎）
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  scenario_type VARCHAR(30) NOT NULL,
  -- fin_sentiment|content_lab|crisis_pr|policy_lab|war_game|train_lab
  owner_id      UUID NOT NULL,
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 種子文件（含向量）
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  filename    VARCHAR(500),
  content     TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  embedding   vector(1536),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_doc_emb ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 本體論節點
CREATE TABLE ontology_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,  -- person|org|event|concept
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  embedding   vector(1536),
  properties  JSONB DEFAULT '{}'
);

-- 本體論邊（關係）
CREATE TABLE ontology_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id  UUID REFERENCES ontology_nodes(id),
  target_node_id  UUID REFERENCES ontology_nodes(id),
  relation_type   VARCHAR(100) NOT NULL,
  weight          FLOAT DEFAULT 1.0,
  metadata        JSONB DEFAULT '{}'
);

-- 模擬（記錄使用的引擎）
CREATE TABLE simulations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES projects(id),
  engine           VARCHAR(20) NOT NULL,  -- oasis | concordia
  status           VARCHAR(30) DEFAULT 'pending',
  config           JSONB NOT NULL,
  checkpoint_path  TEXT,             -- Concordia 存檔路徑
  grounded_vars    JSONB DEFAULT '{}',  -- Concordia 數值變數
  stats            JSONB DEFAULT '{}',
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 情境分支（Concordia fork_scenario）
CREATE TABLE scenario_branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id),
  branch_label  VARCHAR(100) NOT NULL,  -- A | B | C
  description   TEXT,
  override_vars JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 智能體人設
CREATE TABLE agent_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  name          VARCHAR(100),
  persona       TEXT NOT NULL,
  embedding     vector(1536),
  demographics  JSONB NOT NULL,
  memory        JSONB[] DEFAULT ARRAY[]::JSONB[]
);
CREATE INDEX idx_agent_emb ON agent_profiles
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- 模擬事件串流（高寫入量，Hash 分區）
CREATE TABLE simulation_events (
  id            BIGSERIAL,
  simulation_id UUID,
  branch_id     UUID REFERENCES scenario_branches(id),
  agent_id      UUID,
  event_type    VARCHAR(50) NOT NULL,
  platform      VARCHAR(30),  -- twitter|reddit|concordia_world
  content       TEXT,
  embedding     vector(1536),
  sim_timestamp INTEGER,
  metadata      JSONB DEFAULT '{}'
) PARTITION BY HASH (simulation_id);
CREATE INDEX idx_event_emb ON simulation_events
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 報告章節
CREATE TABLE report_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id),
  section_order INTEGER,
  title         VARCHAR(200),
  content       TEXT,
  tool_calls    JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 互動會話
CREATE TABLE interaction_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id),
  actor_type    VARCHAR(20),  -- agent | report_agent | human（TrainLab）
  actor_id      UUID,
  messages      JSONB[] DEFAULT ARRAY[]::JSONB[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 附錄 B：環境變數清單

| 變數 | 說明 | 範例值 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 連線字串 | `postgresql://user:pass@localhost:5432/paraverse` |
| `REDIS_URL` | Redis 連線字串 | `redis://localhost:6379` |
| `LLM_API_KEY` | LLM API 金鑰 | `sk-xxxxxxxx` |
| `LLM_BASE_URL` | LLM API 基礎 URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_MODEL_GENERAL` | 一般模型（智能體） | `qwen-plus` |
| `LLM_MODEL_BOOST` | 高效能模型（報告/GM） | `qwen-max` |
| `EMBEDDING_MODEL` | Embedding 模型 | `text-embedding-3-small` |
| `JWT_SECRET` | JWT 簽名金鑰（≥ 32 字元） | `your-secret-key-here` |
| `OASIS_PYTHON` | OASIS venv Python 路徑 | `./simulations/oasis/.venv/bin/python` |
| `CONCORDIA_PYTHON` | Concordia venv Python 路徑 | `./simulations/concordia/.venv/bin/python` |
| `SIM_MAX_MEMORY_MB` | 子程序記憶體上限 | `2048` |
| `PORT` | API 伺服器端口 | `5001` |
| `VITE_API_BASE_URL` | 前端 API 基礎 URL | `http://localhost:5001/api/v1` |
| `VITE_WS_BASE_URL` | 前端 WebSocket URL | `ws://localhost:5001` |

---

### 附錄 C：Docker Compose 配置骨架

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: paraverse
      POSTGRES_USER: paraverse
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.bun
    environment:
      DATABASE_URL: postgresql://paraverse:${DB_PASSWORD}@postgres:5432/paraverse
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    ports:
      - "5001:5001"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.react
    ports:
      - "3000:3000"
    environment:
      VITE_API_BASE_URL: http://backend:5001/api/v1
      VITE_WS_BASE_URL: ws://backend:5001

volumes:
  pgdata:
```

---

*© 2026 Plusblocks Technology Limited · ParaVerse PRD v2.1 · 機密文件*
*引擎授權：OASIS © CAMEL-AI (Apache 2.0) · Concordia © Google DeepMind (Apache 2.0)*
