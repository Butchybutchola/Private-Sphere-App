import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('evidence_guardian.db');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('photo', 'video', 'audio', 'document')),
      status TEXT NOT NULL DEFAULT 'locked' CHECK(status IN ('locked', 'pending', 'archived')),
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      sha256_hash TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,

      captured_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      altitude REAL,
      location_accuracy REAL,

      title TEXT,
      description TEXT,
      tags TEXT DEFAULT '[]',
      court_order_id TEXT,
      breach_clause TEXT,

      transcription TEXT,
      transcription_status TEXT DEFAULT NULL,

      parent_id TEXT,
      is_original INTEGER NOT NULL DEFAULT 1,
      version_number INTEGER NOT NULL DEFAULT 1,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (parent_id) REFERENCES evidence(id),
      FOREIGN KEY (court_order_id) REFERENCES court_orders(id)
    );

    CREATE TABLE IF NOT EXISTS court_orders (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      sha256_hash TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS court_order_clauses (
      id TEXT PRIMARY KEY NOT NULL,
      court_order_id TEXT NOT NULL,
      clause_number TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (court_order_id) REFERENCES court_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS breach_logs (
      id TEXT PRIMARY KEY NOT NULL,
      evidence_id TEXT NOT NULL,
      court_order_id TEXT NOT NULL,
      clause_id TEXT NOT NULL,
      description TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (evidence_id) REFERENCES evidence(id),
      FOREIGN KEY (court_order_id) REFERENCES court_orders(id),
      FOREIGN KEY (clause_id) REFERENCES court_order_clauses(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'local_user',
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      metadata TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      evidence_ids TEXT NOT NULL DEFAULT '[]',
      court_order_id TEXT,
      file_path TEXT NOT NULL,
      sha256_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(type);
    CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);
    CREATE INDEX IF NOT EXISTS idx_evidence_captured_at ON evidence(captured_at);
    CREATE INDEX IF NOT EXISTS idx_evidence_court_order ON evidence(court_order_id);
    CREATE INDEX IF NOT EXISTS idx_breach_logs_evidence ON breach_logs(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_breach_logs_court_order ON breach_logs(court_order_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
  `);
}
