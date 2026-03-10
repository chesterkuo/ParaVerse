/// <reference lib="webworker" />

/**
 * Bun Worker for parallel embedding of document chunks.
 * Receives text batches, calls LLM embed API, returns embeddings.
 */

declare var self: Worker;

interface WorkerMessage {
  type: "embed_batch";
  texts: string[];
  batchIndex: number;
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
}

interface WorkerResult {
  type: "batch_result" | "batch_error";
  embeddings?: number[][];
  batchIndex: number;
  error?: string;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { texts, batchIndex, apiConfig } = event.data;

  try {
    const embeddings: number[][] = [];

    // Process texts sequentially within this worker (avoid rate limiting)
    for (const text of texts) {
      const response = await fetch(`${apiConfig.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const json = await response.json() as any;
      embeddings.push(json.data[0].embedding);
    }

    const result: WorkerResult = { type: "batch_result", embeddings, batchIndex };
    self.postMessage(result);
  } catch (err: any) {
    const result: WorkerResult = { type: "batch_error", batchIndex, error: err.message };
    self.postMessage(result);
  }
};
