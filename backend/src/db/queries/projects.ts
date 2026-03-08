import { query } from "../client";

export interface ProjectRow {
  id: string;
  name: string;
  scenario_type: string;
  owner_id: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export async function createProject(params: {
  name: string;
  scenarioType: string;
  ownerId: string;
  settings?: Record<string, unknown>;
}): Promise<ProjectRow> {
  const result = await query<ProjectRow>(
    `INSERT INTO projects (name, scenario_type, owner_id, settings)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      params.name,
      params.scenarioType,
      params.ownerId,
      JSON.stringify(params.settings || {}),
    ]
  );
  return result.rows[0];
}

export async function getProjectsByOwner(
  ownerId: string,
  opts?: { cursor?: string; limit?: number }
): Promise<{ rows: ProjectRow[]; hasMore: boolean }> {
  const limit = opts?.limit || 20;
  const params: unknown[] = [ownerId, limit + 1];
  let whereClause = "WHERE owner_id = $1";

  if (opts?.cursor) {
    whereClause += ` AND created_at < $3`;
    params.push(opts.cursor);
  }

  const result = await query<ProjectRow>(
    `SELECT * FROM projects ${whereClause}
     ORDER BY created_at DESC
     LIMIT $2`,
    params
  );

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

  return { rows, hasMore };
}

export async function getProject(
  id: string,
  ownerId: string
): Promise<ProjectRow | null> {
  const result = await query<ProjectRow>(
    `SELECT * FROM projects WHERE id = $1 AND owner_id = $2`,
    [id, ownerId]
  );
  return result.rows[0] || null;
}

export async function deleteProject(
  id: string,
  ownerId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM projects WHERE id = $1 AND owner_id = $2`,
    [id, ownerId]
  );
  return (result.rowCount ?? 0) > 0;
}
