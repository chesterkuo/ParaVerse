import pg from "pg";
import { logger } from "../utils/logger";

const { Pool } = pg;
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on("error", (err) => { logger.error({ err }, "Unexpected pool error"); });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;
  logger.debug({ query: text.slice(0, 80), duration, rows: result.rowCount }, "query");
  return result;
}

export async function getClient(): Promise<pg.PoolClient> { return getPool().connect(); }

export async function closePool(): Promise<void> {
  if (pool) { await pool.end(); pool = null; }
}
