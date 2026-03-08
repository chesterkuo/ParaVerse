import { describe, test, expect } from "bun:test";
import { buildReportOutline } from "../../../src/services/reportService";

describe("ReportService", () => {
  test("buildReportOutline for fin_sentiment returns more than 3 sections", () => {
    const outline = buildReportOutline("fin_sentiment");
    expect(outline.length).toBeGreaterThan(3);
    // Should have exactly 5 base sections
    expect(outline.length).toBe(5);
    expect(outline[0].title).toBe("Executive Summary");
    expect(outline[outline.length - 1].title).toBe("Recommendations");
  });

  test("buildReportOutline for crisis_pr includes strategy comparison section", () => {
    const outline = buildReportOutline("crisis_pr");
    // Should have 5 base + 2 crisis sections = 7
    expect(outline.length).toBe(7);

    const titles = outline.map((s) => s.title);
    expect(titles).toContain("Strategy Comparison");
    expect(titles).toContain("Reputation Recovery Curve");

    // Crisis sections should come before Recommendations
    const strategyIdx = titles.indexOf("Strategy Comparison");
    const recommendationsIdx = titles.indexOf("Recommendations");
    expect(strategyIdx).toBeLessThan(recommendationsIdx);
  });
});
