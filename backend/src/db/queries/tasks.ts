import { query } from "../client";

export interface TaskRow {
  id: string; type: string; reference_id: string; owner_id: string;
  status: string; progress: number; result: Record<string, unknown>;
  error: string | null; created_at: string; updated_at: string;
}

export async function createTask(type: string, referenceId: string, ownerId: string): Promise<TaskRow> {
  const result = await query<TaskRow>(
    `INSERT INTO tasks (type, reference_id, owner_id) VALUES ($1, $2, $3) RETURNING *`,
    [type, referenceId, ownerId]
  );
  return result.rows[0];
}

export async function updateTask(id: string, updates: { status?: string; progress?: number; result?: Record<string, unknown>; error?: string }) {
  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let i = 1;
  if (updates.status !== undefined) { sets.push(`status = $${i++}`); params.push(updates.status); }
  if (updates.progress !== undefined) { sets.push(`progress = $${i++}`); params.push(updates.progress); }
  if (updates.result !== undefined) { sets.push(`result = $${i++}`); params.push(JSON.stringify(updates.result)); }
  if (updates.error !== undefined) { sets.push(`error = $${i++}`); params.push(updates.error); }
  params.push(id);
  await query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i}`, params);
}

export async function getTask(id: string): Promise<TaskRow | null> {
  const result = await query<TaskRow>(`SELECT * FROM tasks WHERE id = $1`, [id]);
  return result.rows[0] || null;
}
