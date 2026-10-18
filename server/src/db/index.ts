import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function dataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  return join(here, '..', '..', 'data');
}

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(join(dir, 'chesstutor.sqlite'));
  db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  ensureProfile(db);
  return db;
}

/** Manual transaction helper (node:sqlite has no built-in). */
export function transaction<T>(database: DatabaseSync, fn: () => T): T {
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (e) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw e;
  }
}

const SCHEMA_VERSION = 1;

function migrate(database: DatabaseSync): void {
  database.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  const row = database.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  const current = row ? parseInt(row.value, 10) : 0;
  if (current < 1) {
    const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
    database.exec(sql);
    database.exec(`INSERT INTO meta (key, value) VALUES ('schema_version', '1')
         ON CONFLICT(key) DO UPDATE SET value = '1'`);
  }
  if (current > SCHEMA_VERSION) {
    throw new Error(`Database schema version ${current} is newer than supported ${SCHEMA_VERSION}`);
  }
}

function ensureProfile(database: DatabaseSync): void {
  const row = database.prepare(`SELECT id FROM profile WHERE id = 1`).get();
  if (!row) {
    database.prepare(`INSERT INTO profile (id, display_name, created_at) VALUES (1, 'Player', ?)`).run(new Date().toISOString());
  }
}

/** Idempotent: safe to call on every startup. */
export function tableEmpty(database: DatabaseSync, table: string): boolean {
  const row = database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n === 0;
}

export function isNewDatabase(): boolean {
  return !existsSync(join(dataDir(), 'chesstutor.sqlite'));
}
