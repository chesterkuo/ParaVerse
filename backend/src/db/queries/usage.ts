import { query } from "../client";

export interface UsageRow {
  id: string;
  user_id: string;
  resource_type: string;
  simulation_id: string | null;
  metadata: Record<string, unknown> | null;
  consumed_at: string;
}

export async function getMonthlyUsageCount(
  userId: string,
  resourceType: string
): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM usage_records
     WHERE user_id = $1
       AND resource_type = $2
       AND consumed_at >= date_trunc('month', now())`,
    [userId, resourceType]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function recordUsage(
  userId: string,
  resourceType: string,
  simulationId?: string,
  metadata?: Record<string, unknown>
): Promise<UsageRow> {
  const result = await query<UsageRow>(
    `INSERT INTO usage_records (user_id, resource_type, simulation_id, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, resourceType, simulationId ?? null, metadata ? JSON.stringify(metadata) : null]
  );
  return result.rows[0];
}
