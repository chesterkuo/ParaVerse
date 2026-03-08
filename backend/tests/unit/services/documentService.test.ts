import { describe, test, expect } from "bun:test";

describe("DocumentService", () => {
  test("extractText returns plain text from buffer", async () => {
    // Dynamically import to avoid pdf-parse ESM issues in test env
    const { DocumentService } = await import("../../../src/services/documentService");
    const service = new DocumentService();
    const buffer = Buffer.from("Hello world");
    const result = await service.extractText(buffer, "test.txt");
    expect(result).toBe("Hello world");
  });

  test("extractText detects file type by extension", async () => {
    const { DocumentService } = await import("../../../src/services/documentService");
    const service = new DocumentService();
    const buffer = Buffer.from("plain text content");
    const result = await service.extractText(buffer, "report.txt");
    expect(result).toBe("plain text content");
  });
});
