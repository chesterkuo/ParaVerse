import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

describe("DocumentService", () => {
  test("extractText returns plain text from buffer", async () => {
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

  test("extractText extracts text from PDF via PyMuPDF", async () => {
    const { DocumentService } = await import("../../../src/services/documentService");
    const service = new DocumentService();
    const pdfPath = join(import.meta.dir, "../../fixtures/test.pdf");
    const buffer = Buffer.from(readFileSync(pdfPath));
    const result = await service.extractText(buffer, "test.pdf");
    expect(result).toContain("ParaVerse test document");
  });
});
