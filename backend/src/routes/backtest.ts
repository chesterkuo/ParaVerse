import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getBacktestService } from "../services/backtestService";
import { getBacktestsByProject, getBacktest } from "../db/queries/backtests";
import type { ApiResponse } from "@shared/types/api";

const backtest = new Hono();

backtest.use("*", authMiddleware);

// POST / — create and run a backtest
backtest.post("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();

  const { projectId, name, historicalContext } = body;
  if (!projectId || !name || !historicalContext) {
    return c.json(
      { success: false, data: null, error: "projectId, name, and historicalContext are required" } satisfies ApiResponse,
      400
    );
  }

  const result = await getBacktestService().runBacktest({
    projectId,
    ownerId: auth.userId,
    name,
    historicalContext,
  });

  return c.json(
    { success: true, data: result, error: null } satisfies ApiResponse,
    201
  );
});

// GET / — list backtests by project_id
backtest.get("/", async (c) => {
  const projectId = c.req.query("project_id");
  if (!projectId) {
    return c.json(
      { success: false, data: null, error: "project_id query parameter is required" } satisfies ApiResponse,
      400
    );
  }

  const backtests = await getBacktestsByProject(projectId);
  return c.json({ success: true, data: backtests, error: null } satisfies ApiResponse);
});

// GET /:id — get backtest details
backtest.get("/:id", async (c) => {
  const id = c.req.param("id");
  const bt = await getBacktest(id);
  if (!bt) {
    return c.json(
      { success: false, data: null, error: "Backtest not found" } satisfies ApiResponse,
      404
    );
  }

  return c.json({ success: true, data: bt, error: null } satisfies ApiResponse);
});

export { backtest };
