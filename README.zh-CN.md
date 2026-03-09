# ParaVerse — 群体智能预测分析平台

[English](./README.md) | **中文**

ParaVerse 是一个 B2B 多智能体仿真 SaaS 平台，搭载双引擎架构 — [OASIS](https://github.com/camel-ai/oasis)（CAMEL-AI）和 [Concordia](https://github.com/google-deepmind/concordia)（Google DeepMind）。通过 AI 驱动的智能体仿真，帮助企业建模复杂社会动态、预测舆情变化，并分析多场景结果分布。

> **核心理念**：不做单点预测，而是通过多智能体仿真生成场景分布报告，让决策者看到"如果……会怎样"的全景图。

---

## 功能特性

- **双仿真引擎** — OASIS 支持社交媒体模拟（Twitter/Reddit），Concordia 支持游戏主持人驱动的场景（含可观测变量与分支）
- **五阶段流水线** — 知识图谱 → 环境配置 → 仿真运行 → 报告生成 → 深度交互
- **知识图谱（GraphRAG）** — 上传文档（PDF/TXT/MD），LLM 自动抽取实体和关系，向量嵌入支持语义搜索
- **LLM 驱动智能体** — 由大模型生成具有丰富人设的智能体，每个智能体拥有独特的人口统计、性格和决策逻辑
- **实时监控** — 基于 WebSocket 的仿真事件实时推送
- **场景分支** — A/B/C 策略对比，含可观测变量追踪（Concordia 引擎）
- **自动报告生成** — 多章节分析报告，包含执行摘要、方法论、关键发现和建议
- **智能体访谈** — 在仿真期间或之后与智能体实时对话
- **多租户认证** — 基于 JWT 的注册、登录、令牌刷新

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | [Bun](https://bun.sh) 1.3+ / [Hono](https://hono.dev) 4.x / TypeScript |
| **前端** | [React](https://react.dev) 19 / [Vite](https://vite.dev) 7 / [TailwindCSS](https://tailwindcss.com) v4 / [React Router](https://reactrouter.com) v7 |
| **状态管理** | [Zustand](https://zustand.docs.pmnd.rs) v5 / [TanStack Query](https://tanstack.com/query) v5 |
| **可视化** | [D3.js](https://d3js.org) v7 / [Recharts](https://recharts.org) v3 |
| **数据库** | PostgreSQL 17 + [pgvector](https://github.com/pgvector/pgvector) / Redis 7 |
| **大模型** | OpenAI SDK 兼容接口（默认：Gemini 2.5 Flash） |
| **OASIS 引擎** | [CAMEL-AI](https://github.com/camel-ai/camel) ChatAgent (Python 3.12) |
| **Concordia 引擎** | [gdm-concordia](https://pypi.org/project/gdm-concordia/) 2.4+ (Python 3.12) |
| **认证** | JWT (jose) / Argon2 密码哈希 |
| **数据校验** | Zod 模式验证 |
| **测试** | Bun test（后端）/ Playwright（E2E） |

---

## 架构概览

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│   前端       │────▶│              后端 (Bun/Hono)              │
│  React 19    │◀────│                                          │
│  Vite 7      │ WS  │  路由 ─▶ 服务层 ─▶ 数据库查询            │
└─────────────┘     │                │                          │
                     │         ┌──────┴───────┐                 │
                     │         ▼              ▼                 │
                     │   ┌──────────┐  ┌────────────┐          │
                     │   │  OASIS   │  │ Concordia  │          │
                     │   │ (Python) │  │  (Python)  │          │
                     │   └──────────┘  └────────────┘          │
                     │    JSONL IPC     JSONL IPC               │
                     └──────────────────────────────────────────┘
                              │              │
                     ┌────────┴──┐    ┌──────┴──┐
                     │PostgreSQL │    │  Redis  │
                     │+ pgvector │    │         │
                     └───────────┘    └─────────┘
```

**IPC 协议**：后端通过 stdin/stdout JSONL（JSON Lines）协议与 Python 仿真引擎通信。每个仿真作为独立子进程运行，拥有独立的 Python 虚拟环境。

---

## 快速开始

### 前置条件

- [Bun](https://bun.sh) >= 1.3
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Python 3.12+
- Gemini API 密钥（或任何 OpenAI 兼容的 LLM 端点）

### 1. 克隆与安装

```bash
git clone https://github.com/plusblocks/paraverse.git
cd paraverse

# 安装后端依赖
cd backend && bun install && cd ..

# 安装前端依赖
cd frontend && bun install && cd ..
```

### 2. 启动基础设施

```bash
# 启动 PostgreSQL + Redis
docker compose up -d postgres redis

# 确认服务健康
docker compose ps
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置必要的值：

```bash
LLM_API_KEY=your-gemini-api-key        # 必填：Gemini API 密钥
JWT_SECRET=your-secret-32-chars-min     # 必填：JWT 签名密钥（至少32字符）
```

复制到后端目录：

```bash
cp .env backend/.env
```

### 4. 运行数据库迁移

```bash
cd backend && bun run src/db/migrate.ts
```

### 5. 配置 Python 仿真环境

```bash
# OASIS 引擎（CAMEL-AI）
python3 -m venv backend/simulations/oasis/.venv
backend/simulations/oasis/.venv/bin/pip install -r backend/simulations/oasis/requirements.txt

# Concordia 引擎
python3 -m venv backend/simulations/concordia/.venv
backend/simulations/concordia/.venv/bin/pip install -r backend/simulations/concordia/requirements.txt
```

### 6. 启动开发服务器

```bash
# 终端 1：后端
cd backend && bun run src/index.ts

# 终端 2：前端
cd frontend && bun run dev
```

在浏览器中打开 http://localhost:3000。

---

## Docker 部署

```bash
# 设置必需的环境变量
export JWT_SECRET="your-production-secret-here"
export LLM_API_KEY="your-gemini-api-key"

# 构建并启动所有服务
docker compose up -d --build

# 前端：http://localhost:3000
# 后端 API：http://localhost:5001
```

---

## 使用流程

### 第一步：知识图谱

上传 PDF、TXT 或 MD 格式的种子文档。系统自动提取文本，通过 LLM 识别实体和关系，构建知识图谱。支持 D3.js 可视化和图谱搜索。

### 第二步：环境配置

设置仿真参数：智能体数量、仿真轮次、种子上下文、平台类型。系统自动根据场景类型选择引擎（OASIS 或 Concordia），并通过 LLM 生成具有丰富人设的智能体。

### 第三步：仿真运行

启动仿真后，可通过 WebSocket 实时接收事件流。支持中途注入事件、访谈智能体。OASIS 引擎下智能体在模拟社交平台上发帖、回复、互动；Concordia 引擎下智能体在游戏主持人引导下做出决策。

### 第四步：报告生成

仿真完成后，LLM 自动分析事件数据、智能体行为和可观测变量，生成多章节报告：

- 执行摘要
- 方法论
- 关键发现
- 情感分析
- 建议

### 第五步：深度交互

与仿真中的智能体进行一对一对话，深入了解其决策动机和观点。智能体会基于仿真中的经历和记忆来回答问题。

---

## 场景类型

| 类型 | 引擎 | 描述 |
|------|------|------|
| `fin_sentiment` | OASIS | 金融舆情分析 — 模拟投资者、分析师、媒体在社交平台上的互动 |
| `content_lab` | OASIS | 内容创作与传播 — 分析内容在社交媒体上的传播动态 |
| `crisis_pr` | Concordia | 危机公关 — 模拟品牌危机下的多方博弈，支持 A/B/C 策略对比 |
| `policy_lab` | Concordia | 政策影响模拟 — 评估政策对不同利益相关方的影响 |
| `war_game` | Concordia | 地缘政治场景建模 — 模拟国际关系中的多方决策 |
| `train_lab` | Concordia | 培训与决策演练 — 沉浸式场景训练 |

---

## API 概览

所有 API 路由以 `/api/v1` 为前缀，通过 `Authorization: Bearer <token>` 请求头认证。

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/auth/register` | 注册新用户 |
| POST | `/auth/login` | 登录 |
| POST | `/auth/refresh` | 刷新令牌 |
| GET | `/projects` | 获取项目列表 |
| POST | `/projects` | 创建项目 |
| POST | `/projects/:id/documents` | 上传文档 |
| POST | `/projects/:id/graph/build` | 构建知识图谱 |
| GET | `/projects/:id/graph` | 获取知识图谱 |
| POST | `/simulations` | 创建仿真 |
| POST | `/simulations/:id/start` | 启动仿真 |
| GET | `/simulations/:id/status` | 获取仿真状态 |
| GET | `/simulations/:id/events` | 获取仿真事件 |
| POST | `/simulations/:id/interview` | 访谈智能体 |
| POST | `/simulations/:id/fork` | 场景分支（Concordia） |
| POST | `/simulations/:id/report` | 生成报告 |
| GET | `/simulations/:id/report` | 获取报告 |
| GET | `/tasks/:id` | 轮询异步任务状态 |
| WS | `/ws/simulations/:id` | 实时仿真事件推送 |

---

## 环境变量

| 变量 | 必填 | 默认值 | 描述 |
|------|------|--------|------|
| `DATABASE_URL` | 是 | — | PostgreSQL 连接字符串 |
| `REDIS_URL` | 是 | — | Redis 连接字符串 |
| `JWT_SECRET` | 是 | — | JWT 签名密钥（至少32字符） |
| `LLM_API_KEY` | 是 | — | LLM API 密钥 |
| `LLM_BASE_URL` | 否 | Gemini 端点 | LLM API 基础 URL |
| `LLM_MODEL_GENERAL` | 否 | `gemini-2.5-flash` | 通用 LLM 模型 |
| `LLM_MODEL_BOOST` | 否 | `gemini-2.5-flash` | 高质量 LLM 模型 |
| `EMBEDDING_MODEL` | 否 | `gemini-embedding-001` | 嵌入模型 |
| `PORT` | 否 | `5001` | 后端服务端口 |

---

## 测试

```bash
# 后端单元测试和集成测试
cd backend && bun test

# 前端 E2E 测试（需要先启动开发服务器）
cd frontend && bunx playwright install --with-deps
cd frontend && bunx playwright test
```

---

## 项目结构

```
paraverse/
├── backend/                    # Bun/Hono API 服务器
│   ├── src/
│   │   ├── routes/             # API 端点
│   │   ├── services/           # 业务逻辑和 LLM 集成
│   │   │   └── runners/        # Python 子进程管理器
│   │   ├── db/
│   │   │   ├── migrations/     # 13 个 SQL 迁移文件
│   │   │   └── queries/        # 原始 SQL 查询模块
│   │   └── middleware/         # 认证、错误处理、限流
│   ├── simulations/
│   │   ├── oasis/              # OASIS 引擎
│   │   └── concordia/          # Concordia 引擎
│   └── tests/                  # 单元测试和集成测试
├── frontend/                   # React 单页应用
│   ├── src/
│   │   ├── pages/              # 5 步骤工作流页面
│   │   ├── components/         # UI 组件
│   │   ├── api/                # API 客户端
│   │   ├── store/              # Zustand 状态管理
│   │   └── hooks/              # 自定义 React Hooks
│   └── e2e/                    # Playwright E2E 测试
├── shared/                     # 共享 TypeScript 类型
├── docker-compose.yml          # 全栈 Docker 配置
└── .env.example                # 环境变量模板
```

---

## 许可证

Copyright (c) 2026 Plusblocks Technology Limited. 保留所有权利。

---

## 贡献

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

基于 [CAMEL-AI](https://github.com/camel-ai/camel) 和 [Concordia](https://github.com/google-deepmind/concordia) 构建 | 由 [Gemini](https://ai.google.dev/) 驱动
