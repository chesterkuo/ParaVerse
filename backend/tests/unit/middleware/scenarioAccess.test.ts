import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// Mock modules before importing middleware
const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }) as any);

mock.module("../../../src/db/client", () => ({
  query: mockQuery,
}));

mock.module("../../../src/utils/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

import {
  scenarioAccessCheck,
  RESTRICTED_SCENARIOS,
} from "../../../src/middleware/scenarioAccess";

function createBodyApp() {
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.set("auth", { userId: "user-1", email: "test@test.com", role: "user" });
    await next();
  });

  app.post("/projects", scenarioAccessCheck("body"), (c) => {
    return c.json({ success: true, parsedBody: c.get("parsedBody") });
  });

  return app;
}

function createProjectApp() {
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.set("auth", { userId: "user-1", email: "test@test.com", role: "user" });
    await next();
  });

  app.post(
    "/simulations/:simulationId/run",
    scenarioAccessCheck("project"),
    (c) => {
      return c.json({ success: true });
    }
  );

  return app;
}

describe("RESTRICTED_SCENARIOS", () => {
  test("includes war_game", () => {
    expect(RESTRICTED_SCENARIOS).toContain("war_game");
  });

  test("does not include fin_sentiment", () => {
    expect(RESTRICTED_SCENARIOS).not.toContain("fin_sentiment");
  });

  test("does not include content_lab", () => {
    expect(RESTRICTED_SCENARIOS).not.toContain("content_lab");
  });

  test("does not include crisis_pr", () => {
    expect(RESTRICTED_SCENARIOS).not.toContain("crisis_pr");
  });

  test("does not include policy_lab", () => {
    expect(RESTRICTED_SCENARIOS).not.toContain("policy_lab");
  });

  test("does not include train_lab", () => {
    expect(RESTRICTED_SCENARIOS).not.toContain("train_lab");
  });
});

describe("scenarioAccessCheck (body source)", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test("allows unrestricted scenario without DB check", async () => {
    const app = createBodyApp();
    const res = await app.request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_type: "fin_sentiment", name: "Test" }),
    });

    expect(res.status).toBe(200);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("stores parsed body in context", async () => {
    const app = createBodyApp();
    const payload = { scenario_type: "content_lab", name: "My Project" };
    const res = await app.request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parsedBody).toEqual(payload);
  });

  test("blocks war_game for unverified user", async () => {
    // First call: check institution_verified
    // Second call: fallback check organization_approvals (no approved record)
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ institution_verified: false }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

    const app = createBodyApp();
    const res = await app.request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_type: "war_game", name: "Test" }),
    });

    expect(res.status).toBe(403);
  });

  test("blocks war_game when user not found", async () => {
    // First call: check institution_verified (user not found)
    // Second call: fallback check organization_approvals (no approved record)
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const app = createBodyApp();
    const res = await app.request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_type: "war_game", name: "Test" }),
    });

    expect(res.status).toBe(403);
  });

  test("allows war_game for verified user", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ institution_verified: true }],
      rowCount: 1,
    });

    const app = createBodyApp();
    const res = await app.request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_type: "war_game", name: "Test" }),
    });

    expect(res.status).toBe(200);
  });
});

describe("scenarioAccessCheck (project source)", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test("blocks restricted scenario from project lookup for unverified user", async () => {
    // First call: lookup scenario_type from project
    // Second call: check institution_verified
    // Third call: fallback check organization_approvals (no approved record)
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ scenario_type: "war_game" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ institution_verified: false }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

    const app = createProjectApp();
    const res = await app.request("/simulations/sim-1/run", {
      method: "POST",
    });

    expect(res.status).toBe(403);
  });

  test("allows unrestricted scenario from project lookup", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ scenario_type: "fin_sentiment" }],
      rowCount: 1,
    });

    const app = createProjectApp();
    const res = await app.request("/simulations/sim-1/run", {
      method: "POST",
    });

    expect(res.status).toBe(200);
  });
});
