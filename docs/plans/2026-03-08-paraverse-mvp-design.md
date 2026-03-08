# ParaVerse Phase 1 MVP Design

> Date: 2026-03-08
> Scope: W1–W8 of PRD v2.1 roadmap
> Approved decisions from brainstorming session

---

## Summary of Decisions

| Decision | Choice |
|---|---|
| Scope | Phase 1 MVP (W1–W8): Infra + OASIS FinSentiment + Concordia CrisisSimulator + full frontend |
| LLM Provider | OpenAI SDK (compatible mode), Gemini 2.5 Flash as primary/default |
| Simulation Engines | Fully integrate both OASIS + Concordia (real engines, not mocks) |
| Authentication | Full auth flow: registration, login, JWT, multi-tenant data isolation |
| Database Access | Raw `pg` + hand-written SQL + manual migration files |
| Monorepo | Simple directory structure (`backend/`, `frontend/`, `shared/`) with TS path aliases |
| Python Env | `uv` for both engine venvs |
| Testing | Comprehensive: unit + integration + E2E (Playwright) |
| Language | English code/variables/comments, Chinese for design docs/user-facing content |
| Approach | PRD-faithful sequential (bottom-up: infra → services → engines → API → frontend) |

---

## 1. Project Structure

```
paraverse/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Bun + Hono entry
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── projects.ts
│   │   │   ├── graph.ts
│   │   │   ├── simulation.ts
│   │   │   ├── report.ts
│   │   │   ├── interaction.ts
│   │   │   └── tasks.ts
│   │   ├── services/
│   │   │   ├── llmService.ts
│   │   │   ├── vectorService.ts
│   │   │   ├── documentService.ts
│   │   │   ├── graphService.ts
│   │   │   ├── agentService.ts
│   │   │   ├── simulationService.ts
│   │   │   ├── reportService.ts
│   │   │   ├── runners/
│   │   │   │   ├── oasisRunner.ts
│   │   │   │   └── concordiaRunner.ts
│   │   │   └── authService.ts
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── migrate.ts
│   │   │   ├── migrations/
│   │   │   └── queries/
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── rateLimit.ts
│   │   ├── workers/
│   │   │   ├── embeddingWorker.ts
│   │   │   └── reportWorker.ts
│   │   └── utils/
│   │       ├── taskManager.ts
│   │       ├── chunkText.ts
│   │       └── logger.ts
│   ├── simulations/
│   │   ├── oasis/
│   │   │   ├── run_oasis_simulation.py
│   │   │   ├── oasis_ipc.py
│   │   │   ├── agent_factory.py
│   │   │   ├── platform_config.py
│   │   │   └── requirements.txt
│   │   └── concordia/
│   │       ├── run_concordia_sim.py
│   │       ├── concordia_ipc.py
│   │       ├── agent_factory.py
│   │       ├── game_masters/
│   │       │   ├── base_gm.py
│   │       │   └── crisis_pr_gm.py
│   │       └── requirements.txt
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── setup.ts
│   ├── package.json
│   └── bunfig.toml
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── router/
│   │   │   └── index.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Step1Graph.tsx
│   │   │   ├── Step2Setup.tsx
│   │   │   ├── Step3Simulation.tsx
│   │   │   ├── Step4Report.tsx
│   │   │   ├── Step5Interaction.tsx
│   │   │   └── TrainLab.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── StepProgress.tsx
│   │   │   ├── graph/
│   │   │   │   ├── KnowledgeGraph.tsx
│   │   │   │   └── GraphControls.tsx
│   │   │   ├── simulation/
│   │   │   │   ├── AgentFeed.tsx
│   │   │   │   ├── SimulationStatus.tsx
│   │   │   │   ├── EventTimeline.tsx
│   │   │   │   ├── ScenarioBranch.tsx
│   │   │   │   └── ManualActionPanel.tsx
│   │   │   ├── report/
│   │   │   │   ├── ReportViewer.tsx
│   │   │   │   ├── EmotionChart.tsx
│   │   │   │   ├── ScenarioDist.tsx
│   │   │   │   └── ExportButton.tsx
│   │   │   ├── interaction/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   └── AgentSelector.tsx
│   │   │   └── ui/
│   │   │       ├── EngineTag.tsx
│   │   │       ├── ScenarioCard.tsx
│   │   │       ├── TaskProgress.tsx
│   │   │       └── FileUpload.tsx
│   │   ├── hooks/
│   │   │   ├── useSimulation.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useReport.ts
│   │   │   ├── useCheckpoint.ts
│   │   │   └── useAuth.ts
│   │   ├── store/
│   │   │   ├── projectStore.ts
│   │   │   ├── simulationStore.ts
│   │   │   └── uiStore.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── projects.ts
│   │   │   ├── simulation.ts
│   │   │   ├── report.ts
│   │   │   └── types.ts
│   │   ├── utils/
│   │   │   ├── engineLabel.ts
│   │   │   └── formatters.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── e2e/
│   │   └── critical-flow.spec.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── shared/
│   └── types/
│       ├── simulation.ts
│       ├── report.ts
│       ├── agent.ts
│       ├── project.ts
│       └── api.ts
├── docker-compose.yml
├── .env.example
└── ParaVerse_PRD_v2.1.md
```

---

## 2. Database Schema

11 tables total. Based on PRD Appendix A with additions:

### Added tables (not in PRD)

**`users`** — Multi-tenant auth:
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          VARCHAR(20) DEFAULT 'user',  -- admin | user
  quota         JSONB DEFAULT '{"simulations_per_month": 2, "max_agents": 50}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**`tasks`** — Async task tracking:
```sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          VARCHAR(50) NOT NULL,  -- document_process | graph_build | simulation | report_generate
  reference_id  UUID NOT NULL,         -- project_id or simulation_id
  owner_id      UUID REFERENCES users(id),
  status        VARCHAR(20) DEFAULT 'pending',  -- pending | running | completed | failed
  progress      INTEGER DEFAULT 0,     -- 0-100
  result        JSONB DEFAULT '{}',
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### PRD tables (as specified)

All tables from PRD Appendix A: `projects`, `documents`, `ontology_nodes`, `ontology_edges`, `simulations`, `scenario_branches`, `agent_profiles`, `simulation_events` (hash-partitioned), `report_sections`, `interaction_sessions`.

Migration files numbered: `001_create_extensions.sql` through `012_create_partitions.sql`.

---

## 3. Core Services

### Service dependency chain

```
llmService (OpenAI SDK → Gemini 2.5 Flash)
  ↑
vectorService (pgvector CRUD)
  ↑
documentService (PDF parse → chunk → embed → store)
  ↑
graphService (LLM ontology extraction, graph queries)
  ↑
agentService (persona generation from graph + demographics)
  ↑
simulationService (engine router → OasisRunner | ConcordiaRunner)
  ↑
reportService (ReACT loop: plan → tools → synthesize)
```

### llmService

- OpenAI SDK with configurable base URL (Gemini 2.5 Flash default)
- Two model tiers via env: `LLM_MODEL_GENERAL` (agents) / `LLM_MODEL_BOOST` (reports/GM)
- Methods: `chat()`, `complete()`, `embed()`, `chatStream()`
- Redis caching for identical prompts (TTL 1h)

### simulationService — Engine routing

- `ENGINE_MAP` routes `scenario_type` → `oasis` | `concordia`
- Spawns Python subprocess via `Bun.spawn()`
- IPC: stdin (JSON commands) / stdout (JSONL events) / stderr (error logs)
- Memory limit: `SIM_MAX_MEMORY_MB` env var
- Concordia-only commands validated before dispatch: `fork_scenario`, `save_checkpoint`, `load_checkpoint`, `inject_manual_action`, `set_grounded_var`

### IPC event format (shared)

```json
{"type": "agent_action", "agent_id": "uuid", "action": "post", "content": "...", "tick": 5, "metadata": {}}
{"type": "grounded_var", "var_name": "brand_reputation_score", "value": 72.5, "tick": 5}
{"type": "branch_update", "branch_id": "A", "summary": "...", "tick": 5}
{"type": "simulation_complete", "stats": {"total_events": 1234, "ticks": 50}}
```

---

## 4. Python Simulation Engines

### OASIS (`simulations/oasis/`)

- `run_oasis_simulation.py`: Main entry, receives config via stdin JSONL, emits events
- `oasis_ipc.py`: IPC protocol handler
- `agent_factory.py`: Builds OASIS agents from persona JSON
- `platform_config.py`: Twitter-like / Reddit-like platform setup
- Dependencies: `camel-ai`, `camel-oasis==0.2.5`, `openai`
- Supports: `start_simulation`, `inject_event`, `interview_agent`, `get_status`, `stop_simulation`

### Concordia (`simulations/concordia/`)

- `run_concordia_sim.py`: Main entry, GM-based simulation
- `concordia_ipc.py`: IPC + checkpoint serialization
- `agent_factory.py`: Builds Concordia agents with Components
- `game_masters/crisis_pr_gm.py`: CrisisSimulator GM with `brand_reputation_score` Grounded Variable, A/B/C fork support
- Dependencies: `concordia==2.0.*`, `openai`
- Supports all OASIS commands plus: `save_checkpoint`, `load_checkpoint`, `inject_manual_action`, `set_grounded_var`, `fork_scenario`

---

## 5. API Design

### Authentication

- `POST /api/v1/auth/register` → create user, return JWT
- `POST /api/v1/auth/login` → verify credentials, return access + refresh tokens
- `POST /api/v1/auth/refresh` → rotate access token
- Argon2 password hashing, JWT via `jose`, access TTL 1h, refresh TTL 7d

### Route groups

All routes prefixed `/api/v1`, require JWT except auth routes.

| Group | Key Endpoints |
|---|---|
| Projects | CRUD `/projects` — scoped by owner_id |
| Documents | `POST /projects/:id/documents` (multipart) → async task_id |
| Graph | `POST .../graph/build` → task_id, `GET .../graph`, `POST .../graph/search` |
| Simulations | `POST /simulations`, `.../start`, `.../status`, `.../events`, `.../interview` |
| Concordia-only | `.../fork`, `.../checkpoint`, `.../manual-action`, `.../set-var` |
| Report | `POST .../report` → task_id, `GET .../report`, `GET .../report/export` |
| Tasks | `GET /tasks/:id/status` — polling for async ops |
| WebSocket | `WS /ws/simulations/:id`, `WS /ws/interactions/:id` |

### Middleware stack

```
CORS → Rate limiter (ioredis) → JWT auth → Zod validation → Handler → Error handler
```

### Response format

```json
{ "success": true, "data": {}, "error": null, "meta": { "cursor": "...", "has_more": false } }
```

---

## 6. Frontend Architecture

### Tech stack

React 18 + TypeScript + Vite 6 + TailwindCSS v4 + React Router v7 + TanStack Query v5 + Zustand v5 + D3.js v7 + Recharts v2 + Axios

### Pages

| Page | Route | Key Behavior |
|---|---|---|
| Login / Register | `/login`, `/register` | Auth forms, redirect to Home |
| Home | `/` | Scenario card grid, create project |
| Step 1: Graph | `/projects/:id/step/1` | File upload → task polling → D3 graph render |
| Step 2: Setup | `/projects/:id/step/2` | Agent config, demographics, engine tag |
| Step 3: Simulation | `/projects/:id/step/3` | WebSocket events + polling; OASIS→AgentFeed, Concordia→ScenarioBranch |
| Step 4: Report | `/projects/:id/step/4` | Task polling → markdown report + charts |
| Step 5: Interaction | `/projects/:id/step/5` | WebSocket chat with agents |
| TrainLab | `/projects/:id/trainlab` | ManualAction + Checkpoint (Concordia) |

### State management

- **TanStack Query**: server state, polling (2s for running simulations)
- **Zustand**: `projectStore`, `simulationStore`, `uiStore`
- **WebSocket**: `useWebSocket` hook with auto-reconnect (3s backoff)

### Visual identity

- Primary: `#0F2847` (deep navy), Accent: `#6C3FC5` (violet)
- OASIS: `#F59E0B` (amber), Concordia: `#00C4B4` (teal)
- Background: `#FAFAF9`

---

## 7. Testing Strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | `bun test` | Services, utils, query functions |
| Integration | `bun test` + test DB (`paraverse_test`) | API routes, auth flow, WebSocket |
| E2E | Playwright | Login → create project → simulate → report → interact |

Test DB is truncated between test runs. Python subprocesses mocked in integration tests.

---

## 8. Environment Variables

As specified in PRD Appendix B, with adjustments:

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | PostgreSQL 17 + pgvector |
| `REDIS_URL` | `redis://localhost:6379` | Task queue + LLM cache |
| `LLM_API_KEY` | — | Gemini API key |
| `LLM_BASE_URL` | Gemini compatible endpoint | OpenAI SDK compatible |
| `LLM_MODEL_GENERAL` | `gemini-2.5-flash` | Agent-tier model |
| `LLM_MODEL_BOOST` | `gemini-2.5-flash` | Report/GM-tier model |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Or Gemini embedding model |
| `JWT_SECRET` | — | >=32 chars |
| `OASIS_PYTHON` | `./simulations/oasis/.venv/bin/python` | |
| `CONCORDIA_PYTHON` | `./simulations/concordia/.venv/bin/python` | |
| `SIM_MAX_MEMORY_MB` | `2048` | Python subprocess limit |
| `PORT` | `5001` | Backend port |

---

## 9. Implementation Order (W1–W8)

| Week | Tasks |
|---|---|
| W1 | Bun project scaffold, Docker Compose, DB schema + migrations, basic auth |
| W2 | llmService, vectorService, documentService, graphService + unit tests |
| W3 | OasisRunner IPC, agentService (FinSentiment templates), OASIS Python scripts |
| W4 | reportService (ReACT), REST API routes, JWT middleware, integration tests |
| W5 | WebSocket, agent interview IPC, React frontend skeleton, FinSentiment backtest |
| W6 | ConcordiaRunner IPC, checkpoint, fork_scenario |
| W7 | CrisisSimulator GM (brand_reputation_score, A/B/C branches) |
| W8 | Frontend complete 5-step flow, EngineTag, ScenarioBranch, E2E tests |
