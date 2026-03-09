import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock db client
const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));
mock.module("../../../src/db/client", () => ({
  query: mockQuery,
}));

// Mock llmService
const mockEmbedSingle = mock(() => Promise.resolve([0.1, 0.2, 0.3]));
mock.module("../../../src/services/llmService", () => ({
  getLlmService: () => ({
    embedSingle: mockEmbedSingle,
  }),
}));

// Mock vectorService
mock.module("../../../src/services/vectorService", () => ({
  getVectorService: () => ({
    formatVector: (v: number[]) => `[${v.join(",")}]`,
  }),
}));

// Mock logger
mock.module("../../../src/utils/logger", () => ({
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}));

import {
  hybridSearch,
  textSearch,
  vectorSearch,
  reciprocalRankFusion,
  type SearchResult,
} from "../../../src/services/hybridSearchService";

describe("hybridSearchService", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockEmbedSingle.mockReset();
    mockEmbedSingle.mockImplementation(() => Promise.resolve([0.1, 0.2, 0.3]));
  });

  describe("reciprocalRankFusion", () => {
    test("merges and scores results from both sources", () => {
      const vectorResults: SearchResult[] = [
        { id: "a", content: "alpha", score: 0.95, source: "vector" },
        { id: "b", content: "beta", score: 0.85, source: "vector" },
      ];
      const textResults: SearchResult[] = [
        { id: "b", content: "beta", score: 0.9, source: "text" },
        { id: "c", content: "gamma", score: 0.7, source: "text" },
      ];

      const fused = reciprocalRankFusion(vectorResults, textResults, 0.6);

      // "b" appears in both lists => highest fused score
      expect(fused[0].id).toBe("b");
      expect(fused[0].source).toBe("hybrid");
      expect(fused.length).toBe(3);

      // All results should have source "hybrid"
      for (const r of fused) {
        expect(r.source).toBe("hybrid");
      }
    });

    test("handles empty vector results", () => {
      const textResults: SearchResult[] = [
        { id: "x", content: "text only", score: 1.0, source: "text" },
      ];
      const fused = reciprocalRankFusion([], textResults, 0.6);
      expect(fused.length).toBe(1);
      expect(fused[0].id).toBe("x");
    });

    test("handles empty text results", () => {
      const vectorResults: SearchResult[] = [
        { id: "y", content: "vector only", score: 0.9, source: "vector" },
      ];
      const fused = reciprocalRankFusion(vectorResults, [], 0.6);
      expect(fused.length).toBe(1);
      expect(fused[0].id).toBe("y");
    });

    test("handles both empty", () => {
      const fused = reciprocalRankFusion([], [], 0.6);
      expect(fused.length).toBe(0);
    });
  });

  describe("textSearch", () => {
    test("returns results from full-text search", async () => {
      mockQuery.mockImplementation(() =>
        Promise.resolve({
          rows: [
            { id: "d1", content: "hello world", title: "Doc 1", name: null, rank: "0.5" },
          ],
          rowCount: 1,
        })
      );

      const results = await textSearch({
        queryText: "hello",
        table: "documents",
        projectId: "p1",
        limit: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe("d1");
      expect(results[0].title).toBe("Doc 1");
      expect(results[0].source).toBe("text");
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test("returns empty array when no matches", async () => {
      mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));

      const results = await textSearch({
        queryText: "nonexistent",
        table: "documents",
        projectId: "p1",
        limit: 10,
      });

      expect(results.length).toBe(0);
    });

    test("throws on invalid table", async () => {
      expect(
        textSearch({ queryText: "test", table: "bad_table", projectId: "p1", limit: 10 })
      ).rejects.toThrow("Invalid table");
    });
  });

  describe("vectorSearch", () => {
    test("returns results from vector similarity search", async () => {
      mockQuery.mockImplementation(() =>
        Promise.resolve({
          rows: [
            { id: "d2", content: "vector match", title: "Doc 2", name: null, similarity: "0.92" },
          ],
          rowCount: 1,
        })
      );

      const results = await vectorSearch({
        queryText: "hello",
        table: "documents",
        projectId: "p1",
        limit: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe("d2");
      expect(results[0].score).toBe(0.92);
      expect(results[0].source).toBe("vector");
      expect(mockEmbedSingle).toHaveBeenCalledWith("hello");
    });
  });

  describe("hybridSearch", () => {
    test("hybrid mode returns fused results", async () => {
      let callCount = 0;
      mockQuery.mockImplementation(() => {
        callCount++;
        // First call is vector search, second is text search
        if (callCount === 1) {
          return Promise.resolve({
            rows: [
              { id: "d1", content: "vec result", title: "T1", name: null, similarity: "0.9" },
              { id: "d2", content: "vec result 2", title: "T2", name: null, similarity: "0.8" },
            ],
            rowCount: 2,
          });
        }
        return Promise.resolve({
          rows: [
            { id: "d2", content: "text result 2", title: "T2", name: null, rank: "0.7" },
            { id: "d3", content: "text result 3", title: "T3", name: null, rank: "0.5" },
          ],
          rowCount: 2,
        });
      });

      const results = await hybridSearch({
        query: "test query",
        projectId: "p1",
        table: "documents",
        limit: 10,
        mode: "hybrid",
      });

      // d2 appears in both, should be ranked highest
      expect(results[0].id).toBe("d2");
      expect(results[0].source).toBe("hybrid");
      expect(results.length).toBe(3);
    });

    test("text mode only runs text search", async () => {
      mockQuery.mockImplementation(() =>
        Promise.resolve({
          rows: [{ id: "t1", content: "text", title: null, name: null, rank: "0.5" }],
          rowCount: 1,
        })
      );

      const results = await hybridSearch({
        query: "test",
        projectId: "p1",
        table: "documents",
        mode: "text",
      });

      expect(results.length).toBe(1);
      expect(results[0].source).toBe("text");
      // embedSingle should NOT have been called
      expect(mockEmbedSingle).not.toHaveBeenCalled();
    });

    test("vector mode only runs vector search", async () => {
      mockQuery.mockImplementation(() =>
        Promise.resolve({
          rows: [{ id: "v1", content: "vec", title: null, name: null, similarity: "0.88" }],
          rowCount: 1,
        })
      );

      const results = await hybridSearch({
        query: "test",
        projectId: "p1",
        table: "documents",
        mode: "vector",
      });

      expect(results.length).toBe(1);
      expect(results[0].source).toBe("vector");
      expect(mockEmbedSingle).toHaveBeenCalledTimes(1);
    });

    test("returns empty for no matches", async () => {
      mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));

      const results = await hybridSearch({
        query: "nothing",
        projectId: "p1",
        table: "documents",
        mode: "hybrid",
      });

      expect(results.length).toBe(0);
    });

    test("throws on invalid table", async () => {
      expect(
        hybridSearch({ query: "test", projectId: "p1", table: "invalid" as any })
      ).rejects.toThrow("Invalid table");
    });

    test("defaults to limit=10 and mode=hybrid", async () => {
      mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));

      await hybridSearch({ query: "test", projectId: "p1", table: "documents" });

      // Should have called query twice (vector + text) for hybrid mode
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });
});
