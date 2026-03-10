import { join } from "path";
import { chunkText } from "../utils/chunkText";
import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { logger } from "../utils/logger";

const PDF_SCRIPT = join(import.meta.dir, "../../scripts/pdf_extract.py");
const PDF_PYTHON = process.env.PDF_PYTHON || "python3";

const PARALLEL_THRESHOLD = 10;
const WORKER_COUNT = 4;

/**
 * Embed chunks in parallel using Bun Worker threads.
 * Splits chunks across WORKER_COUNT workers, each calling the embedding API.
 * Returns a Map of chunkIndex -> embedding vector.
 */
async function embedChunksParallel(
  chunks: string[]
): Promise<number[][]> {
  const perWorker = Math.ceil(chunks.length / WORKER_COUNT);
  const batchResults: { batchIndex: number; embeddings: number[][] }[] = [];
  const promises: Promise<void>[] = [];

  for (let w = 0; w < WORKER_COUNT; w++) {
    const workerChunks = chunks.slice(w * perWorker, (w + 1) * perWorker);
    if (workerChunks.length === 0) continue;

    const worker = new Worker(new URL("../workers/embeddingWorker.ts", import.meta.url));

    promises.push(
      new Promise<void>((resolve, reject) => {
        worker.onmessage = (evt: MessageEvent) => {
          const data = evt.data;
          if (data.type === "batch_result" && data.embeddings) {
            batchResults.push({ batchIndex: data.batchIndex, embeddings: data.embeddings });
          }
          worker.terminate();
          if (data.type === "batch_error") {
            reject(new Error(data.error));
          } else {
            resolve();
          }
        };
        worker.onerror = (err) => {
          worker.terminate();
          reject(err);
        };
      })
    );

    worker.postMessage({
      type: "embed_batch",
      texts: workerChunks,
      batchIndex: w,
      apiConfig: {
        baseUrl: process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: process.env.LLM_API_KEY || "",
        model: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
      },
    });
  }

  await Promise.all(promises);

  // Merge results in batch order
  batchResults.sort((a, b) => a.batchIndex - b.batchIndex);
  return batchResults.flatMap((r) => r.embeddings);
}

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

    if (chunks.length > PARALLEL_THRESHOLD) {
      // Parallel path: use Bun Workers for large chunk sets
      logger.info({ chunkCount: chunks.length, workerCount: WORKER_COUNT }, "Using parallel embedding workers");
      const allEmbeddings = await embedChunksParallel(chunks);

      for (let i = 0; i < chunks.length; i++) {
        const docId = await this.vectors.upsertDocument({
          projectId, filename, content: chunks[i],
          chunkIndex: i, embedding: allEmbeddings[i],
        });
        documentIds.push(docId);
        onProgress?.(Math.round(((i + 1) / chunks.length) * 100));
      }
    } else {
      // Sequential fallback for small chunk sets
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
    }

    return { chunkCount: chunks.length, documentIds };
  }
}

let instance: DocumentService | null = null;
export function getDocumentService(): DocumentService {
  if (!instance) instance = new DocumentService();
  return instance;
}
