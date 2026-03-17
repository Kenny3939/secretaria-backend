import fs from 'node:fs';
import path from 'node:path';
import pool from './database';

type MigrationRow = { id: string; applied_at: string };

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function listApplied(): Promise<Set<string>> {
  const r = await pool.query<MigrationRow>('SELECT id FROM _migrations ORDER BY applied_at ASC');
  return new Set(r.rows.map((x) => x.id));
}

export async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await listApplied();
  const dir = path.resolve(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const file of files) {
    if (applied.has(file)) continue;
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log(`🧱 Applying migration ${file}...`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (id) VALUES ($1)', [file]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error(`❌ Migration failed: ${file}`);
      throw e;
    }
  }
}

