import { query } from "../client";

export interface AgentRow {
  id: string;
  simulation_id: string;
  name: string;
  persona: string;
  demographics: Record<string, unknown>;
  memory: Record<string, unknown>[];
}

export async function getAgentsBySimulation(simulationId: string) {
  const result = await query<AgentRow>(
    `SELECT id, simulation_id, name, persona, demographics, memory
     FROM agent_profiles WHERE simulation_id = $1`,
    [simulationId]
  );
  return result.rows;
}

export async function getAgentById(id: string) {
  const result = await query<AgentRow>(
    `SELECT * FROM agent_profiles WHERE id = $1`, [id]
  );
  return result.rows[0] || null;
}
