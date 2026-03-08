import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getReportService } from "../services/reportService";
import { getReportSections } from "../db/queries/reports";
import { getSimulation } from "../db/queries/simulations";
import type { ApiResponse } from "@shared/types/api";

const report = new Hono();

report.use("*", authMiddleware);

// Generate report (async)
report.post("/:simulationId/report", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulation(simulationId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const reportService = getReportService();
  const taskId = await reportService.generateReport(simulationId, auth.userId);

  return c.json(
    {
      success: true,
      data: { taskId },
      error: null,
    } satisfies ApiResponse,
    202
  );
});

// Get report sections
report.get("/:simulationId/report", async (c) => {
  const simulationId = c.req.param("simulationId");

  const sections = await getReportSections(simulationId);

  return c.json({
    success: true,
    data: { simulation_id: simulationId, sections },
    error: null,
  } satisfies ApiResponse);
});

export { report };
