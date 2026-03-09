import { describe, test, expect, mock } from "bun:test";

// Mock the db client before importing the service
mock.module("../../../src/db/client", () => ({
  query: mock(),
  getPool: mock(),
  getClient: mock(),
  closePool: mock(),
}));

mock.module("../../../src/utils/logger", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

import { computeAcceptanceMatrix } from "../../../src/services/matrixService";
import { query } from "../../../src/db/client";

const mockQuery = query as ReturnType<typeof mock>;

describe("matrixService", () => {
  test("returns matrix with groups, branches, and cells", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          branch_id: "branch-a",
          content: "I support this policy initiative",
          metadata: { stakeholder_group: "citizens" },
        },
        {
          branch_id: "branch-a",
          content: "I oppose this regulation strongly",
          metadata: { stakeholder_group: "business" },
        },
        {
          branch_id: "branch-b",
          content: "This seems reasonable to consider",
          metadata: { stakeholder_group: "citizens" },
        },
        {
          branch_id: "branch-a",
          content: "We agree with the proposal",
          metadata: { stakeholder_group: "business" },
        },
      ],
    });

    const matrix = await computeAcceptanceMatrix("sim-123");

    expect(matrix.simulation_id).toBe("sim-123");
    expect(matrix.groups).toEqual(["business", "citizens"]);
    expect(matrix.branches).toEqual(["branch-a", "branch-b"]);
    expect(matrix.cells.length).toBeGreaterThan(0);
    expect(matrix.generated_at).toBeDefined();

    // citizens / branch-a: 1 positive -> score 100
    const citizenA = matrix.cells.find(
      (c) => c.stakeholder_group === "citizens" && c.branch_label === "branch-a"
    );
    expect(citizenA).toBeDefined();
    expect(citizenA!.acceptance_score).toBe(100);
    expect(citizenA!.sentiment).toBe("positive");
    expect(citizenA!.sample_size).toBe(1);

    // business / branch-a: 1 negative + 1 positive -> score 50
    const businessA = matrix.cells.find(
      (c) => c.stakeholder_group === "business" && c.branch_label === "branch-a"
    );
    expect(businessA).toBeDefined();
    expect(businessA!.acceptance_score).toBe(50);
    expect(businessA!.sentiment).toBe("neutral");
    expect(businessA!.sample_size).toBe(2);

    // citizens / branch-b: 1 neutral -> score 50
    const citizenB = matrix.cells.find(
      (c) => c.stakeholder_group === "citizens" && c.branch_label === "branch-b"
    );
    expect(citizenB).toBeDefined();
    expect(citizenB!.acceptance_score).toBe(50);
    expect(citizenB!.sample_size).toBe(1);
  });

  test("handles null content and missing metadata gracefully", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          branch_id: null,
          content: null,
          metadata: {},
        },
        {
          branch_id: null,
          content: null,
          metadata: { stakeholder_group: null },
        },
      ],
    });

    const matrix = await computeAcceptanceMatrix("sim-456");

    expect(matrix.simulation_id).toBe("sim-456");
    expect(matrix.groups).toBeDefined();
    expect(matrix.branches).toContain("main");
    expect(matrix.cells.length).toBeGreaterThan(0);

    // Both events should be neutral (null content), scored at 50
    for (const cell of matrix.cells) {
      expect(cell.acceptance_score).toBe(50);
    }
  });

  test("returns empty matrix when no events exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const matrix = await computeAcceptanceMatrix("sim-empty");

    expect(matrix.simulation_id).toBe("sim-empty");
    expect(matrix.groups).toEqual([]);
    expect(matrix.branches).toEqual([]);
    expect(matrix.cells).toEqual([]);
  });
});
