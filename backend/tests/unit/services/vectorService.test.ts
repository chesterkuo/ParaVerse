import { describe, test, expect } from "bun:test";
import { VectorService } from "../../../src/services/vectorService";

describe("VectorService", () => {
  test("formatVector converts array to pgvector string", () => {
    const service = new VectorService();
    expect(service.formatVector([1.0, 2.0, 3.0])).toBe("[1,2,3]");
  });
  test("formatVector handles empty array", () => {
    const service = new VectorService();
    expect(service.formatVector([])).toBe("[]");
  });
});
