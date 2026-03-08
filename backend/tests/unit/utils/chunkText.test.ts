import { describe, test, expect } from "bun:test";
import { chunkText } from "../../../src/utils/chunkText";

describe("chunkText", () => {
  test("splits text into chunks", () => {
    const text = "word ".repeat(1000).trim();
    const chunks = chunkText(text, { chunkSize: 100, overlap: 10 });
    expect(chunks.length).toBeGreaterThan(1);
  });
  test("returns single chunk for short text", () => {
    const chunks = chunkText("Hello world", { chunkSize: 100, overlap: 10 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("Hello world");
  });
  test("handles empty text", () => {
    expect(chunkText("", { chunkSize: 100, overlap: 10 })).toHaveLength(0);
  });
});
