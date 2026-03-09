import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import { quotaCheck } from "../../../src/middleware/quotaEnforcement";

// Mock modules
const mockFindUserById = mock(() => Promise.resolve(null as any));
const mockGetMonthlyUsageCount = mock(() => Promise.resolve(0));

mock.module("../../../src/db/queries/users", () => ({
  findUserById: mockFindUserById,
}));

mock.module("../../../src/db/queries/usage", () => ({
  getMonthlyUsageCount: mockGetMonthlyUsageCount,
}));

mock.module("../../../src/utils/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

function createApp(resourceType: string) {
  const app = new Hono();

  // Fake auth middleware
  app.use("*", async (c, next) => {
    c.set("auth", { userId: "user-1", email: "test@test.com", role: "user" });
    await next();
  });

  app.post("/test", quotaCheck(resourceType), (c) => {
    return c.json({ success: true });
  });

  return app;
}

describe("quotaCheck middleware", () => {
  beforeEach(() => {
    mockFindUserById.mockReset();
    mockGetMonthlyUsageCount.mockReset();
  });

  test("allows request when under quota", async () => {
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      role: "user",
      quota: { simulations_per_month: 5, max_agents: 50 },
      created_at: "2026-01-01",
    });
    mockGetMonthlyUsageCount.mockResolvedValue(2);

    const app = createApp("simulation");
    const res = await app.request("/test", { method: "POST" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("rejects with 429 when at quota limit", async () => {
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      role: "user",
      quota: { simulations_per_month: 3, max_agents: 50 },
      created_at: "2026-01-01",
    });
    mockGetMonthlyUsageCount.mockResolvedValue(3);

    const app = createApp("simulation");
    const res = await app.request("/test", { method: "POST" });

    expect(res.status).toBe(429);
  });

  test("rejects with 429 when over quota", async () => {
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      role: "user",
      quota: { simulations_per_month: 2, max_agents: 50 },
      created_at: "2026-01-01",
    });
    mockGetMonthlyUsageCount.mockResolvedValue(5);

    const app = createApp("simulation");
    const res = await app.request("/test", { method: "POST" });

    expect(res.status).toBe(429);
  });

  test("passes through when no matching quota field", async () => {
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      role: "user",
      quota: { simulations_per_month: 2, max_agents: 50 },
      created_at: "2026-01-01",
    });

    const app = createApp("unknown_resource");
    const res = await app.request("/test", { method: "POST" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("uses default quota when user quota is null", async () => {
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      role: "user",
      quota: null,
      created_at: "2026-01-01",
    });
    mockGetMonthlyUsageCount.mockResolvedValue(1);

    const app = createApp("simulation");
    const res = await app.request("/test", { method: "POST" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("fails open when DB error occurs", async () => {
    mockFindUserById.mockRejectedValue(new Error("DB connection failed"));

    const app = createApp("simulation");
    const res = await app.request("/test", { method: "POST" });

    // Should allow through (fail-open)
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
