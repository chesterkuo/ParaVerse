import { describe, test, expect, mock, beforeAll } from "bun:test";
import app from "../../../src/index";

// Mock the database layer to avoid requiring a real database
mock.module("../../../src/db/client", () => {
  return {
    query: mock(async (text: string, params?: unknown[]) => {
      // Simulate user creation (register)
      if (text.includes("INSERT INTO users")) {
        return {
          rows: [
            {
              id: "user-123",
              email: params?.[0] || "test@test.com",
              name: params?.[2] || "Test",
              role: "user",
              password_hash: params?.[1] || "",
              created_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        };
      }
      // Simulate user lookup by email (returns null for register, user for login)
      if (text.includes("SELECT") && text.includes("users") && text.includes("email")) {
        return { rows: [], rowCount: 0 };
      }
      // Simulate project creation
      if (text.includes("INSERT INTO projects")) {
        return {
          rows: [
            {
              id: "proj-456",
              name: params?.[0],
              scenario_type: params?.[1],
              owner_id: params?.[2],
              settings: JSON.parse((params?.[3] as string) || "{}"),
              created_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        };
      }
      // Simulate project listing
      if (text.includes("SELECT") && text.includes("projects") && text.includes("owner_id")) {
        return {
          rows: [
            {
              id: "proj-456",
              name: "Test Project",
              scenario_type: "fin_sentiment",
              owner_id: "user-123",
              settings: {},
              created_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }),
    getPool: () => ({
      connect: async () => ({ release: () => {} }),
      end: async () => {},
      on: () => {},
    }),
    getClient: async () => ({ release: () => {} }),
    closePool: async () => {},
  };
});

let authToken: string;

describe("Projects Integration", () => {
  beforeAll(async () => {
    // Register a user and get a token
    const res = await app.fetch(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        }),
      })
    );
    const data = await res.json();
    authToken = data.data?.access_token;
  });

  test("create project returns 201", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/v1/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "My Simulation",
          scenario_type: "fin_sentiment",
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("My Simulation");
  });

  test("list projects returns data", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/v1/projects", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("list projects requires auth", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/v1/projects", {
        method: "GET",
      })
    );

    expect(res.status).toBe(401);
    const text = await res.text();
    // Should indicate failure - either JSON error response or error text
    if (text.startsWith("{")) {
      const body = JSON.parse(text);
      expect(body.success).toBe(false);
    } else {
      // HTTPException may return plain text
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
