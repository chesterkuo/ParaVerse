import { describe, expect, test } from "bun:test";
import { distributionSimilarity } from "../src/services/backtestService";

describe("distributionSimilarity", () => {
  test("identical distributions return 1.0", () => {
    const dist = { positive: 0.5, neutral: 0.3, negative: 0.2 };
    expect(distributionSimilarity(dist, dist)).toBeCloseTo(1.0, 10);
  });

  test("opposite distributions return 0", () => {
    const a = { positive: 1, neutral: 0, negative: 0 };
    const b = { positive: 0, neutral: 0, negative: 1 };
    expect(distributionSimilarity(a, b)).toBe(0);
  });

  test("similar distributions return >0.99", () => {
    const a = { positive: 0.5, neutral: 0.3, negative: 0.2 };
    const b = { positive: 0.48, neutral: 0.32, negative: 0.2 };
    expect(distributionSimilarity(a, b)).toBeGreaterThan(0.99);
  });

  test("zero vector returns 0", () => {
    const zero = { positive: 0, neutral: 0, negative: 0 };
    const other = { positive: 0.5, neutral: 0.3, negative: 0.2 };
    expect(distributionSimilarity(zero, other)).toBe(0);
    expect(distributionSimilarity(other, zero)).toBe(0);
  });

  test("both zero vectors return 0", () => {
    const zero = { positive: 0, neutral: 0, negative: 0 };
    expect(distributionSimilarity(zero, zero)).toBe(0);
  });
});
