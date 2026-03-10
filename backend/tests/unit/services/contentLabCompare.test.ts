import { describe, it, expect } from "bun:test";
import { compareSentimentCurves, computeKeywordOverlap } from "../../../src/services/contentLabCompareService";

describe("ContentLab comparison", () => {
  it("should compute sentiment divergence between two curves", () => {
    const curveA = [0.6, 0.5, 0.4, 0.3];
    const curveB = [0.6, 0.7, 0.8, 0.85];
    const result = compareSentimentCurves(curveA, curveB);
    expect(result.divergenceScore).toBeGreaterThan(0);
    expect(result.winnerIndex).toBe(1);
  });

  it("should handle identical curves", () => {
    const curve = [0.5, 0.5, 0.5];
    const result = compareSentimentCurves(curve, curve);
    expect(result.divergenceScore).toBe(0);
  });

  it("should compute keyword overlap between two keyword sets", () => {
    const kwA = ["exciting", "bold", "controversial"];
    const kwB = ["exciting", "disappointing", "risky"];
    const overlap = computeKeywordOverlap(kwA, kwB);
    expect(overlap.shared).toEqual(["exciting"]);
    expect(overlap.uniqueA).toEqual(["bold", "controversial"]);
    expect(overlap.uniqueB).toEqual(["disappointing", "risky"]);
  });
});
