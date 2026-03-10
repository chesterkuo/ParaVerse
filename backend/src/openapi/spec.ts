/**
 * OpenAPI 3.1 specification for the ParaVerse API.
 * Hand-written to match all existing routes.
 */

const simulationIdParam = {
  name: "simulationId",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const, format: "uuid" },
  description: "Simulation UUID",
};

const projectIdParam = {
  name: "id",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const, format: "uuid" },
  description: "Project UUID",
};

function jsonBody(schema: Record<string, unknown>, description?: string) {
  return {
    required: true,
    ...(description ? { description } : {}),
    content: { "application/json": { schema } },
  };
}

function apiResponse(dataSchema: Record<string, unknown>, description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { type: "object", properties: { data: dataSchema } }],
        },
      },
    },
  };
}

const errorResponses = {
  "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiResponse" } } } },
  "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiResponse" } } } },
};

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "ParaVerse API",
    version: "1.0.0",
    description:
      "ParaVerse is a B2B multi-agent simulation platform with dual engines (OASIS + Concordia). " +
      "It enables scenario-based social simulations for policy analysis, crisis PR, financial sentiment, and more.",
    license: { name: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Auth", description: "Authentication and token management" },
    { name: "Projects", description: "Project CRUD operations" },
    { name: "Knowledge Graph", description: "Document upload, graph building, and search" },
    { name: "Simulation", description: "OASIS simulation lifecycle" },
    { name: "Simulation (Concordia)", description: "Concordia-specific operations: fork, checkpoint, manual actions, variables" },
    { name: "Report", description: "Report generation and export" },
    { name: "Tasks", description: "Async task status polling" },
    { name: "Backtest", description: "Backtest management" },
  ],
  paths: {
    // ── Auth ──────────────────────────────────────────────────────
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        security: [],
        requestBody: jsonBody({
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string", minLength: 1, maxLength: 100 },
          },
        }),
        responses: {
          "201": apiResponse(
            {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/User" },
                access_token: { type: "string" },
                refresh_token: { type: "string" },
              },
            },
            "User registered successfully",
          ),
          "409": { description: "Email already registered" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        security: [],
        requestBody: jsonBody({
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        }),
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/User" },
                access_token: { type: "string" },
                refresh_token: { type: "string" },
              },
            },
            "Login successful",
          ),
          "401": { description: "Invalid email or password" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        security: [],
        requestBody: jsonBody({
          type: "object",
          required: ["refresh_token"],
          properties: { refresh_token: { type: "string" } },
        }),
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                access_token: { type: "string" },
                refresh_token: { type: "string" },
              },
            },
            "Tokens refreshed",
          ),
          "401": { description: "Invalid refresh token" },
        },
      },
    },

    // ── Projects ─────────────────────────────────────────────────
    "/projects": {
      get: {
        tags: ["Projects"],
        summary: "List projects for current user",
        parameters: [
          { name: "cursor", in: "query", schema: { type: "string" }, description: "Pagination cursor (created_at of last item)" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Max items to return" },
        ],
        responses: {
          "200": apiResponse(
            { type: "array", items: { $ref: "#/components/schemas/Project" } },
            "List of projects",
          ),
          ...errorResponses,
        },
      },
      post: {
        tags: ["Projects"],
        summary: "Create a new project",
        requestBody: jsonBody({
          type: "object",
          required: ["name", "scenario_type"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            scenario_type: { $ref: "#/components/schemas/ScenarioType" },
            settings: { type: "object", additionalProperties: true },
          },
        }),
        responses: {
          "201": apiResponse({ $ref: "#/components/schemas/Project" }, "Project created"),
          ...errorResponses,
        },
      },
    },
    "/projects/{id}": {
      get: {
        tags: ["Projects"],
        summary: "Get project by ID",
        parameters: [projectIdParam],
        responses: {
          "200": apiResponse({ $ref: "#/components/schemas/Project" }, "Project details"),
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Projects"],
        summary: "Delete a project",
        parameters: [projectIdParam],
        responses: {
          "200": apiResponse({ type: "object", properties: { deleted: { type: "boolean" } } }, "Project deleted"),
          ...errorResponses,
        },
      },
    },

    // ── Knowledge Graph ──────────────────────────────────────────
    "/projects/{id}/documents": {
      post: {
        tags: ["Knowledge Graph"],
        summary: "Upload a document (multipart)",
        parameters: [projectIdParam],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary", description: "Document file to upload" },
                },
              },
            },
          },
        },
        responses: {
          "202": apiResponse(
            { type: "object", properties: { taskId: { type: "string", format: "uuid" } } },
            "Document processing started",
          ),
          ...errorResponses,
        },
      },
    },
    "/projects/{id}/graph/build": {
      post: {
        tags: ["Knowledge Graph"],
        summary: "Build knowledge graph from uploaded documents",
        parameters: [projectIdParam],
        requestBody: jsonBody({
          type: "object",
          properties: {
            chunks: { type: "array", items: { type: "string" }, description: "Optional text chunks; defaults to stored documents" },
          },
        }),
        responses: {
          "202": apiResponse(
            { type: "object", properties: { taskId: { type: "string", format: "uuid" } } },
            "Graph build started",
          ),
          ...errorResponses,
        },
      },
    },
    "/projects/{id}/graph": {
      get: {
        tags: ["Knowledge Graph"],
        summary: "Get knowledge graph for a project",
        parameters: [projectIdParam],
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                nodes: { type: "array", items: { type: "object" } },
                edges: { type: "array", items: { type: "object" } },
              },
            },
            "Knowledge graph data",
          ),
          ...errorResponses,
        },
      },
    },
    "/projects/{id}/search": {
      post: {
        tags: ["Knowledge Graph"],
        summary: "Hybrid search across project data",
        parameters: [projectIdParam],
        requestBody: jsonBody({
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string", minLength: 1 },
            mode: { type: "string", enum: ["hybrid", "vector", "text"], default: "hybrid" },
            limit: { type: "integer", default: 10, maximum: 50 },
            table: { type: "string", enum: ["documents", "simulation_events", "ontology_nodes"], default: "documents" },
          },
        }),
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                results: { type: "array", items: { type: "object" } },
                total: { type: "integer" },
                mode: { type: "string" },
              },
            },
            "Search results",
          ),
          ...errorResponses,
        },
      },
    },

    // ── Simulation ───────────────────────────────────────────────
    "/simulations": {
      post: {
        tags: ["Simulation"],
        summary: "Create a new simulation",
        requestBody: jsonBody({
          type: "object",
          required: ["project_id", "config"],
          properties: {
            project_id: { type: "string", format: "uuid" },
            config: { $ref: "#/components/schemas/SimConfig" },
          },
        }),
        responses: {
          "201": apiResponse({ $ref: "#/components/schemas/Simulation" }, "Simulation created"),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/start": {
      post: {
        tags: ["Simulation"],
        summary: "Start a simulation",
        parameters: [simulationIdParam],
        responses: {
          "200": apiResponse(
            { type: "object", properties: { started: { type: "boolean" } } },
            "Simulation started",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/status": {
      get: {
        tags: ["Simulation"],
        summary: "Get simulation status",
        parameters: [simulationIdParam],
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                status: { type: "string", enum: ["pending", "running", "completed", "failed"] },
                current_tick: { type: "integer" },
                total_ticks: { type: "integer" },
              },
            },
            "Current simulation status",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/events": {
      get: {
        tags: ["Simulation"],
        summary: "Get simulation events",
        parameters: [
          simulationIdParam,
          { name: "limit", in: "query", schema: { type: "integer", maximum: 10000 }, description: "Max events to return" },
          { name: "offset", in: "query", schema: { type: "integer" }, description: "Offset for pagination" },
          { name: "event_type", in: "query", schema: { type: "string" }, description: "Filter by event type" },
        ],
        responses: {
          "200": apiResponse({ type: "array", items: { type: "object" } }, "Simulation events"),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/agents": {
      get: {
        tags: ["Simulation"],
        summary: "List agents for a simulation",
        parameters: [simulationIdParam],
        responses: {
          "200": apiResponse({ type: "array", items: { type: "object" } }, "Agent list"),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/interview": {
      post: {
        tags: ["Simulation"],
        summary: "Interview a simulation agent",
        parameters: [simulationIdParam],
        requestBody: jsonBody({
          type: "object",
          required: ["agent_id", "question"],
          properties: {
            agent_id: { type: "string" },
            question: { type: "string", minLength: 1 },
          },
        }),
        responses: {
          "200": apiResponse(
            { type: "object", properties: { sent: { type: "boolean" } } },
            "Interview question sent",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/acceptance-matrix": {
      get: {
        tags: ["Simulation"],
        summary: "Get stakeholder acceptance matrix",
        parameters: [simulationIdParam],
        responses: {
          "200": apiResponse({ type: "object", additionalProperties: true }, "Acceptance matrix heatmap data"),
          ...errorResponses,
        },
      },
    },

    // ── Simulation (Concordia) ───────────────────────────────────
    "/simulations/{simulationId}/fork": {
      post: {
        tags: ["Simulation (Concordia)"],
        summary: "Fork a simulation scenario",
        parameters: [simulationIdParam],
        requestBody: jsonBody({
          type: "object",
          required: ["branch_label", "override_vars"],
          properties: {
            branch_label: { type: "string", minLength: 1 },
            override_vars: { type: "object", additionalProperties: true },
          },
        }),
        responses: {
          "200": apiResponse(
            { type: "object", properties: { forked: { type: "boolean" } } },
            "Scenario forked",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/checkpoint": {
      post: {
        tags: ["Simulation (Concordia)"],
        summary: "Save a checkpoint",
        parameters: [simulationIdParam],
        responses: {
          "200": apiResponse(
            { type: "object", properties: { saved: { type: "boolean" } } },
            "Checkpoint saved",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/manual-action": {
      post: {
        tags: ["Simulation (Concordia)"],
        summary: "Inject a manual action into the simulation",
        parameters: [simulationIdParam],
        requestBody: jsonBody({
          type: "object",
          required: ["action"],
          properties: {
            action: { type: "object", additionalProperties: true, description: "Action payload to inject" },
          },
        }),
        responses: {
          "200": apiResponse(
            { type: "object", properties: { injected: { type: "boolean" } } },
            "Action injected",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/set-var": {
      post: {
        tags: ["Simulation (Concordia)"],
        summary: "Set a Concordia grounded variable",
        parameters: [simulationIdParam],
        requestBody: jsonBody({
          type: "object",
          required: ["var_name", "value"],
          properties: {
            var_name: { type: "string", minLength: 1 },
            value: { type: "number" },
          },
        }),
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                var_name: { type: "string" },
                value: { type: "number" },
              },
            },
            "Variable set",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/checkpoints": {
      get: {
        tags: ["Simulation (Concordia)"],
        summary: "List checkpoints for a simulation",
        parameters: [simulationIdParam],
        responses: {
          "200": apiResponse(
            {
              type: "array",
              items: {
                type: "object",
                properties: {
                  filename: { type: "string" },
                  tick: { type: "integer" },
                  created_at: { type: "string", format: "date-time" },
                  size_bytes: { type: "integer" },
                },
              },
            },
            "List of checkpoints",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/checkpoints/load": {
      post: {
        tags: ["Simulation (Concordia)"],
        summary: "Load a checkpoint",
        parameters: [simulationIdParam],
        requestBody: jsonBody({
          type: "object",
          required: ["filename"],
          properties: {
            filename: { type: "string", minLength: 1 },
          },
        }),
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                loaded: { type: "boolean" },
                filename: { type: "string" },
              },
            },
            "Checkpoint loaded",
          ),
          ...errorResponses,
        },
      },
    },

    // ── Report ───────────────────────────────────────────────────
    "/simulations/{simulationId}/report": {
      post: {
        tags: ["Report"],
        summary: "Generate a simulation report (async)",
        parameters: [simulationIdParam],
        responses: {
          "202": apiResponse(
            { type: "object", properties: { taskId: { type: "string", format: "uuid" } } },
            "Report generation started",
          ),
          ...errorResponses,
        },
      },
      get: {
        tags: ["Report"],
        summary: "Get report sections",
        parameters: [simulationIdParam],
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                simulation_id: { type: "string", format: "uuid" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      content: { type: "string" },
                    },
                  },
                },
              },
            },
            "Report sections",
          ),
          ...errorResponses,
        },
      },
    },
    "/simulations/{simulationId}/report/export": {
      get: {
        tags: ["Report"],
        summary: "Export report as PDF or DOCX",
        description: "Authenticates via query-param token (for window.open usage). Returns a binary file.",
        security: [],
        parameters: [
          simulationIdParam,
          { name: "token", in: "query", required: true, schema: { type: "string" }, description: "JWT access token" },
          { name: "format", in: "query", schema: { type: "string", enum: ["pdf", "docx"], default: "pdf" }, description: "Export format" },
        ],
        responses: {
          "200": {
            description: "Binary file download",
            content: {
              "application/pdf": { schema: { type: "string", format: "binary" } },
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { schema: { type: "string", format: "binary" } },
            },
          },
          "401": { description: "Invalid token" },
          "404": { description: "Simulation or report not found" },
        },
      },
    },

    // ── Tasks ────────────────────────────────────────────────────
    "/tasks/{taskId}": {
      get: {
        tags: ["Tasks"],
        summary: "Get async task status",
        parameters: [
          { name: "taskId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Task UUID" },
        ],
        responses: {
          "200": apiResponse(
            {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                type: { type: "string" },
                status: { type: "string", enum: ["pending", "running", "completed", "failed"] },
                progress: { type: "integer", minimum: 0, maximum: 100 },
                result: { type: "object", nullable: true },
                error: { type: "string", nullable: true },
              },
            },
            "Task status",
          ),
          ...errorResponses,
        },
      },
    },

    // ── Backtest ─────────────────────────────────────────────────
    "/backtests": {
      post: {
        tags: ["Backtest"],
        summary: "Create a new backtest",
        requestBody: jsonBody({
          type: "object",
          required: ["simulation_id", "config"],
          properties: {
            simulation_id: { type: "string", format: "uuid" },
            config: { type: "object", additionalProperties: true },
          },
        }),
        responses: {
          "201": apiResponse({ type: "object" }, "Backtest created"),
          ...errorResponses,
        },
      },
      get: {
        tags: ["Backtest"],
        summary: "List backtests",
        responses: {
          "200": apiResponse({ type: "array", items: { type: "object" } }, "List of backtests"),
          ...errorResponses,
        },
      },
    },
    "/backtests/{backtestId}": {
      get: {
        tags: ["Backtest"],
        summary: "Get backtest by ID",
        parameters: [
          { name: "backtestId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Backtest UUID" },
        ],
        responses: {
          "200": apiResponse({ type: "object" }, "Backtest details"),
          ...errorResponses,
        },
      },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { oneOf: [{ type: "object" }, { type: "array" }, { type: "null" }] },
          error: { type: "string", nullable: true },
          meta: {
            type: "object",
            nullable: true,
            properties: {
              cursor: { type: "string", nullable: true },
              has_more: { type: "boolean" },
            },
          },
        },
        required: ["success"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          role: { type: "string" },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          scenario_type: { $ref: "#/components/schemas/ScenarioType" },
          owner_id: { type: "string", format: "uuid" },
          settings: { type: "object", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Simulation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          project_id: { type: "string", format: "uuid" },
          engine: { type: "string", enum: ["oasis", "concordia"] },
          status: { type: "string", enum: ["pending", "running", "completed", "failed"] },
          config: { $ref: "#/components/schemas/SimConfig" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      SimConfig: {
        type: "object",
        required: ["scenario_type", "agent_count", "tick_count", "seed_context"],
        properties: {
          scenario_type: { $ref: "#/components/schemas/ScenarioType" },
          agent_count: { type: "integer", minimum: 1 },
          tick_count: { type: "integer", minimum: 1 },
          seed_context: { type: "string", minLength: 1 },
          platform: { type: "string", enum: ["twitter", "reddit"] },
          branches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                description: { type: "string" },
                override_vars: { type: "object", additionalProperties: true },
              },
            },
          },
          custom_params: { type: "object", additionalProperties: true },
        },
      },
      ScenarioType: {
        type: "string",
        enum: ["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "war_game", "train_lab"],
        description: "Scenario type for the simulation",
      },
    },
  },
} as const;
