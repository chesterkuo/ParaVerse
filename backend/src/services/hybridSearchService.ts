import { query } from "../db/client";
import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { logger } from "../utils/logger";

export interface SearchResult {
  id: string;
  title?: string;
  content: string;
  score: number;
  source: "vector" | "text" | "hybrid";
}

export interface HybridSearchParams {
  query: string;
  projectId: string;
  table: "documents" | "simulation_events" | "ontology_nodes";
  limit?: number;
  mode?: "hybrid" | "vector" | "text";
  vectorWeight?: number;
}

const ALLOWED_TABLES = new Set(["documents", "simulation_events", "ontology_nodes"]);
const RRF_K = 60;

/** Column config per table */
function getTableConfig(table: string) {
  switch (table) {
    case "documents":
      return { contentCol: "content", titleCol: "filename", filterCol: "project_id", nameCol: null };
    case "simulation_events":
      return { contentCol: "content", titleCol: null, filterCol: "simulation_id", nameCol: null };
    case "ontology_nodes":
      return { contentCol: "description", titleCol: null, filterCol: "project_id", nameCol: "name" };
    default:
      throw new Error(`Unsupported table: ${table}`);
  }
}

/** Full-text search using tsvector + GIN index */
async function textSearch(params: {
  queryText: string;
  table: string;
  projectId: string;
  limit: number;
}): Promise<SearchResult[]> {
  if (!ALLOWED_TABLES.has(params.table)) throw new Error(`Invalid table: ${params.table}`);

  const config = getTableConfig(params.table);
  const selectCols = [
    "id",
    config.contentCol + " AS content",
    config.titleCol ? `${config.titleCol} AS title` : "NULL AS title",
    config.nameCol ? `${config.nameCol} AS name` : "NULL AS name",
  ].join(", ");

  const sql = `
    SELECT ${selectCols},
           ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank
    FROM ${params.table}
    WHERE search_vector @@ plainto_tsquery('english', $1)
      AND ${config.filterCol} = $2
    ORDER BY rank DESC
    LIMIT $3
  `;

  const result = await query(sql, [params.queryText, params.projectId, params.limit]);

  return result.rows.map((row: any) => ({
    id: row.id,
    title: row.title || row.name || undefined,
    content: row.content,
    score: parseFloat(row.rank),
    source: "text" as const,
  }));
}

/** Vector similarity search using pgvector cosine distance */
async function vectorSearch(params: {
  queryText: string;
  table: string;
  projectId: string;
  limit: number;
}): Promise<SearchResult[]> {
  if (!ALLOWED_TABLES.has(params.table)) throw new Error(`Invalid table: ${params.table}`);

  const llm = getLlmService();
  const embedding = await llm.embedSingle(params.queryText);
  const vec = getVectorService().formatVector(embedding);

  const config = getTableConfig(params.table);
  const selectCols = [
    "id",
    config.contentCol + " AS content",
    config.titleCol ? `${config.titleCol} AS title` : "NULL AS title",
    config.nameCol ? `${config.nameCol} AS name` : "NULL AS name",
  ].join(", ");

  const sql = `
    SELECT ${selectCols},
           1 - (embedding <=> $1::vector) AS similarity
    FROM ${params.table}
    WHERE embedding IS NOT NULL
      AND ${config.filterCol} = $2
    ORDER BY embedding <=> $1::vector
    LIMIT $3
  `;

  const result = await query(sql, [vec, params.projectId, params.limit]);

  return result.rows.map((row: any) => ({
    id: row.id,
    title: row.title || row.name || undefined,
    content: row.content,
    score: parseFloat(row.similarity),
    source: "vector" as const,
  }));
}

/** Reciprocal Rank Fusion: merge two ranked lists by ID */
function reciprocalRankFusion(
  vectorResults: SearchResult[],
  textResults: SearchResult[],
  vectorWeight: number,
): SearchResult[] {
  const textWeight = 1 - vectorWeight;
  const fused = new Map<string, SearchResult & { fusedScore: number }>();

  vectorResults.forEach((r, rank) => {
    const rrfScore = vectorWeight / (RRF_K + rank + 1);
    fused.set(r.id, { ...r, source: "hybrid", fusedScore: rrfScore });
  });

  textResults.forEach((r, rank) => {
    const rrfScore = textWeight / (RRF_K + rank + 1);
    const existing = fused.get(r.id);
    if (existing) {
      existing.fusedScore += rrfScore;
      // Keep the richer content (prefer the one with a title if any)
      if (!existing.title && r.title) existing.title = r.title;
    } else {
      fused.set(r.id, { ...r, source: "hybrid", fusedScore: rrfScore });
    }
  });

  return Array.from(fused.values())
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .map(({ fusedScore, ...rest }) => ({ ...rest, score: fusedScore }));
}

/** Main hybrid search function */
export async function hybridSearch(params: HybridSearchParams): Promise<SearchResult[]> {
  const {
    query: queryText,
    projectId,
    table,
    limit = 10,
    mode = "hybrid",
    vectorWeight = 0.6,
  } = params;

  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid table: ${table}`);
  }

  logger.debug({ queryText, table, mode, limit }, "hybridSearch");

  if (mode === "text") {
    return textSearch({ queryText, table, projectId, limit });
  }

  if (mode === "vector") {
    return vectorSearch({ queryText, table, projectId, limit });
  }

  // Hybrid: run both in parallel, fuse with RRF
  const fetchLimit = limit * 2; // fetch more to allow better fusion
  const [vecResults, txtResults] = await Promise.all([
    vectorSearch({ queryText, table, projectId, limit: fetchLimit }),
    textSearch({ queryText, table, projectId, limit: fetchLimit }),
  ]);

  const fused = reciprocalRankFusion(vecResults, txtResults, vectorWeight);
  return fused.slice(0, limit);
}

// Also export internals for testing
export { textSearch, vectorSearch, reciprocalRankFusion };
