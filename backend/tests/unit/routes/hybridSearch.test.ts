import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mocks (must be set up before imports) ---

const mockGetProject = mock(() =>
  Promise.resolve({
    id: "proj-1",
    name: "Test Project",
    scenario_type: "policy",
    owner_id: "user-1",
    settings: {},
    created_at: "2026-03-09T00:00:00Z",
  })
);

mock.module("../../../src/db/queries/projects", () => ({
  getProject: mockGetProject,
}));

const mockHybridSearch = mock(() =>
  Promise.resolve([
    { id: "doc-1", title: "Result 1", content: "Some content", score: 0.9, source: "hybrid" },
    { id: "doc-2", title: "Result 2", content: "Other content", score: 0.7, source: "hybrid" },
  ])
);

mock.module("../../../src/services/hybridSearchService", () => ({
  hybridSearch: mockHybridSearch,
}));

mock.module("../../../src/services/authService", () => ({
  verifyAccessToken: () =>
    Promise.resolve({ sub: "user-1", email: "test@example.com", role: "admin" }),
}));

mock.module("../../../src/utils/logger", () => ({
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {},
  },
}));

// Stub unused services so imports don't fail
mock.module("../../../src/services/documentService", () => ({
  getDocumentService: () => ({}),
}));
mock.module("../../../src/services/graphService", () => ({
  getGraphService: () => ({}),
}));
mock.module("../../../src/db/queries/tasks", () => ({
  createTask: mock(),
  updateTask: mock(),
}));
mock.module("../../../src/db/client", () => ({
  query: mock(),
}));

import { Hono } from "hono";
import { graph } from "../../../src/routes/graph";

const app = new Hono();
app.route("/projects", graph);

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer fake-token",
    },
  };
  if (body) init.body = JSON.stringify(body);
  return app.request(`http://localhost/projects${path}`, init);
}

describe("POST /:projectId/search", () => {
  beforeEach(() => {
    mockGetProject.mockReset();
    mockHybridSearch.mockReset();

    mockGetProject.mockResolvedValue({
      id: "proj-1",
      name: "Test Project",
      scenario_type: "policy",
      owner_id: "user-1",
      settings: {},
      created_at: "2026-03-09T00:00:00Z",
    });

    mockHybridSearch.mockResolvedValue([
      { id: "doc-1", title: "Result 1", content: "Some content", score: 0.9, source: "hybrid" },
      { id: "doc-2", title: "Result 2", content: "Other content", score: 0.7, source: "hybrid" },
    ]);
  });

  test("successful search returns results with defaults", async () => {
    const res = await req("POST", "/proj-1/search", { query: "test query" });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.results).toHaveLength(2);
    expect(json.data.total).toBe(2);
    expect(json.data.mode).toBe("hybrid");

    // Verify hybridSearch was called with defaults
    expect(mockHybridSearch).toHaveBeenCalledTimes(1);
    expect(mockHybridSearch).toHaveBeenCalledWith({
      query: "test query",
      projectId: "proj-1",
      table: "documents",
      limit: 10,
      mode: "hybrid",
    });
  });

  test("respects custom mode, table, and limit", async () => {
    const res = await req("POST", "/proj-1/search", {
      query: "agents",
      mode: "vector",
      table: "ontology_nodes",
      limit: 5,
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.mode).toBe("vector");

    expect(mockHybridSearch).toHaveBeenCalledWith({
      query: "agents",
      projectId: "proj-1",
      table: "ontology_nodes",
      limit: 5,
      mode: "vector",
    });
  });

  test("caps limit at 50", async () => {
    const res = await req("POST", "/proj-1/search", {
      query: "test",
      limit: 100,
    });
    expect(res.status).toBe(200);

    expect(mockHybridSearch).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });

  test("empty query returns 400", async () => {
    const res = await req("POST", "/proj-1/search", { query: "" });
    expect(res.status).toBe(400);
    expect(mockHybridSearch).not.toHaveBeenCalled();
  });

  test("missing query returns 400", async () => {
    const res = await req("POST", "/proj-1/search", {});
    expect(res.status).toBe(400);
    expect(mockHybridSearch).not.toHaveBeenCalled();
  });

  test("project not found returns 404", async () => {
    mockGetProject.mockResolvedValue(null);

    const res = await req("POST", "/proj-unknown/search", { query: "test" });
    expect(res.status).toBe(404);
    expect(mockHybridSearch).not.toHaveBeenCalled();
  });
});
