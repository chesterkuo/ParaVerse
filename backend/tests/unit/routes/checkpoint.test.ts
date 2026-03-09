import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mocks ---

const mockAccess = mock(() => Promise.resolve());
const mockReaddir = mock(() => Promise.resolve([] as string[]));
const mockStat = mock(
  () =>
    Promise.resolve({
      mtime: new Date("2026-03-09T10:00:00Z"),
      size: 1024,
    }) as any
);

mock.module("node:fs/promises", () => ({
  access: mockAccess,
  readdir: mockReaddir,
  stat: mockStat,
}));

const mockGetSimulationForOwner = mock(() =>
  Promise.resolve({
    id: "sim-1",
    project_id: "proj-1",
    engine: "concordia",
    status: "running",
    config: {},
    checkpoint_path: null,
    grounded_vars: {},
    stats: {},
    started_at: null,
    completed_at: null,
    created_at: "2026-03-09T00:00:00Z",
  })
);

mock.module("../../../src/db/queries/simulations", () => ({
  getSimulationForOwner: mockGetSimulationForOwner,
}));

const mockForwardCommand = mock(() => Promise.resolve());
mock.module("../../../src/services/simulationService", () => ({
  getSimulationService: () => ({
    forwardCommand: mockForwardCommand,
  }),
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

import { Hono } from "hono";
import { checkpoint } from "../../../src/routes/checkpoint";

const app = new Hono();
app.route("/simulations", checkpoint);

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer fake-token",
    },
  };
  if (body) init.body = JSON.stringify(body);
  return app.request(`http://localhost/simulations${path}`, init);
}

describe("checkpoint routes", () => {
  beforeEach(() => {
    mockAccess.mockReset();
    mockReaddir.mockReset();
    mockStat.mockReset();
    mockGetSimulationForOwner.mockReset();
    mockForwardCommand.mockReset();

    // Default: simulation exists and is concordia
    mockGetSimulationForOwner.mockResolvedValue({
      id: "sim-1",
      project_id: "proj-1",
      engine: "concordia",
      status: "running",
      config: {},
      checkpoint_path: null,
      grounded_vars: {},
      stats: {},
      started_at: null,
      completed_at: null,
      created_at: "2026-03-09T00:00:00Z",
    });
  });

  describe("GET /:simulationId/checkpoints", () => {
    test("returns empty list when checkpoint directory does not exist", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const res = await req("GET", "/sim-1/checkpoints");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    test("returns checkpoint list with proper structure", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        "checkpoint_tick5.pkl",
        "checkpoint_tick10.pkl",
        "other_file.txt",
        "checkpoint_tick1.pkl",
      ] as any);
      mockStat.mockResolvedValue({
        mtime: new Date("2026-03-09T10:00:00Z"),
        size: 2048,
      } as any);

      const res = await req("GET", "/sim-1/checkpoints");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(3);

      // Should be sorted by tick ascending
      expect(json.data[0].tick).toBe(1);
      expect(json.data[1].tick).toBe(5);
      expect(json.data[2].tick).toBe(10);

      // Check structure
      const cp = json.data[0];
      expect(cp.filename).toBe("checkpoint_tick1.pkl");
      expect(cp.tick).toBe(1);
      expect(cp.created_at).toBe("2026-03-09T10:00:00.000Z");
      expect(cp.size_bytes).toBe(2048);
    });

    test("returns 404 when simulation not found", async () => {
      mockGetSimulationForOwner.mockResolvedValue(null);

      const res = await req("GET", "/sim-unknown/checkpoints");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /:simulationId/checkpoints/load", () => {
    test("sends load_checkpoint IPC command", async () => {
      mockAccess.mockResolvedValue(undefined);

      const res = await req("POST", "/sim-1/checkpoints/load", {
        filename: "checkpoint_tick5.pkl",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.loaded).toBe(true);
      expect(json.data.filename).toBe("checkpoint_tick5.pkl");

      expect(mockForwardCommand).toHaveBeenCalledTimes(1);
      expect(mockForwardCommand).toHaveBeenCalledWith("sim-1", {
        type: "load_checkpoint",
        filename: "checkpoint_tick5.pkl",
      });
    });

    test("returns 404 when checkpoint file does not exist", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const res = await req("POST", "/sim-1/checkpoints/load", {
        filename: "checkpoint_tick999.pkl",
      });
      expect(res.status).toBe(404);
    });

    test("returns 400 when engine is not concordia", async () => {
      mockGetSimulationForOwner.mockResolvedValue({
        id: "sim-1",
        project_id: "proj-1",
        engine: "oasis",
        status: "running",
        config: {},
        checkpoint_path: null,
        grounded_vars: {},
        stats: {},
        started_at: null,
        completed_at: null,
        created_at: "2026-03-09T00:00:00Z",
      });

      const res = await req("POST", "/sim-1/checkpoints/load", {
        filename: "checkpoint_tick5.pkl",
      });
      expect(res.status).toBe(400);
    });

    test("returns 404 when simulation not found", async () => {
      mockGetSimulationForOwner.mockResolvedValue(null);

      const res = await req("POST", "/sim-unknown/checkpoints/load", {
        filename: "checkpoint_tick5.pkl",
      });
      expect(res.status).toBe(404);
    });
  });
});
