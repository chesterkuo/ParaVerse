import { describe, it, expect } from "bun:test";

describe("Embedding batch processing", () => {
  it("should split chunks into batches of correct size", () => {
    const chunks = Array.from({ length: 55 }, (_, i) => `chunk-${i}`);
    const batchSize = 20;
    const batches: string[][] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize));
    }
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(20);
    expect(batches[1]).toHaveLength(20);
    expect(batches[2]).toHaveLength(15);
  });

  it("should merge batch results in correct order", () => {
    const batchResults = [
      [[0.1, 0.2], [0.3, 0.4]],
      [[0.5, 0.6]],
    ];
    const merged = batchResults.flat();
    expect(merged).toHaveLength(3);
    expect(merged[0]).toEqual([0.1, 0.2]);
    expect(merged[2]).toEqual([0.5, 0.6]);
  });

  it("should handle empty input", () => {
    const chunks: string[] = [];
    const batchSize = 20;
    const batches: string[][] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize));
    }
    expect(batches).toHaveLength(0);
  });
});
