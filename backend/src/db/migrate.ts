import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { query, getClient } from "./client";
import { logger } from "../utils/logger";

const MIGRATIONS_DIR = join(import.meta.dir, "migrations");

export async function runMigrations(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`);
  const applied = await query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version");
  const appliedSet = new Set(applied.rows.map((r) => r.version));
  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

  const client = await getClient();
  try {
    for (const file of sqlFiles) {
      if (appliedSet.has(file)) continue;
      logger.info({ migration: file }, "Applying migration");
      const sql = await Bun.file(join(MIGRATIONS_DIR, file)).text();
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        logger.info({ migration: file }, "Migration applied");
      } catch (err) { await client.query("ROLLBACK"); throw err; }
    }
  } finally { client.release(); }
}

if (import.meta.main) {
  runMigrations().then(() => { logger.info("All migrations applied"); process.exit(0); }).catch((err) => { logger.error({ err }, "Migration failed"); process.exit(1); });
}
