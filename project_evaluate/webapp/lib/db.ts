import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.EVAL_DB_PATH || path.join(process.cwd(), "data", "eval.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __evalDb: Database.Database | undefined;
}

function createConnection(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      leader TEXT NOT NULL,
      members TEXT NOT NULL,
      topic TEXT NOT NULL,
      self_report_completed TEXT NOT NULL DEFAULT '',
      self_report_plan TEXT NOT NULL DEFAULT '',
      self_report_ai TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','instructor')),
      group_id INTEGER REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluator_id INTEGER NOT NULL REFERENCES users(id),
      group_id INTEGER NOT NULL REFERENCES groups(id),
      item_scores TEXT NOT NULL DEFAULT '{}',
      comment TEXT NOT NULL DEFAULT '',
      submitted INTEGER NOT NULL DEFAULT 0,
      anon_label INTEGER,
      is_locked INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(evaluator_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS aggregated_results (
      group_id INTEGER PRIMARY KEY REFERENCES groups(id),
      per_item_final_score TEXT NOT NULL,
      total_score REAL NOT NULL,
      rank INTEGER,
      trimmed_evaluator_ids TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'FINAL',
      finalized_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!global.__evalDb) {
    global.__evalDb = createConnection();
  }
  return global.__evalDb;
}

export function isClosed(): boolean {
  const row = getDb().prepare("SELECT value FROM app_state WHERE key = 'closed'").get() as
    | { value: string }
    | undefined;
  return row?.value === "1";
}
