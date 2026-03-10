import { query } from "../client";

export interface BacktestRow {
  id: string;
  project_id: string;
  simulation_id: string | null;
  owner_id: string;
  name: string;
  historical_context: Record<string, unknown>;
  predicted_distribution: Record<string, number> | null;
  accuracy_score: number | null;
  status: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function createBacktest(params: {
  projectId: string;
  ownerId: string;
  name: string;
  historicalContext: Record<string, unknown>;
}): Promise<BacktestRow> {
  const result = await query<BacktestRow>(
    `INSERT INTO backtests (project_id, owner_id, name, historical_context)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.projectId, params.ownerId, params.name, JSON.stringify(params.historicalContext)]
  );
  return result.rows[0];
}

export async function updateBacktest(
  id: string,
  updates: Partial<Pick<BacktestRow, "simulation_id" | "predicted_distribution" | "accuracy_score" | "status" | "error" | "completed_at">>
): Promise<BacktestRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (updates.simulation_id !== undefined) {
    sets.push(`simulation_id = $${i++}`);
    params.push(updates.simulation_id);
  }
  if (updates.predicted_distribution !== undefined) {
    sets.push(`predicted_distribution = $${i++}`);
    params.push(JSON.stringify(updates.predicted_distribution));
  }
  if (updates.accuracy_score !== undefined) {
    sets.push(`accuracy_score = $${i++}`);
    params.push(updates.accuracy_score);
  }
  if (updates.status !== undefined) {
    sets.push(`status = $${i++}`);
    params.push(updates.status);
  }
  if (updates.error !== undefined) {
    sets.push(`error = $${i++}`);
    params.push(updates.error);
  }
  if (updates.completed_at !== undefined) {
    sets.push(`completed_at = $${i++}`);
    params.push(updates.completed_at);
  }

  if (sets.length === 0) return null;

  params.push(id);
  const result = await query<BacktestRow>(
    `UPDATE backtests SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

export async function getBacktestsByProject(projectId: string): Promise<BacktestRow[]> {
  const result = await query<BacktestRow>(
    `SELECT * FROM backtests WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  );
  return result.rows;
}

export async function getBacktest(id: string): Promise<BacktestRow | null> {
  const result = await query<BacktestRow>(
    `SELECT * FROM backtests WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
