import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mocks ---

const mockJwtVerify = mock(() =>
  Promise.resolve({ payload: { sub: "user-1" } })
);

mock.module("jose", () => ({
  jwtVerify: mockJwtVerify,
}));

const mockGetReportSections = mock(() =>
  Promise.resolve([
    { title: "Executive Summary", content: "Summary content here.\nSecond line." },
    { title: "Findings", content: "Finding details." },
  ])
);

mock.module("../../../src/db/queries/reports", () => ({
  getReportSections: mockGetReportSections,
}));

const mockGetSimulationForOwner = mock(() =>
  Promise.resolve({
    id: "sim-abcd1234-0000",
    project_id: "proj-1",
    engine: "oasis",
    status: "completed",
    config: { scenario_type: "market_entry" },
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

mock.module("../../../src/utils/logger", () => ({
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {},
  },
}));

import { Hono } from "hono";
import { reportExport } from "../../../src/routes/report";

const app = new Hono();
app.route("/simulations", reportExport);

function req(simulationId: string, query: string = "") {
  const url = `http://localhost/simulations/${simulationId}/report/export?token=fake${query}`;
  return app.request(url, { method: "GET" });
}

describe("report export - DOCX", () => {
  beforeEach(() => {
    mockJwtVerify.mockReset();
    mockGetReportSections.mockReset();
    mockGetSimulationForOwner.mockReset();

    mockJwtVerify.mockResolvedValue({ payload: { sub: "user-1" } } as any);
    mockGetSimulationForOwner.mockResolvedValue({
      id: "sim-abcd1234-0000",
      project_id: "proj-1",
      engine: "oasis",
      status: "completed",
      config: { scenario_type: "market_entry" },
      checkpoint_path: null,
      grounded_vars: {},
      stats: {},
      started_at: null,
      completed_at: null,
      created_at: "2026-03-09T00:00:00Z",
    });
    mockGetReportSections.mockResolvedValue([
      { title: "Executive Summary", content: "Summary content here.\nSecond line." },
      { title: "Findings", content: "Finding details." },
    ]);
  });

  test("format=docx returns DOCX content-type", async () => {
    const res = await req("sim-abcd1234-0000", "&format=docx");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(res.headers.get("Content-Disposition")).toContain(".docx");
  });

  test("format=docx returns non-empty body", async () => {
    const res = await req("sim-abcd1234-0000", "&format=docx");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  test("default format returns PDF content-type", async () => {
    const res = await req("sim-abcd1234-0000");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(".pdf");
  });

  test("format=pdf returns PDF content-type", async () => {
    const res = await req("sim-abcd1234-0000", "&format=pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  test("returns 401 for invalid token", async () => {
    mockJwtVerify.mockRejectedValue(new Error("invalid"));
    const res = await req("sim-abcd1234-0000", "&format=docx");
    expect(res.status).toBe(401);
  });

  test("returns 404 when simulation not found", async () => {
    mockGetSimulationForOwner.mockResolvedValue(null);
    const res = await req("sim-unknown", "&format=docx");
    expect(res.status).toBe(404);
  });

  test("returns 404 when no report sections", async () => {
    mockGetReportSections.mockResolvedValue([]);
    const res = await req("sim-abcd1234-0000", "&format=docx");
    expect(res.status).toBe(404);
  });
});
