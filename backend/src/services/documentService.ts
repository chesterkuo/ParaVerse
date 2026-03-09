import { join } from "path";
import { chunkText } from "../utils/chunkText";
import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { logger } from "../utils/logger";

const PDF_SCRIPT = join(import.meta.dir, "../../scripts/pdf_extract.py");
const PDF_PYTHON = process.env.PDF_PYTHON || "python3";

export class DocumentService {
  private get llm() { return getLlmService(); }
  private get vectors() { return getVectorService(); }

  async extractText(buffer: Buffer, filename: string): Promise<string> {
    if (filename.toLowerCase().endsWith(".pdf")) {
      return this.extractPdfText(buffer);
    }
    return buffer.toString("utf-8");
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    const proc = Bun.spawn([PDF_PYTHON, PDF_SCRIPT], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    // Write PDF bytes to stdin
    proc.stdin.write(buffer);
    proc.stdin.end();

    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    if (exitCode !== 0) {
      logger.error({ exitCode, stderr: stderr.slice(0, 500) }, "PDF extraction failed");
      throw new Error(`PDF extraction failed: ${stderr.slice(0, 200)}`);
    }

    const result = JSON.parse(stdout) as { text?: string; error?: string; pages?: number };
    if (result.error) {
      throw new Error(`PDF extraction error: ${result.error}`);
    }

    logger.info({ pages: result.pages }, "PDF text extracted via PyMuPDF");
    return result.text ?? "";
  }

  async processDocument(params: {
    projectId: string; filename: string; buffer: Buffer;
    onProgress?: (progress: number) => void;
  }): Promise<{ chunkCount: number; documentIds: string[] }> {
    const { projectId, filename, buffer, onProgress } = params;
    const text = await this.extractText(buffer, filename);
    logger.info({ filename, textLength: text.length }, "Text extracted");
    const chunks = chunkText(text);
    logger.info({ filename, chunkCount: chunks.length }, "Text chunked");

    const documentIds: string[] = [];
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await this.llm.embed(batch);
      for (let j = 0; j < batch.length; j++) {
        const docId = await this.vectors.upsertDocument({
          projectId, filename, content: batch[j],
          chunkIndex: i + j, embedding: embeddings[j],
        });
        documentIds.push(docId);
      }
      onProgress?.(Math.round(((i + batch.length) / chunks.length) * 100));
    }
    return { chunkCount: chunks.length, documentIds };
  }
}

let instance: DocumentService | null = null;
export function getDocumentService(): DocumentService {
  if (!instance) instance = new DocumentService();
  return instance;
}
