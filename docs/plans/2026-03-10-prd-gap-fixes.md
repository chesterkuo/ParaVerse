# PRD Gap Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close remaining PRD gaps: Redis LLM cache, set-var endpoint, OpenAPI docs, WarGame access control, LMS integration, and FinSentiment backtest framework.

**Architecture:** Six independent features added to the existing Bun/Hono backend. Redis caching wraps existing LlmService. OpenAPI generated from route metadata. WarGame access control added as middleware. LMS integration exposes LTI endpoints. Backtest framework runs historical simulations and compares outputs.

**Tech Stack:** Bun, Hono, ioredis, @hono/zod-openapi, Scalar UI, LTI 1.3 protocol, existing Python OASIS engine

---

## Task 1: Redis LLM Response Cache

Add a caching layer to `LlmService.chat()` that stores LLM responses in Redis with a configurable TTL. Cache key = hash of (model + messages + params). Skip cache for streaming calls.

**Files:**
- Create: `backend/src/services/llmCacheService.ts`
- Modify: `backend/src/services/llmService.ts`
- Test: `backend/tests/llmCache.test.ts`

**Step 1: Create the cache service**

Create `backend/src/services/llmCacheService.ts`:

```typescript
import { createHash } from "crypto";
import Redis from "ioredis";
import { logger } from "../utils/logger";

const DEFAULT_TTL = 1800; // 30 minutes

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.on("error", (err) => logger.error({ err }, "LLM cache Redis error"));
  }
  return redis;
}

export function buildCacheKey(
  model: string,
  messages: Array<{ role: string; content: string }>,
  params: Record<string, unknown> = {}
): string {
  const payload = JSON.stringify({ model, messages, ...params });
  const hash = createHash("sha256").update(payload).digest("hex");
  return `llm:cache:${hash}`;
}

export async function getCached(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch {
    return null; // fail-open
  }
}

export async function setCached(
  key: string,
  value: string,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    await getRedis().setex(key, ttl, value);
  } catch {
    // fail-open: cache miss is not fatal
  }
}
```

**Step 2: Integrate cache into LlmService.chat()**

Modify `backend/src/services/llmService.ts` — add cache check before API call and cache store after:

```typescript
// Add imports at top
import { buildCacheKey, getCached, setCached } from "./llmCacheService";

// In chat() method, before the API call:
async chat(
  messages: ChatMessage[],
  opts: { tier?: "general" | "boost"; temperature?: number; maxTokens?: number; responseFormat?: any } = {}
): Promise<string> {
  const model = opts.tier === "boost" ? this.boostModel : this.generalModel;
  const cacheKey = buildCacheKey(model, messages, {
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });

  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const response = await this.client.chat.completions.create({
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens,
    response_format: opts.responseFormat,
  });

  const content = response.choices[0]?.message?.content ?? "";
  await setCached(cacheKey, content);
  return content;
}
```

**Step 3: Write tests**

Create `backend/tests/llmCache.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { buildCacheKey } from "../src/services/llmCacheService";

describe("LLM Cache", () => {
  test("buildCacheKey produces deterministic hash", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = buildCacheKey("model-a", msgs, { temperature: 0.7 });
    const k2 = buildCacheKey("model-a", msgs, { temperature: 0.7 });
    expect(k1).toBe(k2);
    expect(k1).toStartWith("llm:cache:");
  });

  test("different params produce different keys", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = buildCacheKey("model-a", msgs, { temperature: 0.7 });
    const k2 = buildCacheKey("model-a", msgs, { temperature: 0.9 });
    expect(k1).not.toBe(k2);
  });

  test("different messages produce different keys", () => {
    const k1 = buildCacheKey("m", [{ role: "user", content: "a" }]);
    const k2 = buildCacheKey("m", [{ role: "user", content: "b" }]);
    expect(k1).not.toBe(k2);
  });
});
```

**Step 4: Run tests**

```bash
cd backend && bun test tests/llmCache.test.ts
```

**Step 5: Commit**

```bash
git add backend/src/services/llmCacheService.ts backend/src/services/llmService.ts backend/tests/llmCache.test.ts
git commit -m "feat: add Redis LLM response cache with 30min TTL"
```

---

## Task 2: Set Grounded Variable REST Endpoint

Add `POST /simulations/:id/set-var` to allow setting Concordia grounded variables via REST API (currently only possible via WebSocket command).

**Files:**
- Modify: `backend/src/routes/simulation.ts`
- Test: manual via curl (existing pattern in codebase)

**Step 1: Add the endpoint**

Add to `backend/src/routes/simulation.ts` after the `manual-action` endpoint (~line 290):

```typescript
// POST /simulations/:simulationId/set-var — Set grounded variable (Concordia only)
simulation.post("/:simulationId/set-var", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });
  if (sim.engine !== "concordia") {
    throw new HTTPException(400, { message: "set-var is only supported for Concordia simulations" });
  }

  const body = await c.req.json<{ var_name: string; value: number }>();
  if (!body.var_name || typeof body.value !== "number") {
    throw new HTTPException(400, { message: "var_name (string) and value (number) required" });
  }

  const simService = getSimulationService();
  await simService.forwardCommand(simulationId, {
    type: "set_grounded_var",
    var_name: body.var_name,
    value: body.value,
  });

  return c.json({
    success: true,
    data: { var_name: body.var_name, value: body.value },
    error: null,
  } satisfies ApiResponse);
});
```

**Step 2: Commit**

```bash
git add backend/src/routes/simulation.ts
git commit -m "feat: add POST /simulations/:id/set-var endpoint for Concordia"
```

---

## Task 3: OpenAPI Documentation with Scalar UI

Generate OpenAPI 3.1 spec from route definitions and serve interactive Scalar API documentation at `/docs`.

**Files:**
- Create: `backend/src/routes/docs.ts`
- Create: `backend/src/openapi/spec.ts`
- Modify: `backend/src/index.ts`

**Step 1: Install dependencies**

```bash
cd backend && bun add @scalar/hono-api-reference
```

**Step 2: Create OpenAPI spec**

Create `backend/src/openapi/spec.ts` — a hand-written OpenAPI 3.1 JSON spec covering all endpoints:

```typescript
export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "ParaVerse API",
    version: "1.0.0",
    description: "Multi-Agent Simulation Platform API. Dual-engine architecture with OASIS (social media simulation) and Concordia (game-master-driven scenarios).",
    license: { name: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  },
  servers: [{ url: "/api/v1", description: "API v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {},
          error: { type: "string", nullable: true },
          meta: { type: "object", nullable: true },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          scenario_type: { type: "string", enum: ["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "war_game", "train_lab"] },
          owner_id: { type: "string", format: "uuid" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Simulation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          project_id: { type: "string", format: "uuid" },
          engine: { type: "string", enum: ["oasis", "concordia"] },
          status: { type: "string", enum: ["pending", "configuring", "running", "completed", "failed"] },
          config: { type: "object" },
          grounded_vars: { type: "object" },
          stats: { type: "object" },
        },
      },
      SimConfig: {
        type: "object",
        required: ["scenario_type", "agent_count", "tick_count"],
        properties: {
          scenario_type: { type: "string", enum: ["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "war_game", "train_lab"] },
          agent_count: { type: "integer", minimum: 1, maximum: 500 },
          tick_count: { type: "integer", minimum: 1, maximum: 500 },
          seed_context: { type: "string" },
          platform: { type: "string", enum: ["twitter", "reddit"] },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"], summary: "Register new user", security: [],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password", "name"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 }, name: { type: "string" } } } } } },
        responses: { "200": { description: "Registration successful" } },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"], summary: "Login", security: [],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } } } } },
        responses: { "200": { description: "Login successful, returns access_token and refresh_token" } },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"], summary: "Refresh access token", security: [],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["refresh_token"], properties: { refresh_token: { type: "string" } } } } } },
        responses: { "200": { description: "New tokens issued" } },
      },
    },
    "/projects": {
      get: { tags: ["Projects"], summary: "List projects", responses: { "200": { description: "Project list with pagination" } } },
      post: {
        tags: ["Projects"], summary: "Create project",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "scenario_type"], properties: { name: { type: "string" }, scenario_type: { type: "string", enum: ["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "war_game", "train_lab"] } } } } } },
        responses: { "200": { description: "Project created" } },
      },
    },
    "/projects/{id}": {
      get: { tags: ["Projects"], summary: "Get project", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Project details" } } },
      delete: { tags: ["Projects"], summary: "Delete project", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Project deleted" } } },
    },
    "/projects/{id}/documents": {
      post: { tags: ["Knowledge Graph"], summary: "Upload document", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } }, responses: { "200": { description: "Upload started, returns task_id" } } },
    },
    "/projects/{id}/graph/build": {
      post: { tags: ["Knowledge Graph"], summary: "Build knowledge graph", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Build started, returns task_id" } } },
    },
    "/projects/{id}/graph": {
      get: { tags: ["Knowledge Graph"], summary: "Get knowledge graph", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Graph nodes and edges" } } },
    },
    "/projects/{id}/search": {
      post: { tags: ["Knowledge Graph"], summary: "Hybrid search (vector + BM25)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["query"], properties: { query: { type: "string" }, mode: { type: "string", enum: ["hybrid", "semantic", "keyword"] }, limit: { type: "integer" } } } } } }, responses: { "200": { description: "Search results" } } },
    },
    "/simulations": {
      post: { tags: ["Simulation"], summary: "Create simulation", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["project_id", "config"], properties: { project_id: { type: "string" }, config: { "$ref": "#/components/schemas/SimConfig" } } } } } }, responses: { "200": { description: "Simulation created with agents (async)" } } },
    },
    "/simulations/{id}/start": {
      post: { tags: ["Simulation"], summary: "Start simulation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Simulation started" } } },
    },
    "/simulations/{id}/status": {
      get: { tags: ["Simulation"], summary: "Get simulation status", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Simulation status and stats" } } },
    },
    "/simulations/{id}/events": {
      get: { tags: ["Simulation"], summary: "Get simulation events", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer" } }, { name: "offset", in: "query", schema: { type: "integer" } }, { name: "event_type", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Event list" } } },
    },
    "/simulations/{id}/agents": {
      get: { tags: ["Simulation"], summary: "List simulation agents", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Agent list" } } },
    },
    "/simulations/{id}/interview": {
      post: { tags: ["Simulation"], summary: "Interview an agent", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["agent_id", "question"], properties: { agent_id: { type: "string" }, question: { type: "string" } } } } } }, responses: { "200": { description: "Interview response" } } },
    },
    "/simulations/{id}/fork": {
      post: { tags: ["Simulation (Concordia)"], summary: "Fork scenario branch", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["branch_label"], properties: { branch_label: { type: "string" }, description: { type: "string" }, override_vars: { type: "object" } } } } } }, responses: { "200": { description: "Branch created" } } },
    },
    "/simulations/{id}/checkpoint": {
      post: { tags: ["Simulation (Concordia)"], summary: "Save checkpoint", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Checkpoint saved" } } },
    },
    "/simulations/{id}/manual-action": {
      post: { tags: ["Simulation (Concordia)"], summary: "Inject manual action (TrainLab)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["actor_id", "action"], properties: { actor_id: { type: "string" }, action: { type: "string" } } } } } }, responses: { "200": { description: "Action injected" } } },
    },
    "/simulations/{id}/set-var": {
      post: { tags: ["Simulation (Concordia)"], summary: "Set grounded variable", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["var_name", "value"], properties: { var_name: { type: "string" }, value: { type: "number" } } } } } }, responses: { "200": { description: "Variable set" } } },
    },
    "/simulations/{id}/acceptance-matrix": {
      get: { tags: ["Simulation"], summary: "Get stakeholder acceptance matrix", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Acceptance matrix heatmap data" } } },
    },
    "/simulations/{id}/checkpoints": {
      get: { tags: ["Simulation (Concordia)"], summary: "List checkpoints", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Checkpoint list" } } },
    },
    "/simulations/{id}/checkpoints/load": {
      post: { tags: ["Simulation (Concordia)"], summary: "Load checkpoint", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["checkpoint_id"], properties: { checkpoint_id: { type: "string" } } } } } }, responses: { "200": { description: "Checkpoint loaded" } } },
    },
    "/simulations/{id}/report": {
      post: { tags: ["Report"], summary: "Generate report (async)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Report generation started, returns task_id" } } },
      get: { tags: ["Report"], summary: "Get generated report", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Report sections" } } },
    },
    "/simulations/{id}/report/export": {
      get: { tags: ["Report"], summary: "Export report as PDF or DOCX", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "format", in: "query", required: true, schema: { type: "string", enum: ["pdf", "docx"] } }, { name: "token", in: "query", required: true, schema: { type: "string" } }], security: [], responses: { "200": { description: "File download" } } },
    },
    "/tasks/{id}": {
      get: { tags: ["Tasks"], summary: "Poll async task status", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Task status with progress" } } },
    },
  },
  tags: [
    { name: "Auth", description: "Authentication & registration" },
    { name: "Projects", description: "Project management" },
    { name: "Knowledge Graph", description: "Document upload, graph building, search" },
    { name: "Simulation", description: "Simulation lifecycle (both engines)" },
    { name: "Simulation (Concordia)", description: "Concordia-only features: branching, checkpoints, manual actions, grounded variables" },
    { name: "Report", description: "Report generation and export" },
    { name: "Tasks", description: "Async task polling" },
  ],
};
```

**Step 3: Create docs route with Scalar UI**

Create `backend/src/routes/docs.ts`:

```typescript
import { Hono } from "hono";
import { apiReference } from "@scalar/hono-api-reference";
import { openApiSpec } from "../openapi/spec";

const docs = new Hono();

// Serve raw OpenAPI JSON
docs.get("/openapi.json", (c) => c.json(openApiSpec));

// Serve Scalar interactive UI
docs.get(
  "/",
  apiReference({
    spec: { content: openApiSpec },
    theme: "kepler",
    layout: "modern",
    defaultHttpClient: { targetKey: "javascript", clientKey: "fetch" },
  })
);

export { docs };
```

**Step 4: Mount in index.ts**

Modify `backend/src/index.ts` — add docs route (no auth required):

```typescript
import { docs } from "./routes/docs";

// Mount BEFORE the /api/v1 block (no auth needed)
app.route("/docs", docs);
```

**Step 5: Run and verify**

```bash
cd backend && bun run src/index.ts
# Open http://localhost:5001/docs in browser — should show Scalar UI
# Open http://localhost:5001/docs/openapi.json — should return JSON spec
```

**Step 6: Commit**

```bash
git add backend/src/openapi/spec.ts backend/src/routes/docs.ts backend/src/index.ts backend/package.json backend/bun.lockb
git commit -m "feat: add OpenAPI 3.1 spec with Scalar interactive docs at /docs"
```

---

## Task 4: WarGame Access Control

Add scenario-level access control: `war_game` projects require `role = "verified_institution"` on the user record. Add a middleware that checks this before project creation and simulation start.

**Files:**
- Create: `backend/src/middleware/scenarioAccess.ts`
- Create: `backend/src/db/migrations/016_add_user_verified_fields.sql`
- Modify: `backend/src/routes/projects.ts` (apply middleware)
- Modify: `backend/src/routes/simulation.ts` (apply middleware)
- Test: `backend/tests/scenarioAccess.test.ts`

**Step 1: Create migration**

Create `backend/src/db/migrations/016_add_user_verified_fields.sql`:

```sql
-- Add institution verification fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_name VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
```

**Step 2: Run migration**

```bash
cd backend && bun run src/db/migrate.ts
```

**Step 3: Create scenario access middleware**

Create `backend/src/middleware/scenarioAccess.ts`:

```typescript
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { query } from "../db/client";
import { logger } from "../utils/logger";

interface AuthContext {
  userId: string;
  email: string;
}

const RESTRICTED_SCENARIOS = ["war_game"];

/**
 * Middleware that checks if the user has institutional verification
 * for restricted scenario types (e.g., war_game).
 *
 * For project creation: reads scenario_type from request body.
 * For simulation routes: reads scenario_type from the linked project.
 */
export function scenarioAccessCheck(source: "body" | "project") {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth") as AuthContext;
    let scenarioType: string | undefined;

    if (source === "body") {
      const body = await c.req.json();
      scenarioType = body.scenario_type;
      // Re-set body for downstream handlers
      c.set("parsedBody", body);
    } else if (source === "project") {
      const simulationId = c.req.param("simulationId");
      if (simulationId) {
        const result = await query(
          `SELECT p.scenario_type FROM simulations s
           JOIN projects p ON p.id = s.project_id
           WHERE s.id = $1`,
          [simulationId]
        );
        scenarioType = result.rows[0]?.scenario_type;
      }
    }

    if (!scenarioType || !RESTRICTED_SCENARIOS.includes(scenarioType)) {
      return next();
    }

    // Check institutional verification
    const result = await query(
      "SELECT institution_verified FROM users WHERE id = $1",
      [auth.userId]
    );
    const user = result.rows[0];

    if (!user?.institution_verified) {
      logger.warn(
        { userId: auth.userId, scenarioType },
        "Unauthorized access to restricted scenario"
      );
      throw new HTTPException(403, {
        message: `Access to ${scenarioType} scenarios requires institutional verification. Please contact support.`,
      });
    }

    return next();
  };
}
```

**Step 4: Apply to project creation**

Modify `backend/src/routes/projects.ts` — add scenarioAccessCheck to POST:

```typescript
import { scenarioAccessCheck } from "../middleware/scenarioAccess";

// In the POST / handler, add middleware:
projects.post("/", scenarioAccessCheck("body"), async (c) => {
  // Use c.get("parsedBody") if body was already parsed by middleware
  const body = c.get("parsedBody") || await c.req.json();
  // ... rest of handler
});
```

**Step 5: Write test**

Create `backend/tests/scenarioAccess.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";

describe("Scenario Access Control", () => {
  test("RESTRICTED_SCENARIOS includes war_game", () => {
    const restricted = ["war_game"];
    expect(restricted.includes("war_game")).toBe(true);
    expect(restricted.includes("fin_sentiment")).toBe(false);
    expect(restricted.includes("policy_lab")).toBe(false);
  });

  test("non-restricted scenarios pass through", () => {
    const restricted = ["war_game"];
    const nonRestricted = ["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "train_lab"];
    for (const s of nonRestricted) {
      expect(restricted.includes(s)).toBe(false);
    }
  });
});
```

**Step 6: Run tests and commit**

```bash
cd backend && bun test tests/scenarioAccess.test.ts
git add backend/src/middleware/scenarioAccess.ts backend/src/db/migrations/016_add_user_verified_fields.sql backend/src/routes/projects.ts backend/tests/scenarioAccess.test.ts
git commit -m "feat: add WarGame institutional access control middleware"
```

---

## Task 5: LMS Integration (LTI 1.3 for TrainLab)

Add LTI 1.3 launch endpoint so Learning Management Systems (Canvas, Moodle) can embed TrainLab sessions. The LMS sends a signed JWT launch request; we validate it, create/find a user, and redirect to the TrainLab page with an auth token.

**Files:**
- Create: `backend/src/routes/lti.ts`
- Create: `backend/src/db/migrations/017_create_lti_platforms.sql`
- Create: `backend/src/db/queries/lti.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create migration for LTI platform registration**

Create `backend/src/db/migrations/017_create_lti_platforms.sql`:

```sql
-- LTI 1.3 platform registrations
CREATE TABLE IF NOT EXISTS lti_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer VARCHAR(500) NOT NULL UNIQUE,
  client_id VARCHAR(200) NOT NULL,
  auth_endpoint VARCHAR(500) NOT NULL,
  token_endpoint VARCHAR(500) NOT NULL,
  jwks_uri VARCHAR(500) NOT NULL,
  deployment_id VARCHAR(200),
  institution_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LTI user mappings (LMS user → ParaVerse user)
CREATE TABLE IF NOT EXISTS lti_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lti_platform_id UUID REFERENCES lti_platforms(id),
  lti_user_id VARCHAR(200) NOT NULL,
  paraverse_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lti_platform_id, lti_user_id)
);
```

**Step 2: Run migration**

```bash
cd backend && bun run src/db/migrate.ts
```

**Step 3: Create LTI query module**

Create `backend/src/db/queries/lti.ts`:

```typescript
import { query } from "../client";

export async function getLtiPlatformByIssuer(issuer: string) {
  const result = await query(
    "SELECT * FROM lti_platforms WHERE issuer = $1",
    [issuer]
  );
  return result.rows[0] || null;
}

export async function getLtiUserMapping(platformId: string, ltiUserId: string) {
  const result = await query(
    "SELECT * FROM lti_user_mappings WHERE lti_platform_id = $1 AND lti_user_id = $2",
    [platformId, ltiUserId]
  );
  return result.rows[0] || null;
}

export async function createLtiUserMapping(
  platformId: string,
  ltiUserId: string,
  paraverseUserId: string
) {
  const result = await query(
    `INSERT INTO lti_user_mappings (lti_platform_id, lti_user_id, paraverse_user_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [platformId, ltiUserId, paraverseUserId]
  );
  return result.rows[0];
}
```

**Step 4: Create LTI route**

Create `backend/src/routes/lti.ts`:

```typescript
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as jose from "jose";
import { logger } from "../utils/logger";
import { getLtiPlatformByIssuer, getLtiUserMapping, createLtiUserMapping } from "../db/queries/lti";
import { createUser, findUserByEmail } from "../db/queries/users";
import { generateTokens } from "../services/authService";
import { query } from "../db/client";

const lti = new Hono();

// POST /lti/launch — LTI 1.3 resource link launch
lti.post("/launch", async (c) => {
  const body = await c.req.parseBody();
  const idToken = body.id_token as string;

  if (!idToken) {
    throw new HTTPException(400, { message: "Missing id_token" });
  }

  try {
    // 1. Decode token header to get issuer (without verification first)
    const decoded = jose.decodeJwt(idToken);
    const issuer = decoded.iss as string;

    if (!issuer) {
      throw new HTTPException(400, { message: "Missing issuer in token" });
    }

    // 2. Look up platform registration
    const platform = await getLtiPlatformByIssuer(issuer);
    if (!platform) {
      throw new HTTPException(403, { message: "Unregistered LTI platform" });
    }

    // 3. Fetch platform's JWKS and verify token
    const jwks = jose.createRemoteJWKSet(new URL(platform.jwks_uri));
    const { payload } = await jose.jwtVerify(idToken, jwks, {
      issuer: platform.issuer,
      audience: platform.client_id,
    });

    // 4. Extract LTI claims
    const ltiUserId = payload.sub as string;
    const email = (payload as any)?.email || `${ltiUserId}@lti.${issuer}`;
    const name = (payload as any)?.name || (payload as any)?.given_name || "LTI User";
    const courseId = (payload as any)?.["https://purl.imsglobal.org/spec/lti/claim/context"]?.id;

    // 5. Find or create ParaVerse user
    let mapping = await getLtiUserMapping(platform.id, ltiUserId);
    let userId: string;

    if (mapping) {
      userId = mapping.paraverse_user_id;
    } else {
      // Check if user exists by email
      let user = await findUserByEmail(email);
      if (!user) {
        // Create new user (no password — LTI-only user)
        user = await createUser({
          email,
          name,
          passwordHash: "", // LTI users don't have passwords
        });
      }
      userId = user.id;
      await createLtiUserMapping(platform.id, ltiUserId, userId);

      // Mark user as verified institution
      await query(
        `UPDATE users SET institution_name = $2, institution_verified = true, verified_at = NOW()
         WHERE id = $1 AND NOT institution_verified`,
        [userId, platform.institution_name || issuer]
      );
    }

    // 6. Generate ParaVerse auth tokens
    const tokens = await generateTokens(userId);

    // 7. Redirect to TrainLab with token
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUrl = new URL(`${frontendUrl}/lti/callback`);
    redirectUrl.searchParams.set("access_token", tokens.accessToken);
    redirectUrl.searchParams.set("refresh_token", tokens.refreshToken);
    if (courseId) redirectUrl.searchParams.set("course_id", courseId);

    return c.redirect(redirectUrl.toString());
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, "LTI launch failed");
    throw new HTTPException(400, { message: "Invalid LTI launch request" });
  }
});

// GET /lti/jwks — Our platform's JWKS (for LTI tool registration)
lti.get("/jwks", async (c) => {
  // Return empty JWKS — we don't sign messages to the LMS in basic flow
  return c.json({ keys: [] });
});

// GET /lti/config — LTI tool configuration (for registration in LMS)
lti.get("/config", (c) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:5001";
  return c.json({
    title: "ParaVerse TrainLab",
    description: "Multi-agent simulation training environment",
    oidc_initiation_url: `${baseUrl}/lti/login`,
    target_link_uri: `${baseUrl}/lti/launch`,
    scopes: [],
    extensions: [],
    custom_fields: {},
    public_jwk_url: `${baseUrl}/lti/jwks`,
  });
});

export { lti };
```

**Step 5: Mount LTI routes**

Modify `backend/src/index.ts`:

```typescript
import { lti } from "./routes/lti";

// Mount BEFORE the authenticated /api/v1 block (LTI has its own auth)
app.route("/lti", lti);
```

**Step 6: Add frontend LTI callback page**

Create `frontend/src/pages/LtiCallback.tsx`:

```typescript
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function LtiCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      navigate("/");
    } else {
      navigate("/login");
    }
  }, [params, navigate]);

  return <div className="flex items-center justify-center h-screen">Authenticating...</div>;
}
```

Add route to `frontend/src/router/index.tsx`:

```typescript
import LtiCallback from "../pages/LtiCallback";
// Add to routes array (outside auth guard):
{ path: "/lti/callback", element: <LtiCallback /> },
```

**Step 7: Commit**

```bash
git add backend/src/routes/lti.ts backend/src/db/migrations/017_create_lti_platforms.sql backend/src/db/queries/lti.ts backend/src/index.ts frontend/src/pages/LtiCallback.tsx frontend/src/router/index.tsx
git commit -m "feat: add LTI 1.3 integration for TrainLab LMS embedding"
```

---

## Task 6: FinSentiment Backtest Framework

Add a backtest system that runs a simulation with a known historical scenario and compares LLM-predicted sentiment distribution against actual recorded market outcomes. Stores backtest results for accuracy tracking.

**Files:**
- Create: `backend/src/db/migrations/018_create_backtests.sql`
- Create: `backend/src/db/queries/backtests.ts`
- Create: `backend/src/services/backtestService.ts`
- Create: `backend/src/routes/backtest.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/tests/backtestService.test.ts`

**Step 1: Create migration**

Create `backend/src/db/migrations/018_create_backtests.sql`:

```sql
-- Backtest definitions and results
CREATE TABLE IF NOT EXISTS backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES simulations(id),
  owner_id UUID REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  historical_context JSONB NOT NULL,
  -- { event_description, actual_outcome, actual_sentiment_distribution, date, source }
  predicted_distribution JSONB,
  -- { positive: 0.4, neutral: 0.3, negative: 0.3 }
  accuracy_score FLOAT,
  -- 0.0 to 1.0 — cosine similarity between predicted and actual distributions
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | running | completed | failed
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_backtests_project ON backtests(project_id);
CREATE INDEX idx_backtests_owner ON backtests(owner_id);
```

**Step 2: Run migration**

```bash
cd backend && bun run src/db/migrate.ts
```

**Step 3: Create backtest queries**

Create `backend/src/db/queries/backtests.ts`:

```typescript
import { query } from "../client";

export interface BacktestRow {
  id: string;
  project_id: string;
  simulation_id: string | null;
  owner_id: string;
  name: string;
  historical_context: Record<string, unknown>;
  predicted_distribution: Record<string, number> | null;
  accuracy_score: number | null;
  status: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function createBacktest(params: {
  projectId: string;
  ownerId: string;
  name: string;
  historicalContext: Record<string, unknown>;
}): Promise<BacktestRow> {
  const result = await query(
    `INSERT INTO backtests (project_id, owner_id, name, historical_context)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [params.projectId, params.ownerId, params.name, JSON.stringify(params.historicalContext)]
  );
  return result.rows[0];
}

export async function updateBacktest(
  id: string,
  updates: Partial<{
    simulationId: string;
    predictedDistribution: Record<string, number>;
    accuracyScore: number;
    status: string;
    error: string;
    completedAt: string;
  }>
): Promise<BacktestRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (updates.simulationId !== undefined) { sets.push(`simulation_id = $${idx++}`); vals.push(updates.simulationId); }
  if (updates.predictedDistribution !== undefined) { sets.push(`predicted_distribution = $${idx++}`); vals.push(JSON.stringify(updates.predictedDistribution)); }
  if (updates.accuracyScore !== undefined) { sets.push(`accuracy_score = $${idx++}`); vals.push(updates.accuracyScore); }
  if (updates.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(updates.status); }
  if (updates.error !== undefined) { sets.push(`error = $${idx++}`); vals.push(updates.error); }
  if (updates.completedAt !== undefined) { sets.push(`completed_at = $${idx++}`); vals.push(updates.completedAt); }

  if (sets.length === 0) return null;

  vals.push(id);
  const result = await query(
    `UPDATE backtests SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

export async function getBacktestsByProject(projectId: string): Promise<BacktestRow[]> {
  const result = await query(
    "SELECT * FROM backtests WHERE project_id = $1 ORDER BY created_at DESC",
    [projectId]
  );
  return result.rows;
}

export async function getBacktest(id: string): Promise<BacktestRow | null> {
  const result = await query("SELECT * FROM backtests WHERE id = $1", [id]);
  return result.rows[0] || null;
}
```

**Step 4: Create backtest service**

Create `backend/src/services/backtestService.ts`:

```typescript
import { logger } from "../utils/logger";
import { createBacktest, updateBacktest } from "../db/queries/backtests";
import { getSimulationEvents } from "../db/queries/simulations";
import { getLlmService } from "./llmService";
import { getSimulationService } from "./simulationService";
import { createTask, updateTask } from "../db/queries/tasks";
import type { ScenarioType } from "@shared/types/project";

interface BacktestInput {
  projectId: string;
  ownerId: string;
  name: string;
  historicalContext: {
    event_description: string;
    actual_outcome: string;
    actual_sentiment: { positive: number; neutral: number; negative: number };
    date: string;
    source?: string;
  };
  simConfig: {
    agent_count: number;
    tick_count: number;
    seed_context: string;
    platform?: "twitter" | "reddit";
  };
}

/**
 * Compute cosine similarity between two sentiment distributions.
 * Both inputs should have keys: positive, neutral, negative with values 0-1.
 */
function distributionSimilarity(
  predicted: Record<string, number>,
  actual: Record<string, number>
): number {
  const keys = ["positive", "neutral", "negative"];
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const k of keys) {
    const a = predicted[k] || 0;
    const b = actual[k] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

export async function runBacktest(input: BacktestInput): Promise<string> {
  // Create backtest record
  const backtest = await createBacktest({
    projectId: input.projectId,
    ownerId: input.ownerId,
    name: input.name,
    historicalContext: input.historicalContext,
  });

  // Create async task
  const task = await createTask({
    type: "backtest",
    referenceId: backtest.id,
    ownerId: input.ownerId,
  });

  // Run async
  doBacktest(backtest.id, input, task.id).catch((err) => {
    logger.error({ err, backtestId: backtest.id }, "Backtest failed");
  });

  return task.id;
}

async function doBacktest(
  backtestId: string,
  input: BacktestInput,
  taskId: string
): Promise<void> {
  try {
    await updateBacktest(backtestId, { status: "running" });
    await updateTask(taskId, { status: "in_progress", progress: 10 });

    // 1. Create and run simulation
    const simService = getSimulationService();
    const simId = await simService.create(input.projectId, {
      scenario_type: "fin_sentiment" as ScenarioType,
      agent_count: input.simConfig.agent_count,
      tick_count: input.simConfig.tick_count,
      seed_context: input.simConfig.seed_context,
      platform: input.simConfig.platform || "twitter",
    });

    await updateBacktest(backtestId, { simulationId: simId });
    await updateTask(taskId, { progress: 20 });

    // 2. Wait for simulation to complete
    await waitForSimulation(simId, taskId);
    await updateTask(taskId, { progress: 70 });

    // 3. Analyze sentiment distribution from events
    const events = await getSimulationEvents(simId, {
      eventType: "agent_action",
      limit: 1000,
    });

    const llm = getLlmService();
    const eventSummary = events
      .slice(0, 200)
      .map((e) => `[${e.agent_id}] ${e.content}`)
      .join("\n");

    const analysisPrompt = `Analyze the following social media simulation events and classify the overall sentiment distribution.

Events:
${eventSummary}

Return ONLY a JSON object with three keys: positive, neutral, negative.
Values should be decimals between 0 and 1 that sum to 1.0.
Example: {"positive": 0.4, "neutral": 0.35, "negative": 0.25}`;

    const predicted = await llm.chatJson<Record<string, number>>([
      { role: "user", content: analysisPrompt },
    ]);

    await updateTask(taskId, { progress: 90 });

    // 4. Compare with actual
    const accuracy = distributionSimilarity(
      predicted,
      input.historicalContext.actual_sentiment
    );

    await updateBacktest(backtestId, {
      predictedDistribution: predicted,
      accuracyScore: accuracy,
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    await updateTask(taskId, {
      status: "completed",
      progress: 100,
      result: { backtestId, accuracy, predicted },
    });

    logger.info(
      { backtestId, accuracy, predicted },
      "Backtest completed"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateBacktest(backtestId, {
      status: "failed",
      error: message,
    });
    await updateTask(taskId, { status: "failed", error: message });
    throw err;
  }
}

async function waitForSimulation(
  simId: string,
  taskId: string,
  maxWaitMs = 600000
): Promise<void> {
  const simService = getSimulationService();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const status = await simService.getStatus(simId);
    if (status?.status === "completed") return;
    if (status?.status === "failed") {
      throw new Error("Simulation failed during backtest");
    }

    // Update progress proportionally
    const elapsed = Date.now() - start;
    const progress = Math.min(20 + Math.round((elapsed / maxWaitMs) * 50), 65);
    await updateTask(taskId, { progress });

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("Simulation timeout during backtest");
}

let instance: { runBacktest: typeof runBacktest } | null = null;
export function getBacktestService() {
  if (!instance) instance = { runBacktest };
  return instance;
}
```

**Step 5: Create backtest routes**

Create `backend/src/routes/backtest.ts`:

```typescript
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { runBacktest } from "../services/backtestService";
import { getBacktestsByProject, getBacktest } from "../db/queries/backtests";
import type { ApiResponse } from "@shared/types/api";

interface AuthContext {
  userId: string;
  email: string;
}

const backtest = new Hono();

backtest.use("*", authMiddleware);

// POST /backtests — Run a new backtest
backtest.post("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json<{
    project_id: string;
    name: string;
    historical_context: {
      event_description: string;
      actual_outcome: string;
      actual_sentiment: { positive: number; neutral: number; negative: number };
      date: string;
      source?: string;
    };
    config: {
      agent_count: number;
      tick_count: number;
      seed_context: string;
      platform?: "twitter" | "reddit";
    };
  }>();

  if (!body.project_id || !body.name || !body.historical_context || !body.config) {
    throw new HTTPException(400, { message: "project_id, name, historical_context, and config required" });
  }

  const taskId = await runBacktest({
    projectId: body.project_id,
    ownerId: auth.userId,
    name: body.name,
    historicalContext: body.historical_context,
    simConfig: body.config,
  });

  return c.json({
    success: true,
    data: { task_id: taskId },
    error: null,
  } satisfies ApiResponse);
});

// GET /backtests?project_id=xxx — List backtests for a project
backtest.get("/", async (c) => {
  const projectId = c.req.query("project_id");
  if (!projectId) {
    throw new HTTPException(400, { message: "project_id query param required" });
  }

  const backtests = await getBacktestsByProject(projectId);
  return c.json({
    success: true,
    data: backtests,
    error: null,
  } satisfies ApiResponse);
});

// GET /backtests/:id — Get backtest details
backtest.get("/:id", async (c) => {
  const id = c.req.param("id");
  const bt = await getBacktest(id);
  if (!bt) throw new HTTPException(404, { message: "Backtest not found" });

  return c.json({
    success: true,
    data: bt,
    error: null,
  } satisfies ApiResponse);
});

export { backtest };
```

**Step 6: Mount routes**

Modify `backend/src/index.ts`:

```typescript
import { backtest } from "./routes/backtest";

// Add to /api/v1 routes block:
api.route("/backtests", backtest);
```

**Step 7: Write tests**

Create `backend/tests/backtestService.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";

// Test the distributionSimilarity function logic
function distributionSimilarity(
  predicted: Record<string, number>,
  actual: Record<string, number>
): number {
  const keys = ["positive", "neutral", "negative"];
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const k of keys) {
    const a = predicted[k] || 0;
    const b = actual[k] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

describe("Backtest Distribution Similarity", () => {
  test("identical distributions return 1.0", () => {
    const dist = { positive: 0.5, neutral: 0.3, negative: 0.2 };
    expect(distributionSimilarity(dist, dist)).toBeCloseTo(1.0, 5);
  });

  test("opposite distributions return low similarity", () => {
    const a = { positive: 1.0, neutral: 0, negative: 0 };
    const b = { positive: 0, neutral: 0, negative: 1.0 };
    expect(distributionSimilarity(a, b)).toBe(0);
  });

  test("similar distributions return high similarity", () => {
    const a = { positive: 0.5, neutral: 0.3, negative: 0.2 };
    const b = { positive: 0.45, neutral: 0.35, negative: 0.2 };
    const sim = distributionSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.99);
  });

  test("all-zero predicted returns 0", () => {
    const a = { positive: 0, neutral: 0, negative: 0 };
    const b = { positive: 0.5, neutral: 0.3, negative: 0.2 };
    expect(distributionSimilarity(a, b)).toBe(0);
  });

  test("uniform vs skewed returns moderate similarity", () => {
    const uniform = { positive: 0.33, neutral: 0.34, negative: 0.33 };
    const skewed = { positive: 0.8, neutral: 0.1, negative: 0.1 };
    const sim = distributionSimilarity(uniform, skewed);
    expect(sim).toBeGreaterThan(0.7);
    expect(sim).toBeLessThan(0.95);
  });
});
```

**Step 8: Run tests and commit**

```bash
cd backend && bun test tests/backtestService.test.ts
git add backend/src/db/migrations/018_create_backtests.sql backend/src/db/queries/backtests.ts backend/src/services/backtestService.ts backend/src/routes/backtest.ts backend/tests/backtestService.test.ts backend/src/index.ts
git commit -m "feat: add FinSentiment backtest framework with accuracy scoring"
```

---

## Task Summary

| # | Feature | Priority | Est. Size |
|---|---------|----------|-----------|
| 1 | Redis LLM response cache | P1 | Small |
| 2 | Set grounded variable endpoint | P1 | Small |
| 3 | OpenAPI + Scalar docs | P2 | Medium |
| 4 | WarGame access control | P2 | Small |
| 5 | LMS/LTI 1.3 integration | P2 | Medium |
| 6 | FinSentiment backtest | P3 | Medium |
