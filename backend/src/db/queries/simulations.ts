import { query } from "../client";

export interface SimulationRow {
  id: string;
  project_id: string;
  engine: string;
  status: string;
  config: Record<string, unknown>;
  checkpoint_path: string | null;
  grounded_vars: Record<string, number>;
  stats: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export async function createSimulation(params: {
  projectId: string;
  engine: string;
  config: Record<string, unknown>;
}): Promise<SimulationRow> {
  const result = await query<SimulationRow>(
    `INSERT INTO simulations (project_id, engine, status, config, grounded_vars, stats)
     VALUES ($1, $2, 'pending', $3, '{}', '{}')
     RETURNING *`,
    [params.projectId, params.engine, JSON.stringify(params.config)]
  );
  return result.rows[0];
}

export async function updateSimulation(
  id: string,
  updates: Partial<Pick<SimulationRow, "status" | "checkpoint_path" | "grounded_vars" | "stats" | "started_at" | "completed_at">>
): Promise<SimulationRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.checkpoint_path !== undefined) {
    setClauses.push(`checkpoint_path = $${paramIndex++}`);
    values.push(updates.checkpoint_path);
  }
  if (updates.grounded_vars !== undefined) {
    setClauses.push(`grounded_vars = $${paramIndex++}`);
    values.push(JSON.stringify(updates.grounded_vars));
  }
  if (updates.stats !== undefined) {
    setClauses.push(`stats = $${paramIndex++}`);
    values.push(JSON.stringify(updates.stats));
  }
  if (updates.started_at !== undefined) {
    setClauses.push(`started_at = $${paramIndex++}`);
    values.push(updates.started_at);
  }
  if (updates.completed_at !== undefined) {
    setClauses.push(`completed_at = $${paramIndex++}`);
    values.push(updates.completed_at);
  }

  if (setClauses.length === 0) return null;

  values.push(id);
  const result = await query<SimulationRow>(
    `UPDATE simulations SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function getSimulation(id: string): Promise<SimulationRow | null> {
  const result = await query<SimulationRow>(
    `SELECT * FROM simulations WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getSimulationForOwner(
  id: string,
  ownerId: string
): Promise<SimulationRow | null> {
  const result = await query<SimulationRow>(
    `SELECT s.* FROM simulations s
     JOIN projects p ON s.project_id = p.id
     WHERE s.id = $1 AND p.owner_id = $2`,
    [id, ownerId]
  );
  return result.rows[0] || null;
}

export async function getSimulationsByProject(projectId: string): Promise<SimulationRow[]> {
  const result = await query<SimulationRow>(
    `SELECT * FROM simulations WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  );
  return result.rows;
}

export interface SimulationEventRow {
  id: number;
  simulation_id: string;
  branch_id: string | null;
  agent_id: string | null;
  event_type: string;
  platform: string | null;
  content: string | null;
  sim_timestamp: number;
  metadata: Record<string, unknown>;
}

export async function getSimulationEvents(
  simulationId: string,
  opts?: { limit?: number; offset?: number; eventType?: string }
): Promise<SimulationEventRow[]> {
  const params: unknown[] = [simulationId];
  let whereClause = "WHERE simulation_id = $1";
  let paramIndex = 2;

  if (opts?.eventType) {
    whereClause += ` AND event_type = $${paramIndex++}`;
    params.push(opts.eventType);
  }

  const limit = opts?.limit || 1000;
  const offset = opts?.offset || 0;
  params.push(limit, offset);

  const result = await query<SimulationEventRow>(
    `SELECT * FROM simulation_events ${whereClause}
     ORDER BY sim_timestamp ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  );
  return result.rows;
}

export async function insertSimulationEvent(params: {
  simulationId: string;
  eventType: string;
  agentId?: string | null;
  branchId?: string | null;
  platform?: string | null;
  content?: string | null;
  simTimestamp?: number;
  metadata?: Record<string, unknown>;
}): Promise<SimulationEventRow> {
  const result = await query<SimulationEventRow>(
    `INSERT INTO simulation_events
       (simulation_id, event_type, agent_id, branch_id, platform, content, sim_timestamp, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.simulationId,
      params.eventType,
      params.agentId ?? null,
      params.branchId ?? null,
      params.platform ?? null,
      params.content ?? null,
      params.simTimestamp ?? 0,
      JSON.stringify(params.metadata ?? {}),
    ]
  );
  return result.rows[0];
}
