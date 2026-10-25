import * as SQLite from "expo-sqlite"

export type LocalDb = SQLite.SQLiteDatabase

let instance: LocalDb | null = null

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS outbox_seq_idx ON outbox(seq);
`

/** Opens (once) and migrates the local database. Synchronous: it runs before the first screen renders. */
export function getDb(): LocalDb {
  if (!instance) {
    instance = SQLite.openDatabaseSync("pondus.db")
    instance.execSync(SCHEMA)
  }
  return instance
}

export const kv = {
  get<T>(key: string): T | null {
    const row = getDb().getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?", [key])
    if (!row) return null
    try {
      return JSON.parse(row.value) as T
    } catch {
      return null
    }
  },
  set(key: string, value: unknown) {
    getDb().runSync("INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", [key, JSON.stringify(value), new Date().toISOString()])
  },
  delete(key: string) {
    getDb().runSync("DELETE FROM kv WHERE key = ?", [key])
  },
}

/** Wipe everything local (logout / account deletion). */
export function resetLocalDb() {
  const db = getDb()
  db.execSync("DELETE FROM kv; DELETE FROM outbox;")
}
