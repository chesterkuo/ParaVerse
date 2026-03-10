import { query } from "../db/client";
import { logger } from "../utils/logger";

const ALLOWED_TABLES = new Set(["documents", "agent_profiles", "simulation_events"] as const);
type SearchableTable = "documents" | "agent_profiles" | "simulation_events";

export class VectorService {
  formatVector(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
  }

  async upsertDocument(params: {
    projectId: string; filename: string; content: string;
    chunkIndex: number; embedding: number[]; metadata?: Record<string, unknown>;
  }) {
    const vec = this.formatVector(params.embedding);
    const result = await query(
      `INSERT INTO documents (project_id, filename, content, chunk_index, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5::vector, $6)
       ON CONFLICT (project_id, filename, chunk_index) DO UPDATE SET
         content = EXCLUDED.content, embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata
       RETURNING id`,
      [params.projectId, params.filename, params.content, params.chunkIndex, vec, JSON.stringify(params.metadata || {})]
    );
    return result.rows[0].id as string;
  }

  async similaritySearch(params: {
    table: SearchableTable;
    embedding: number[]; projectId?: string; simulationId?: string;
    limit?: number; threshold?: number;
  }) {
    if (!ALLOWED_TABLES.has(params.table)) {
      throw new Error(`Invalid table: ${params.table}`);
    }

    const vec = this.formatVector(params.embedding);
    const limit = params.limit || 10;
    const threshold = params.threshold || 0.7;

    let whereClause = "";
    const queryParams: unknown[] = [vec, limit];
    let paramIndex = 3;

    if (params.table === "documents" && params.projectId) {
      whereClause = `WHERE project_id = $${paramIndex}`;
      queryParams.push(params.projectId);
      paramIndex++;
    } else if (params.simulationId) {
      whereClause = `WHERE simulation_id = $${paramIndex}`;
      queryParams.push(params.simulationId);
      paramIndex++;
    }

    const result = await query(
      `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
       FROM ${params.table} ${whereClause}
       ORDER BY embedding <=> $1::vector LIMIT $2`,
      queryParams
    );
    return result.rows.filter((r: any) => r.similarity >= threshold);
  }

  async upsertOntologyNode(params: {
    projectId: string; type: string; name: string; description: string;
    embedding: number[]; properties?: Record<string, unknown>;
  }) {
    const vec = this.formatVector(params.embedding);
    const result = await query(
      `INSERT INTO ontology_nodes (project_id, type, name, description, embedding, properties)
       VALUES ($1, $2, $3, $4, $5::vector, $6)
       ON CONFLICT (project_id, name) DO UPDATE SET
         type = EXCLUDED.type, description = EXCLUDED.description, embedding = EXCLUDED.embedding, properties = EXCLUDED.properties
       RETURNING id`,
      [params.projectId, params.type, params.name, params.description, vec, JSON.stringify(params.properties || {})]
    );
    return result.rows[0].id as string;
  }

  async upsertAgentProfile(params: {
    simulationId: string; name: string; persona: string;
    embedding: number[]; demographics: Record<string, unknown>;
  }) {
    const vec = this.formatVector(params.embedding);
    const result = await query(
      `INSERT INTO agent_profiles (simulation_id, name, persona, embedding, demographics)
       VALUES ($1, $2, $3, $4::vector, $5) RETURNING id`,
      [params.simulationId, params.name, params.persona, vec, JSON.stringify(params.demographics)]
    );
    return result.rows[0].id as string;
  }

  async updateAgentMetadata(
    agentId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await query(
      `UPDATE agent_profiles
       SET demographics = demographics || $2::jsonb
       WHERE id = $1`,
      [agentId, JSON.stringify(metadata)]
    );
  }
}

let instance: VectorService | null = null;
export function getVectorService(): VectorService {
  if (!instance) instance = new VectorService();
  return instance;
}
