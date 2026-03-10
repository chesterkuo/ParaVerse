/**
 * HNSW Recall@10 Benchmark
 *
 * Compares HNSW approximate results against exact brute-force.
 * Usage: cd backend && bun run scripts/benchmark-hnsw.ts
 */
import { query } from "../src/db/client";

const NUM_QUERIES = 20;

async function benchmark() {
  const samples = await query(
    `SELECT id, embedding FROM documents WHERE embedding IS NOT NULL ORDER BY random() LIMIT $1`,
    [NUM_QUERIES]
  );

  if (samples.rows.length === 0) {
    console.log("No documents with embeddings found. Skipping benchmark.");
    process.exit(0);
  }

  let totalRecall = 0;

  for (const sample of samples.rows) {
    const vec = sample.embedding;

    // Exact nearest neighbors (sequential scan)
    const exact = await query(
      `SET LOCAL enable_indexscan = off; SELECT id FROM documents WHERE embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT 10`,
      [vec]
    );

    // HNSW approximate (uses index)
    const approx = await query(
      `SET LOCAL hnsw.ef_search = 100; SELECT id FROM documents WHERE embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT 10`,
      [vec]
    );

    const exactIds = new Set(exact.rows.map((r: any) => r.id));
    const approxIds = approx.rows.map((r: any) => r.id);
    const hits = approxIds.filter((id: string) => exactIds.has(id)).length;
    totalRecall += hits / 10;
  }

  const avgRecall = totalRecall / samples.rows.length;
  console.log(`\nHNSW Recall@10: ${(avgRecall * 100).toFixed(1)}% (target: >=85%)`);
  console.log(`Queries tested: ${samples.rows.length}`);

  if (avgRecall >= 0.85) {
    console.log("PASS: Recall meets target");
  } else {
    console.log("FAIL: Recall below target -- consider increasing m or ef_search");
  }

  process.exit(0);
}

benchmark().catch(console.error);
