import { chunkText } from "../utils/chunkText";
import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { logger } from "../utils/logger";

export class DocumentService {
  private get llm() { return getLlmService(); }
  private get vectors() { return getVectorService(); }

  async extractText(buffer: Buffer, filename: string): Promise<string> {
    if (filename.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      return result.text;
    }
    return buffer.toString("utf-8");
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
