import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { query } from "../db/client";
import { logger } from "../utils/logger";

export interface OntologyEntity {
  type: "person" | "org" | "event" | "concept" | "location";
  name: string;
  description: string;
  properties?: Record<string, unknown>;
}

export interface OntologyRelation {
  source: string; target: string; type: string; weight: number;
}

export interface OntologyResult {
  entities: OntologyEntity[];
  relations: OntologyRelation[];
}

export function parseOntologyResponse(raw: { entities: OntologyEntity[]; relations: OntologyRelation[] }): OntologyResult {
  return { entities: raw.entities || [], relations: raw.relations || [] };
}

export const ONTOLOGY_PROMPT = `You are an expert knowledge graph builder. Analyze the following text and extract:
1. **Entities**: people, organizations, events, concepts, and locations mentioned.
2. **Relations**: how these entities are connected.

Return JSON:
{"entities": [{"type": "person|org|event|concept|location", "name": "...", "description": "..."}],
 "relations": [{"source": "entity name", "target": "entity name", "type": "relation_type", "weight": 0.0-1.0}]}

Extract only clearly stated facts. Do not infer or hallucinate entities.`;

export class GraphService {
  private get llm() { return getLlmService(); }
  private get vectors() { return getVectorService(); }

  async extractOntology(projectId: string, chunks: string[], onProgress?: (progress: number) => void): Promise<{ nodeCount: number; edgeCount: number }> {
    const allEntities: Map<string, OntologyEntity> = new Map();
    const allRelations: OntologyRelation[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const response = await this.llm.chatJson<{ entities: OntologyEntity[]; relations: OntologyRelation[] }>(
        [{ role: "system", content: ONTOLOGY_PROMPT }, { role: "user", content: chunks[i] }],
        { tier: "boost" }
      );
      const parsed = parseOntologyResponse(response);
      for (const entity of parsed.entities) {
        if (!allEntities.has(entity.name)) allEntities.set(entity.name, entity);
      }
      allRelations.push(...parsed.relations);
      onProgress?.(Math.round(((i + 1) / chunks.length) * 100));
    }

    const entityNameToId: Map<string, string> = new Map();
    for (const entity of allEntities.values()) {
      const embedding = await this.llm.embedSingle(`${entity.name}: ${entity.description}`);
      const nodeId = await this.vectors.upsertOntologyNode({
        projectId, type: entity.type, name: entity.name,
        description: entity.description, embedding, properties: entity.properties,
      });
      entityNameToId.set(entity.name, nodeId);
    }

    let edgeCount = 0;
    for (const rel of allRelations) {
      const sourceId = entityNameToId.get(rel.source);
      const targetId = entityNameToId.get(rel.target);
      if (sourceId && targetId) {
        await query(
          `INSERT INTO ontology_edges (source_node_id, target_node_id, relation_type, weight) VALUES ($1, $2, $3, $4)`,
          [sourceId, targetId, rel.type, rel.weight]
        );
        edgeCount++;
      }
    }
    logger.info({ projectId, nodes: allEntities.size, edges: edgeCount }, "Ontology extracted");
    return { nodeCount: allEntities.size, edgeCount };
  }

  async getGraph(projectId: string) {
    const nodes = await query(`SELECT id, type, name, description, properties FROM ontology_nodes WHERE project_id = $1`, [projectId]);
    const edges = await query(
      `SELECT e.id, e.source_node_id, e.target_node_id, e.relation_type, e.weight
       FROM ontology_edges e JOIN ontology_nodes n ON e.source_node_id = n.id WHERE n.project_id = $1`, [projectId]
    );
    return { nodes: nodes.rows, edges: edges.rows };
  }

  async searchGraph(projectId: string, queryText: string, limit = 10) {
    const embedding = await this.llm.embedSingle(queryText);
    const nodes = await query(
      `SELECT id, type, name, description, properties, 1 - (embedding <=> $1::vector) AS similarity
       FROM ontology_nodes WHERE project_id = $2
       ORDER BY embedding <=> $1::vector LIMIT $3`,
      [new VectorService().formatVector(embedding), projectId, limit]
    );
    return nodes.rows;
  }
}

let instance: GraphService | null = null;
export function getGraphService(): GraphService {
  if (!instance) instance = new GraphService();
  return instance;
}
