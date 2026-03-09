import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getReportService } from "../services/reportService";
import { getReportSections } from "../db/queries/reports";
import { getSimulationForOwner } from "../db/queries/simulations";
import type { ApiResponse } from "@shared/types/api";
import PDFDocument from "pdfkit";
import { jwtVerify } from "jose";

const report = new Hono();

report.use("*", authMiddleware);

// Separate router for PDF export (no authMiddleware - uses query param token for window.open)
const reportExport = new Hono();

reportExport.get("/:simulationId/report/export", async (c) => {
  const token = c.req.query("token") || "";
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret);
    userId = payload.sub as string;
  } catch {
    return c.json({ success: false, error: "Invalid token" }, 401);
  }

  const simulationId = c.req.param("simulationId");
  const sim = await getSimulationForOwner(simulationId, userId);
  if (!sim) return c.json({ success: false, error: "Simulation not found" }, 404);

  const sections = await getReportSections(simulationId);
  if (sections.length === 0) {
    return c.json({ success: false, error: "Report not generated yet" }, 404);
  }

  const scenarioType = (sim.config as Record<string, unknown>)?.scenario_type || "simulation";

  // Generate PDF
  const chunks: Uint8Array[] = [];
  const doc = new PDFDocument({ margin: 60, size: "A4" });

  doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));

  const pdfReady = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Title page
  doc.fontSize(24).font("Helvetica-Bold").text("ParaVerse Simulation Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(14).font("Helvetica").text(`Scenario: ${scenarioType}`, { align: "center" });
  doc.fontSize(10).text(`Generated: ${new Date().toISOString().split("T")[0]}`, { align: "center" });
  doc.moveDown(2);

  // Sections
  for (const section of sections) {
    doc.fontSize(16).font("Helvetica-Bold").text(section.title);
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(section.content, { lineGap: 4 });
    doc.moveDown(1.5);
  }

  doc.end();

  const pdfBuffer = await pdfReady;
  const filename = `paraverse-report-${simulationId.slice(0, 8)}.pdf`;

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
});

// Generate report (async)
report.post("/:simulationId/report", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
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
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const sections = await getReportSections(simulationId);

  return c.json({
    success: true,
    data: { simulation_id: simulationId, sections },
    error: null,
  } satisfies ApiResponse);
});

export { report, reportExport };
