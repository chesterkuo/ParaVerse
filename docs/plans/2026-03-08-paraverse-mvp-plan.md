# ParaVerse Phase 1 MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full Phase 1 MVP (W1–W8) of the ParaVerse dual-engine multi-agent simulation platform.

**Architecture:** Bun + Hono backend with PostgreSQL/pgvector + Redis, Python subprocesses for OASIS and Concordia simulation engines communicating via stdin/stdout JSONL IPC, React 18 + Vite frontend with TanStack Query + Zustand + WebSocket for real-time updates.

**Tech Stack:** Bun 1.3+, Hono 4.x, PostgreSQL 17 + pgvector, Redis 7, Python 3.12, OASIS (camel-oasis), Concordia 2.0, React 18, Vite 6, TailwindCSS v4, TanStack Query v5, Zustand v5, D3.js v7, Recharts v2, OpenAI SDK (Gemini 2.5 Flash), Playwright

---

## Week 1: Infrastructure & Foundation

### Task 1: Initialize Bun backend project

**Files:**
- Create: `backend/package.json`
- Create: `backend/bunfig.toml`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`

**Step 1: Create backend directory and init project**

```bash
mkdir -p backend && cd backend
bun init -y
```

**Step 2: Install core dependencies**

```bash
cd backend
bun add hono @hono/node-server pg ioredis zod pino jose openai pdf-parse argon2
bun add -d @types/pg @types/pdf-parse bun-types
```

**Step 3: Create bunfig.toml**

```toml
[install]
peer = false

[test]
preload = ["./tests/setup.ts"]
```

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5: Create minimal Hono server entry**

```typescript
// backend/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

const app = new Hono();

app.use("*", cors());
app.use("*", honoLogger());

app.get("/health", (c) => c.json({ status: "ok" }));

const port = parseInt(process.env.PORT || "5001");
console.log(`ParaVerse API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

**Step 6: Verify server starts**

Run: `cd backend && bun run src/index.ts`
Expected: "ParaVerse API running on port 5001"
Test: `curl http://localhost:5001/health` → `{"status":"ok"}`

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: initialize Bun + Hono backend project"
```

---

### Task 2: Initialize shared types package

**Files:**
- Create: `shared/types/api.ts`
- Create: `shared/types/project.ts`
- Create: `shared/types/simulation.ts`
- Create: `shared/types/agent.ts`
- Create: `shared/types/report.ts`

**Step 1: Create shared type definitions**

```typescript
// shared/types/api.ts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: {
    cursor?: string;
    has_more?: boolean;
    total?: number;
  };
}

export interface TaskStatus {
  id: string;
  type: "document_process" | "graph_build" | "simulation" | "report_generate";
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at: string;
}
```

```typescript
// shared/types/project.ts
export type ScenarioType =
  | "fin_sentiment"
  | "content_lab"
  | "crisis_pr"
  | "policy_lab"
  | "war_game"
  | "train_lab";

export type EngineType = "oasis" | "concordia";

export const ENGINE_MAP: Record<ScenarioType, EngineType> = {
  fin_sentiment: "oasis",
  content_lab: "oasis",
  crisis_pr: "concordia",
  policy_lab: "concordia",
  war_game: "concordia",
  train_lab: "concordia",
};

export interface Project {
  id: string;
  name: string;
  scenario_type: ScenarioType;
  owner_id: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface CreateProjectInput {
  name: string;
  scenario_type: ScenarioType;
  settings?: Record<string, unknown>;
}
```

```typescript
// shared/types/simulation.ts
import type { EngineType, ScenarioType } from "./project";

export interface SimConfig {
  scenario_type: ScenarioType;
  agent_count: number;
  tick_count: number;
  seed_context: string;
  platform?: "twitter" | "reddit";
  branches?: BranchConfig[];
  custom_params?: Record<string, unknown>;
}

export interface BranchConfig {
  label: string;
  description: string;
  override_vars: Record<string, unknown>;
}

export interface Simulation {
  id: string;
  project_id: string;
  engine: EngineType;
  status: "pending" | "configuring" | "running" | "completed" | "failed";
  config: SimConfig;
  checkpoint_path?: string;
  grounded_vars: Record<string, number>;
  stats: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface SimEvent {
  id: number;
  simulation_id: string;
  branch_id?: string;
  agent_id?: string;
  event_type: string;
  platform?: string;
  content?: string;
  embedding?: number[];
  sim_timestamp: number;
  metadata: Record<string, unknown>;
}

export interface IpcCommand {
  type:
    | "start_simulation"
    | "inject_event"
    | "interview_agent"
    | "get_status"
    | "stop_simulation"
    | "save_checkpoint"
    | "load_checkpoint"
    | "inject_manual_action"
    | "set_grounded_var"
    | "fork_scenario";
  [key: string]: unknown;
}

export interface IpcEvent {
  type:
    | "agent_action"
    | "grounded_var"
    | "branch_update"
    | "simulation_complete"
    | "error"
    | "interview_response"
    | "status";
  [key: string]: unknown;
}
```

```typescript
// shared/types/agent.ts
export interface AgentProfile {
  id: string;
  simulation_id: string;
  name: string;
  persona: string;
  demographics: {
    age_range: string;
    gender: string;
    occupation: string;
    income_level?: string;
    education?: string;
    personality_type?: string;
    [key: string]: unknown;
  };
  memory: Record<string, unknown>[];
}

export interface AgentDemographicDistribution {
  group_name: string;
  percentage: number;
  traits: Record<string, string>;
}
```

```typescript
// shared/types/report.ts
export interface ReportSection {
  id: string;
  simulation_id: string;
  section_order: number;
  title: string;
  content: string;
  tool_calls: ToolCallRecord[];
  created_at: string;
}

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  timestamp: string;
}

export interface Report {
  simulation_id: string;
  sections: ReportSection[];
  generated_at: string;
}
```

**Step 2: Commit**

```bash
git add shared/
git commit -m "feat: add shared TypeScript type definitions"
```

---

### Task 3: Docker Compose setup

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: paraverse
      POSTGRES_USER: paraverse
      POSTGRES_PASSWORD: ${DB_PASSWORD:-paraverse_dev}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U paraverse"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

**Step 2: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://paraverse:paraverse_dev@localhost:5432/paraverse
DB_PASSWORD=paraverse_dev

# Redis
REDIS_URL=redis://localhost:6379

# LLM (Gemini 2.5 Flash via OpenAI SDK)
LLM_API_KEY=your-gemini-api-key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL_GENERAL=gemini-2.5-flash
LLM_MODEL_BOOST=gemini-2.5-flash
EMBEDDING_MODEL=text-embedding-004

# Auth
JWT_SECRET=change-this-to-a-32-char-or-longer-secret

# Python Engines
OASIS_PYTHON=./simulations/oasis/.venv/bin/python
CONCORDIA_PYTHON=./simulations/concordia/.venv/bin/python
SIM_MAX_MEMORY_MB=2048

# Server
PORT=5001

# Frontend (used by Vite)
VITE_API_BASE_URL=http://localhost:5001/api/v1
VITE_WS_BASE_URL=ws://localhost:5001
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
*.log
.venv/
__pycache__/
*.pyc
.DS_Store
pgdata/
```

**Step 4: Start services and verify**

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

Expected: postgres and redis both "healthy"

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "feat: add Docker Compose with PostgreSQL + pgvector and Redis"
```

---

### Task 4: Database client and migration runner

**Files:**
- Create: `backend/src/db/client.ts`
- Create: `backend/src/db/migrate.ts`
- Create: `backend/src/utils/logger.ts`
- Test: `backend/tests/setup.ts`
- Test: `backend/tests/unit/db/migrate.test.ts`

**Step 1: Create logger utility**

```typescript
// backend/src/utils/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
```

Install pino-pretty: `cd backend && bun add -d pino-pretty`

**Step 2: Create database client**

```typescript
// backend/src/db/client.ts
import pg from "pg";
import { logger } from "../utils/logger";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on("error", (err) => {
      logger.error({ err }, "Unexpected pool error");
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;
  logger.debug({ query: text.slice(0, 80), duration, rows: result.rowCount }, "query");
  return result;
}

export async function getClient(): Promise<pg.PoolClient> {
  return getPool().connect();
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

**Step 3: Create migration runner**

```typescript
// backend/src/db/migrate.ts
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { query, getClient } from "./client";
import { logger } from "../utils/logger";

const MIGRATIONS_DIR = join(import.meta.dir, "migrations");

export async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const applied = await query<{ version: string }>(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  const appliedSet = new Set(applied.rows.map((r) => r.version));

  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

  const client = await getClient();
  try {
    for (const file of sqlFiles) {
      if (appliedSet.has(file)) continue;

      logger.info({ migration: file }, "Applying migration");
      const sql = await Bun.file(join(MIGRATIONS_DIR, file)).text();

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        logger.info({ migration: file }, "Migration applied");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

// Run directly: bun run src/db/migrate.ts
if (import.meta.main) {
  runMigrations()
    .then(() => {
      logger.info("All migrations applied");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Migration failed");
      process.exit(1);
    });
}
```

**Step 4: Create test setup**

```typescript
// backend/tests/setup.ts
import { afterAll } from "bun:test";
import { closePool } from "../src/db/client";

afterAll(async () => {
  await closePool();
});
```

**Step 5: Write migration runner test**

```typescript
// backend/tests/unit/db/migrate.test.ts
import { describe, test, expect } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dir, "../../../src/db/migrations");

describe("migrations", () => {
  test("migration files are named with sequential numbers", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();
    expect(sqlFiles.length).toBeGreaterThan(0);

    for (let i = 0; i < sqlFiles.length; i++) {
      const expected = String(i + 1).padStart(3, "0");
      expect(sqlFiles[i]).toStartWith(expected);
    }
  });

  test("each migration file contains valid SQL", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    for (const file of sqlFiles) {
      const sql = await Bun.file(join(MIGRATIONS_DIR, file)).text();
      expect(sql.trim().length).toBeGreaterThan(0);
      // Basic check: should contain CREATE or ALTER or INSERT
      expect(sql).toMatch(/CREATE|ALTER|INSERT|DROP|UPDATE/i);
    }
  });
});
```

**Step 6: Run test to verify it fails (no migration files yet)**

Run: `cd backend && bun test tests/unit/db/migrate.test.ts`
Expected: FAIL (no migration files)

**Step 7: Commit**

```bash
git add backend/src/db/ backend/src/utils/logger.ts backend/tests/
git commit -m "feat: add database client, migration runner, and logger"
```

---

### Task 5: Database schema migrations

**Files:**
- Create: `backend/src/db/migrations/001_create_extensions.sql`
- Create: `backend/src/db/migrations/002_create_users.sql`
- Create: `backend/src/db/migrations/003_create_projects.sql`
- Create: `backend/src/db/migrations/004_create_documents.sql`
- Create: `backend/src/db/migrations/005_create_ontology.sql`
- Create: `backend/src/db/migrations/006_create_simulations.sql`
- Create: `backend/src/db/migrations/007_create_scenario_branches.sql`
- Create: `backend/src/db/migrations/008_create_agent_profiles.sql`
- Create: `backend/src/db/migrations/009_create_simulation_events.sql`
- Create: `backend/src/db/migrations/010_create_report_sections.sql`
- Create: `backend/src/db/migrations/011_create_interaction_sessions.sql`
- Create: `backend/src/db/migrations/012_create_tasks.sql`

**Step 1: Create migration files**

```sql
-- 001_create_extensions.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

```sql
-- 002_create_users.sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  quota         JSONB DEFAULT '{"simulations_per_month": 2, "max_agents": 50}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

```sql
-- 003_create_projects.sql
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  scenario_type VARCHAR(30) NOT NULL CHECK (scenario_type IN (
    'fin_sentiment', 'content_lab', 'crisis_pr', 'policy_lab', 'war_game', 'train_lab'
  )),
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_projects_owner ON projects(owner_id);
```

```sql
-- 004_create_documents.sql
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
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_doc_emb ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

```sql
-- 005_create_ontology.sql
CREATE TABLE ontology_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL CHECK (type IN ('person', 'org', 'event', 'concept', 'location')),
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  embedding   vector(1536),
  properties  JSONB DEFAULT '{}'
);
CREATE INDEX idx_ontology_nodes_project ON ontology_nodes(project_id);

CREATE TABLE ontology_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id  UUID REFERENCES ontology_nodes(id) ON DELETE CASCADE,
  target_node_id  UUID REFERENCES ontology_nodes(id) ON DELETE CASCADE,
  relation_type   VARCHAR(100) NOT NULL,
  weight          FLOAT DEFAULT 1.0,
  metadata        JSONB DEFAULT '{}'
);
CREATE INDEX idx_edges_source ON ontology_edges(source_node_id);
CREATE INDEX idx_edges_target ON ontology_edges(target_node_id);
```

```sql
-- 006_create_simulations.sql
CREATE TABLE simulations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
  engine           VARCHAR(20) NOT NULL CHECK (engine IN ('oasis', 'concordia')),
  status           VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending', 'configuring', 'running', 'completed', 'failed'
  )),
  config           JSONB NOT NULL,
  checkpoint_path  TEXT,
  grounded_vars    JSONB DEFAULT '{}',
  stats            JSONB DEFAULT '{}',
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_simulations_project ON simulations(project_id);
```

```sql
-- 007_create_scenario_branches.sql
CREATE TABLE scenario_branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  branch_label  VARCHAR(100) NOT NULL,
  description   TEXT,
  override_vars JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_branches_simulation ON scenario_branches(simulation_id);
```

```sql
-- 008_create_agent_profiles.sql
CREATE TABLE agent_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  name          VARCHAR(100),
  persona       TEXT NOT NULL,
  embedding     vector(1536),
  demographics  JSONB NOT NULL,
  memory        JSONB[] DEFAULT ARRAY[]::JSONB[]
);
CREATE INDEX idx_agents_simulation ON agent_profiles(simulation_id);
```

```sql
-- 009_create_simulation_events.sql
CREATE TABLE simulation_events (
  id            BIGSERIAL,
  simulation_id UUID NOT NULL,
  branch_id     UUID,
  agent_id      UUID,
  event_type    VARCHAR(50) NOT NULL,
  platform      VARCHAR(30),
  content       TEXT,
  embedding     vector(1536),
  sim_timestamp INTEGER,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY HASH (simulation_id);

CREATE TABLE simulation_events_p0 PARTITION OF simulation_events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE simulation_events_p1 PARTITION OF simulation_events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE simulation_events_p2 PARTITION OF simulation_events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE simulation_events_p3 PARTITION OF simulation_events FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX idx_events_simulation ON simulation_events(simulation_id);
CREATE INDEX idx_events_type ON simulation_events(event_type);
```

```sql
-- 010_create_report_sections.sql
CREATE TABLE report_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  section_order INTEGER,
  title         VARCHAR(200),
  content       TEXT,
  tool_calls    JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reports_simulation ON report_sections(simulation_id);
```

```sql
-- 011_create_interaction_sessions.sql
CREATE TABLE interaction_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  actor_type    VARCHAR(20) CHECK (actor_type IN ('agent', 'report_agent', 'human')),
  actor_id      UUID,
  messages      JSONB[] DEFAULT ARRAY[]::JSONB[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_interactions_simulation ON interaction_sessions(simulation_id);
```

```sql
-- 012_create_tasks.sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          VARCHAR(50) NOT NULL CHECK (type IN (
    'document_process', 'graph_build', 'simulation', 'report_generate'
  )),
  reference_id  UUID NOT NULL,
  owner_id      UUID REFERENCES users(id),
  status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed'
  )),
  progress      INTEGER DEFAULT 0,
  result        JSONB DEFAULT '{}',
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tasks_reference ON tasks(reference_id);
CREATE INDEX idx_tasks_owner ON tasks(owner_id);
```

**Step 2: Run migrations against Docker PostgreSQL**

```bash
cd backend && DATABASE_URL=postgresql://paraverse:paraverse_dev@localhost:5432/paraverse bun run src/db/migrate.ts
```

Expected: "All migrations applied"

**Step 3: Run migration tests**

Run: `cd backend && bun test tests/unit/db/migrate.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/db/migrations/
git commit -m "feat: add complete database schema migrations (12 tables)"
```

---

### Task 6: Auth service and middleware

**Files:**
- Create: `backend/src/services/authService.ts`
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/middleware/errorHandler.ts`
- Create: `backend/src/db/queries/users.ts`
- Create: `backend/src/routes/auth.ts`
- Test: `backend/tests/unit/services/authService.test.ts`
- Test: `backend/tests/integration/routes/auth.test.ts`

**Step 1: Write failing test for authService**

```typescript
// backend/tests/unit/services/authService.test.ts
import { describe, test, expect } from "bun:test";
import { hashPassword, verifyPassword, generateTokens, verifyAccessToken } from "../../src/services/authService";

describe("authService", () => {
  test("hashPassword produces a valid argon2 hash", async () => {
    const hash = await hashPassword("test-password");
    expect(hash).toStartWith("$argon2");
  });

  test("verifyPassword returns true for correct password", async () => {
    const hash = await hashPassword("test-password");
    const result = await verifyPassword("test-password", hash);
    expect(result).toBe(true);
  });

  test("verifyPassword returns false for wrong password", async () => {
    const hash = await hashPassword("test-password");
    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });

  test("generateTokens returns access and refresh tokens", async () => {
    const tokens = await generateTokens({ id: "test-id", email: "test@example.com", role: "user" });
    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeDefined();
    expect(typeof tokens.access_token).toBe("string");
  });

  test("verifyAccessToken decodes a valid token", async () => {
    const tokens = await generateTokens({ id: "test-id", email: "test@example.com", role: "user" });
    const payload = await verifyAccessToken(tokens.access_token);
    expect(payload.sub).toBe("test-id");
    expect(payload.email).toBe("test@example.com");
  });

  test("verifyAccessToken throws for invalid token", async () => {
    expect(verifyAccessToken("invalid-token")).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && bun test tests/unit/services/authService.test.ts`
Expected: FAIL

**Step 3: Implement authService**

```typescript
// backend/src/services/authService.ts
import * as argon2 from "argon2";
import * as jose from "jose";

const JWT_SECRET_KEY = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production-32chars!");

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "7d";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function generateTokens(user: TokenPayload) {
  const secret = JWT_SECRET_KEY();

  const access_token = await new jose.SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret);

  const refresh_token = await new jose.SignJWT({
    sub: user.id,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(secret);

  return { access_token, refresh_token };
}

export async function verifyAccessToken(token: string) {
  const secret = JWT_SECRET_KEY();
  const { payload } = await jose.jwtVerify(token, secret);
  return payload as jose.JWTPayload & { sub: string; email: string; role: string };
}

export async function verifyRefreshToken(token: string) {
  const secret = JWT_SECRET_KEY();
  const { payload } = await jose.jwtVerify(token, secret);
  if (payload.type !== "refresh") throw new Error("Invalid refresh token");
  return payload as jose.JWTPayload & { sub: string; type: string };
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && bun test tests/unit/services/authService.test.ts`
Expected: PASS

**Step 5: Create user queries**

```typescript
// backend/src/db/queries/users.ts
import { query } from "../client";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  quota: Record<string, unknown>;
  created_at: string;
}

export async function createUser(email: string, passwordHash: string, name: string) {
  const result = await query<UserRow>(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *`,
    [email, passwordHash, name]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string) {
  const result = await query<UserRow>(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

export async function findUserById(id: string) {
  const result = await query<UserRow>(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
```

**Step 6: Create error handler middleware**

```typescript
// backend/src/middleware/errorHandler.ts
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "../utils/logger";
import type { ApiResponse } from "@shared/types/api";

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    if (err instanceof HTTPException) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: err.message,
      };
      return c.json(response, err.status);
    }

    logger.error({ err }, "Unhandled error");
    const response: ApiResponse = {
      success: false,
      data: null,
      error: "Internal server error",
    };
    return c.json(response, 500);
  }
}
```

**Step 7: Create auth middleware**

```typescript
// backend/src/middleware/auth.ts
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyAccessToken } from "../services/authService";

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }

  const token = header.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    c.set("auth", {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    } satisfies AuthContext);
    await next();
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
}
```

**Step 8: Create auth routes**

```typescript
// backend/src/routes/auth.ts
import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyRefreshToken,
} from "../services/authService";
import { createUser, findUserByEmail, findUserById } from "../db/queries/users";
import type { ApiResponse } from "@shared/types/api";

const auth = new Hono();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const input = registerSchema.parse(body);

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new HTTPException(409, { message: "Email already registered" });
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser(input.email, passwordHash, input.name);
  const tokens = await generateTokens({ id: user.id, email: user.email, role: user.role });

  const response: ApiResponse = {
    success: true,
    data: {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    },
    error: null,
  };
  return c.json(response, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const input = loginSchema.parse(body);

  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  const valid = await verifyPassword(input.password, user.password_hash);
  if (!valid) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  const tokens = await generateTokens({ id: user.id, email: user.email, role: user.role });

  const response: ApiResponse = {
    success: true,
    data: {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    },
    error: null,
  };
  return c.json(response);
});

auth.post("/refresh", async (c) => {
  const body = await c.req.json();
  const input = refreshSchema.parse(body);

  try {
    const payload = await verifyRefreshToken(input.refresh_token);
    const user = await findUserById(payload.sub);
    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }

    const tokens = await generateTokens({ id: user.id, email: user.email, role: user.role });
    const response: ApiResponse = {
      success: true,
      data: tokens,
      error: null,
    };
    return c.json(response);
  } catch {
    throw new HTTPException(401, { message: "Invalid refresh token" });
  }
});

export { auth };
```

**Step 9: Write integration test for auth routes**

```typescript
// backend/tests/integration/routes/auth.test.ts
import { describe, test, expect, beforeAll } from "bun:test";
import app from "../../../src/index";
import { runMigrations } from "../../../src/db/migrate";
import { query } from "../../../src/db/client";

// These tests require DATABASE_URL pointing to paraverse_test
describe("auth routes", () => {
  beforeAll(async () => {
    await runMigrations();
    await query("DELETE FROM users");
  });

  test("POST /api/v1/auth/register creates user and returns tokens", async () => {
    const res = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe("test@example.com");
    expect(body.data.access_token).toBeDefined();
    expect(body.data.refresh_token).toBeDefined();
  });

  test("POST /api/v1/auth/register rejects duplicate email", async () => {
    const res = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
        name: "Test User 2",
      }),
    });
    expect(res.status).toBe(409);
  });

  test("POST /api/v1/auth/login returns tokens for valid credentials", async () => {
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.access_token).toBeDefined();
  });

  test("POST /api/v1/auth/login rejects wrong password", async () => {
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "wrong",
      }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/v1/auth/refresh rotates tokens", async () => {
    const loginRes = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });
    const loginBody = await loginRes.json();

    const res = await app.request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: loginBody.data.refresh_token,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.access_token).toBeDefined();
  });
});
```

**Step 10: Update index.ts to mount routes**

```typescript
// backend/src/index.ts (updated)
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "./middleware/errorHandler";
import { auth } from "./routes/auth";

const app = new Hono();

app.use("*", errorHandler);
app.use("*", cors());
app.use("*", honoLogger());

app.get("/health", (c) => c.json({ status: "ok" }));

// API v1 routes
const api = new Hono();
api.route("/auth", auth);

app.route("/api/v1", api);

const port = parseInt(process.env.PORT || "5001");
console.log(`ParaVerse API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

**Step 11: Run unit tests**

Run: `cd backend && bun test tests/unit/services/authService.test.ts`
Expected: PASS

**Step 12: Run integration tests** (requires test DB)

```bash
cd backend && DATABASE_URL=postgresql://paraverse:paraverse_dev@localhost:5432/paraverse bun test tests/integration/routes/auth.test.ts
```
Expected: PASS

**Step 13: Commit**

```bash
git add backend/src/ backend/tests/
git commit -m "feat: add auth service, JWT middleware, auth routes with tests"
```

---

## Week 2: Core Services

### Task 7: LLM Service

**Files:**
- Create: `backend/src/services/llmService.ts`
- Test: `backend/tests/unit/services/llmService.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/llmService.test.ts
import { describe, test, expect, mock, beforeEach } from "bun:test";
import { LlmService } from "../../src/services/llmService";

describe("LlmService", () => {
  test("constructs with correct config", () => {
    const service = new LlmService({
      apiKey: "test-key",
      baseURL: "https://test.example.com/v1",
      generalModel: "gemini-2.5-flash",
      boostModel: "gemini-2.5-flash",
    });
    expect(service).toBeDefined();
  });

  test("chat returns structured response", async () => {
    const service = new LlmService({
      apiKey: "test-key",
      baseURL: "https://test.example.com/v1",
      generalModel: "test-model",
      boostModel: "test-model",
    });

    // This test verifies the interface compiles and structure is correct
    // Real LLM calls tested in integration
    expect(service.chat).toBeDefined();
    expect(service.embed).toBeDefined();
    expect(service.chatStream).toBeDefined();
  });
});
```

**Step 2: Implement LlmService**

```typescript
// backend/src/services/llmService.ts
import OpenAI from "openai";
import { logger } from "../utils/logger";

export interface LlmConfig {
  apiKey: string;
  baseURL: string;
  generalModel: string;
  boostModel: string;
  embeddingModel?: string;
}

export type ModelTier = "general" | "boost";

export class LlmService {
  private client: OpenAI;
  private generalModel: string;
  private boostModel: string;
  private embeddingModel: string;

  constructor(config: LlmConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.generalModel = config.generalModel;
    this.boostModel = config.boostModel;
    this.embeddingModel = config.embeddingModel || "text-embedding-004";
  }

  private getModel(tier: ModelTier): string {
    return tier === "boost" ? this.boostModel : this.generalModel;
  }

  async chat(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: {
      tier?: ModelTier;
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: "json_object" | "text" };
    }
  ): Promise<string> {
    const tier = options?.tier || "general";
    const response = await this.client.chat.completions.create({
      model: this.getModel(tier),
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      response_format: options?.responseFormat,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty response");

    logger.debug({ tier, model: this.getModel(tier), tokens: response.usage }, "LLM chat");
    return content;
  }

  async chatJson<T = Record<string, unknown>>(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: { tier?: ModelTier; temperature?: number; maxTokens?: number }
  ): Promise<T> {
    const content = await this.chat(messages, {
      ...options,
      responseFormat: { type: "json_object" },
    });
    return JSON.parse(content) as T;
  }

  async *chatStream(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: { tier?: ModelTier; temperature?: number; maxTokens?: number }
  ): AsyncGenerator<string> {
    const tier = options?.tier || "general";
    const stream = await this.client.chat.completions.create({
      model: this.getModel(tier),
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }

  async embedSingle(text: string): Promise<number[]> {
    const embeddings = await this.embed([text]);
    return embeddings[0];
  }
}

// Singleton factory
let instance: LlmService | null = null;

export function getLlmService(): LlmService {
  if (!instance) {
    instance = new LlmService({
      apiKey: process.env.LLM_API_KEY || "",
      baseURL: process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
      generalModel: process.env.LLM_MODEL_GENERAL || "gemini-2.5-flash",
      boostModel: process.env.LLM_MODEL_BOOST || "gemini-2.5-flash",
      embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-004",
    });
  }
  return instance;
}
```

**Step 3: Run tests**

Run: `cd backend && bun test tests/unit/services/llmService.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/llmService.ts backend/tests/unit/services/llmService.test.ts
git commit -m "feat: add LLM service with OpenAI SDK, Gemini 2.5 Flash default"
```

---

### Task 8: Vector Service

**Files:**
- Create: `backend/src/services/vectorService.ts`
- Test: `backend/tests/unit/services/vectorService.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/vectorService.test.ts
import { describe, test, expect } from "bun:test";
import { VectorService } from "../../src/services/vectorService";

describe("VectorService", () => {
  test("formatVector converts array to pgvector string", () => {
    const service = new VectorService();
    const result = service.formatVector([1.0, 2.0, 3.0]);
    expect(result).toBe("[1,2,3]");
  });

  test("formatVector handles empty array", () => {
    const service = new VectorService();
    const result = service.formatVector([]);
    expect(result).toBe("[]");
  });
});
```

**Step 2: Implement VectorService**

```typescript
// backend/src/services/vectorService.ts
import { query } from "../db/client";
import { logger } from "../utils/logger";

export class VectorService {
  formatVector(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
  }

  async upsertDocument(params: {
    id?: string;
    projectId: string;
    filename: string;
    content: string;
    chunkIndex: number;
    embedding: number[];
    metadata?: Record<string, unknown>;
  }) {
    const vec = this.formatVector(params.embedding);
    const result = await query(
      `INSERT INTO documents (project_id, filename, content, chunk_index, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5::vector, $6)
       RETURNING id`,
      [params.projectId, params.filename, params.content, params.chunkIndex, vec, JSON.stringify(params.metadata || {})]
    );
    return result.rows[0].id;
  }

  async similaritySearch(params: {
    table: "documents" | "agent_profiles" | "simulation_events";
    embedding: number[];
    projectId?: string;
    simulationId?: string;
    limit?: number;
    threshold?: number;
  }) {
    const vec = this.formatVector(params.embedding);
    const limit = params.limit || 10;
    const threshold = params.threshold || 0.7;

    let whereClause = "";
    const queryParams: unknown[] = [vec, limit];
    let paramIndex = 3;

    if (params.table === "documents" && params.projectId) {
      whereClause = `WHERE project_id = $${paramIndex}`;
      queryParams.push(params.projectId);
      paramIndex++;
    } else if (params.simulationId) {
      whereClause = `WHERE simulation_id = $${paramIndex}`;
      queryParams.push(params.simulationId);
      paramIndex++;
    }

    const result = await query(
      `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
       FROM ${params.table}
       ${whereClause}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      queryParams
    );

    return result.rows.filter((r: any) => r.similarity >= threshold);
  }

  async upsertOntologyNode(params: {
    projectId: string;
    type: string;
    name: string;
    description: string;
    embedding: number[];
    properties?: Record<string, unknown>;
  }) {
    const vec = this.formatVector(params.embedding);
    const result = await query(
      `INSERT INTO ontology_nodes (project_id, type, name, description, embedding, properties)
       VALUES ($1, $2, $3, $4, $5::vector, $6)
       RETURNING id`,
      [params.projectId, params.type, params.name, params.description, vec, JSON.stringify(params.properties || {})]
    );
    return result.rows[0].id;
  }

  async upsertAgentProfile(params: {
    simulationId: string;
    name: string;
    persona: string;
    embedding: number[];
    demographics: Record<string, unknown>;
  }) {
    const vec = this.formatVector(params.embedding);
    const result = await query(
      `INSERT INTO agent_profiles (simulation_id, name, persona, embedding, demographics)
       VALUES ($1, $2, $3, $4::vector, $5)
       RETURNING id`,
      [params.simulationId, params.name, params.persona, vec, JSON.stringify(params.demographics)]
    );
    return result.rows[0].id;
  }
}

let instance: VectorService | null = null;
export function getVectorService(): VectorService {
  if (!instance) instance = new VectorService();
  return instance;
}
```

**Step 3: Run tests**

Run: `cd backend && bun test tests/unit/services/vectorService.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/vectorService.ts backend/tests/unit/services/vectorService.test.ts
git commit -m "feat: add vector service with pgvector CRUD and similarity search"
```

---

### Task 9: Document Service (chunking + embedding pipeline)

**Files:**
- Create: `backend/src/services/documentService.ts`
- Create: `backend/src/utils/chunkText.ts`
- Test: `backend/tests/unit/utils/chunkText.test.ts`
- Test: `backend/tests/unit/services/documentService.test.ts`

**Step 1: Write failing test for chunkText**

```typescript
// backend/tests/unit/utils/chunkText.test.ts
import { describe, test, expect } from "bun:test";
import { chunkText } from "../../src/utils/chunkText";

describe("chunkText", () => {
  test("splits text into chunks of specified size", () => {
    const text = "word ".repeat(1000).trim();
    const chunks = chunkText(text, { chunkSize: 100, overlap: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.split(/\s+/).length).toBeLessThanOrEqual(110); // allow some flexibility
    }
  });

  test("returns single chunk for short text", () => {
    const chunks = chunkText("Hello world", { chunkSize: 100, overlap: 10 });
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe("Hello world");
  });

  test("preserves paragraph boundaries when possible", () => {
    const text = "Paragraph one content.\n\nParagraph two content.\n\nParagraph three content.";
    const chunks = chunkText(text, { chunkSize: 5, overlap: 1 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("handles empty text", () => {
    const chunks = chunkText("", { chunkSize: 100, overlap: 10 });
    expect(chunks.length).toBe(0);
  });
});
```

**Step 2: Implement chunkText**

```typescript
// backend/src/utils/chunkText.ts
export interface ChunkOptions {
  chunkSize: number;   // in words
  overlap: number;     // in words
}

export function chunkText(
  text: string,
  options: ChunkOptions = { chunkSize: 512, overlap: 50 }
): string[] {
  if (!text.trim()) return [];

  const { chunkSize, overlap } = options;

  // Try paragraph-based splitting first
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    const paraWordCount = words.length;

    if (currentWordCount + paraWordCount <= chunkSize) {
      currentChunk.push(para);
      currentWordCount += paraWordCount;
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n\n"));
      }

      // If single paragraph exceeds chunk size, split by words
      if (paraWordCount > chunkSize) {
        for (let i = 0; i < words.length; i += chunkSize - overlap) {
          const slice = words.slice(i, i + chunkSize);
          if (slice.length > 0) chunks.push(slice.join(" "));
        }
        currentChunk = [];
        currentWordCount = 0;
      } else {
        // Start new chunk with overlap from previous
        const prevText = currentChunk.join("\n\n");
        const prevWords = prevText.split(/\s+/);
        const overlapWords = prevWords.slice(-overlap);

        currentChunk = [overlapWords.join(" "), para];
        currentWordCount = overlap + paraWordCount;
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks;
}
```

**Step 3: Run chunkText test**

Run: `cd backend && bun test tests/unit/utils/chunkText.test.ts`
Expected: PASS

**Step 4: Implement DocumentService**

```typescript
// backend/src/services/documentService.ts
import pdfParse from "pdf-parse";
import { chunkText } from "../utils/chunkText";
import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { logger } from "../utils/logger";

export class DocumentService {
  private llm = getLlmService();
  private vectors = getVectorService();

  async extractText(buffer: Buffer, filename: string): Promise<string> {
    if (filename.toLowerCase().endsWith(".pdf")) {
      const result = await pdfParse(buffer);
      return result.text;
    }
    // Plain text
    return buffer.toString("utf-8");
  }

  async processDocument(params: {
    projectId: string;
    filename: string;
    buffer: Buffer;
    onProgress?: (progress: number) => void;
  }): Promise<{ chunkCount: number; documentIds: string[] }> {
    const { projectId, filename, buffer, onProgress } = params;

    // Extract text
    const text = await this.extractText(buffer, filename);
    logger.info({ filename, textLength: text.length }, "Text extracted");

    // Chunk
    const chunks = chunkText(text);
    logger.info({ filename, chunkCount: chunks.length }, "Text chunked");

    const documentIds: string[] = [];
    const batchSize = 20;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await this.llm.embed(batch);

      for (let j = 0; j < batch.length; j++) {
        const docId = await this.vectors.upsertDocument({
          projectId,
          filename,
          content: batch[j],
          chunkIndex: i + j,
          embedding: embeddings[j],
        });
        documentIds.push(docId);
      }

      onProgress?.(Math.round(((i + batch.length) / chunks.length) * 100));
    }

    return { chunkCount: chunks.length, documentIds };
  }
}

let instance: DocumentService | null = null;
export function getDocumentService(): DocumentService {
  if (!instance) instance = new DocumentService();
  return instance;
}
```

**Step 5: Commit**

```bash
git add backend/src/services/documentService.ts backend/src/utils/chunkText.ts backend/tests/unit/
git commit -m "feat: add document service with PDF parsing, text chunking, and embedding"
```

---

### Task 10: Graph Service (ontology extraction)

**Files:**
- Create: `backend/src/services/graphService.ts`
- Test: `backend/tests/unit/services/graphService.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/graphService.test.ts
import { describe, test, expect } from "bun:test";
import { parseOntologyResponse } from "../../src/services/graphService";

describe("graphService", () => {
  test("parseOntologyResponse extracts entities and relations", () => {
    const llmOutput = {
      entities: [
        { type: "person", name: "John Doe", description: "CEO of Acme" },
        { type: "org", name: "Acme Corp", description: "Technology company" },
      ],
      relations: [
        { source: "John Doe", target: "Acme Corp", type: "leads", weight: 1.0 },
      ],
    };
    const result = parseOntologyResponse(llmOutput);
    expect(result.entities).toHaveLength(2);
    expect(result.relations).toHaveLength(1);
    expect(result.entities[0].name).toBe("John Doe");
  });

  test("parseOntologyResponse handles empty input", () => {
    const result = parseOntologyResponse({ entities: [], relations: [] });
    expect(result.entities).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
  });
});
```

**Step 2: Implement GraphService**

```typescript
// backend/src/services/graphService.ts
import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { query } from "../db/client";
import { logger } from "../utils/logger";

export interface OntologyEntity {
  type: "person" | "org" | "event" | "concept" | "location";
  name: string;
  description: string;
  properties?: Record<string, unknown>;
}

export interface OntologyRelation {
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface OntologyResult {
  entities: OntologyEntity[];
  relations: OntologyRelation[];
}

export function parseOntologyResponse(raw: {
  entities: OntologyEntity[];
  relations: OntologyRelation[];
}): OntologyResult {
  return {
    entities: raw.entities || [],
    relations: raw.relations || [],
  };
}

const ONTOLOGY_PROMPT = `You are an expert knowledge graph builder. Analyze the following text and extract:

1. **Entities**: people, organizations, events, concepts, and locations mentioned.
2. **Relations**: how these entities are connected (e.g., "works_for", "caused_by", "related_to").

Return JSON in this exact format:
{
  "entities": [
    {"type": "person|org|event|concept|location", "name": "...", "description": "..."}
  ],
  "relations": [
    {"source": "entity name", "target": "entity name", "type": "relation_type", "weight": 0.0-1.0}
  ]
}

Extract only clearly stated facts. Do not infer or hallucinate entities.`;

export class GraphService {
  private llm = getLlmService();
  private vectors = getVectorService();

  async extractOntology(
    projectId: string,
    chunks: string[],
    onProgress?: (progress: number) => void
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    const allEntities: Map<string, OntologyEntity> = new Map();
    const allRelations: OntologyRelation[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const response = await this.llm.chatJson<{
        entities: OntologyEntity[];
        relations: OntologyRelation[];
      }>(
        [
          { role: "system", content: ONTOLOGY_PROMPT },
          { role: "user", content: chunks[i] },
        ],
        { tier: "boost" }
      );

      const parsed = parseOntologyResponse(response);

      for (const entity of parsed.entities) {
        if (!allEntities.has(entity.name)) {
          allEntities.set(entity.name, entity);
        }
      }
      allRelations.push(...parsed.relations);
      onProgress?.(Math.round(((i + 1) / chunks.length) * 100));
    }

    // Store entities with embeddings
    const entityNameToId: Map<string, string> = new Map();

    for (const entity of allEntities.values()) {
      const embedding = await this.llm.embedSingle(
        `${entity.name}: ${entity.description}`
      );
      const nodeId = await this.vectors.upsertOntologyNode({
        projectId,
        type: entity.type,
        name: entity.name,
        description: entity.description,
        embedding,
        properties: entity.properties,
      });
      entityNameToId.set(entity.name, nodeId);
    }

    // Store relations
    let edgeCount = 0;
    for (const rel of allRelations) {
      const sourceId = entityNameToId.get(rel.source);
      const targetId = entityNameToId.get(rel.target);
      if (sourceId && targetId) {
        await query(
          `INSERT INTO ontology_edges (source_node_id, target_node_id, relation_type, weight)
           VALUES ($1, $2, $3, $4)`,
          [sourceId, targetId, rel.type, rel.weight]
        );
        edgeCount++;
      }
    }

    logger.info({ projectId, nodes: allEntities.size, edges: edgeCount }, "Ontology extracted");
    return { nodeCount: allEntities.size, edgeCount };
  }

  async getGraph(projectId: string) {
    const nodes = await query(
      `SELECT id, type, name, description, properties FROM ontology_nodes WHERE project_id = $1`,
      [projectId]
    );
    const edges = await query(
      `SELECT e.id, e.source_node_id, e.target_node_id, e.relation_type, e.weight
       FROM ontology_edges e
       JOIN ontology_nodes n ON e.source_node_id = n.id
       WHERE n.project_id = $1`,
      [projectId]
    );
    return { nodes: nodes.rows, edges: edges.rows };
  }

  async searchGraph(projectId: string, queryText: string, limit = 10) {
    const embedding = await this.llm.embedSingle(queryText);
    return this.vectors.similaritySearch({
      table: "documents",
      embedding,
      projectId,
      limit,
    });
  }
}

let instance: GraphService | null = null;
export function getGraphService(): GraphService {
  if (!instance) instance = new GraphService();
  return instance;
}
```

**Step 3: Run tests**

Run: `cd backend && bun test tests/unit/services/graphService.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/graphService.ts backend/tests/unit/services/graphService.test.ts
git commit -m "feat: add graph service with LLM ontology extraction and graph queries"
```

---

### Task 11: Task Manager (async task tracking)

**Files:**
- Create: `backend/src/utils/taskManager.ts`
- Create: `backend/src/db/queries/tasks.ts`
- Test: `backend/tests/unit/utils/taskManager.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/utils/taskManager.test.ts
import { describe, test, expect } from "bun:test";

describe("taskManager", () => {
  test("TaskType enum has correct values", async () => {
    const { TaskType } = await import("../../src/utils/taskManager");
    expect(TaskType.DOCUMENT_PROCESS).toBe("document_process");
    expect(TaskType.GRAPH_BUILD).toBe("graph_build");
    expect(TaskType.SIMULATION).toBe("simulation");
    expect(TaskType.REPORT_GENERATE).toBe("report_generate");
  });
});
```

**Step 2: Implement task queries and manager**

```typescript
// backend/src/db/queries/tasks.ts
import { query } from "../client";

export interface TaskRow {
  id: string;
  type: string;
  reference_id: string;
  owner_id: string;
  status: string;
  progress: number;
  result: Record<string, unknown>;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function createTask(
  type: string,
  referenceId: string,
  ownerId: string
): Promise<TaskRow> {
  const result = await query<TaskRow>(
    `INSERT INTO tasks (type, reference_id, owner_id) VALUES ($1, $2, $3) RETURNING *`,
    [type, referenceId, ownerId]
  );
  return result.rows[0];
}

export async function updateTask(
  id: string,
  updates: { status?: string; progress?: number; result?: Record<string, unknown>; error?: string }
) {
  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let i = 1;

  if (updates.status !== undefined) { sets.push(`status = $${i++}`); params.push(updates.status); }
  if (updates.progress !== undefined) { sets.push(`progress = $${i++}`); params.push(updates.progress); }
  if (updates.result !== undefined) { sets.push(`result = $${i++}`); params.push(JSON.stringify(updates.result)); }
  if (updates.error !== undefined) { sets.push(`error = $${i++}`); params.push(updates.error); }

  params.push(id);
  await query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i}`, params);
}

export async function getTask(id: string): Promise<TaskRow | null> {
  const result = await query<TaskRow>(`SELECT * FROM tasks WHERE id = $1`, [id]);
  return result.rows[0] || null;
}
```

```typescript
// backend/src/utils/taskManager.ts
import { createTask, updateTask, getTask, type TaskRow } from "../db/queries/tasks";
import { logger } from "./logger";

export enum TaskType {
  DOCUMENT_PROCESS = "document_process",
  GRAPH_BUILD = "graph_build",
  SIMULATION = "simulation",
  REPORT_GENERATE = "report_generate",
}

export class TaskManager {
  async create(type: TaskType, referenceId: string, ownerId: string): Promise<TaskRow> {
    const task = await createTask(type, referenceId, ownerId);
    logger.info({ taskId: task.id, type }, "Task created");
    return task;
  }

  async start(taskId: string): Promise<void> {
    await updateTask(taskId, { status: "running", progress: 0 });
  }

  async progress(taskId: string, progress: number): Promise<void> {
    await updateTask(taskId, { progress: Math.min(100, Math.max(0, progress)) });
  }

  async complete(taskId: string, result?: Record<string, unknown>): Promise<void> {
    await updateTask(taskId, { status: "completed", progress: 100, result });
    logger.info({ taskId }, "Task completed");
  }

  async fail(taskId: string, error: string): Promise<void> {
    await updateTask(taskId, { status: "failed", error });
    logger.error({ taskId, error }, "Task failed");
  }

  async get(taskId: string): Promise<TaskRow | null> {
    return getTask(taskId);
  }
}

let instance: TaskManager | null = null;
export function getTaskManager(): TaskManager {
  if (!instance) instance = new TaskManager();
  return instance;
}
```

**Step 3: Run tests**

Run: `cd backend && bun test tests/unit/utils/taskManager.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/utils/taskManager.ts backend/src/db/queries/tasks.ts backend/tests/unit/utils/
git commit -m "feat: add task manager for async operation tracking"
```

---

I'll continue with W3–W8 in the next part. Let me save what we have so far and continue.
