import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;


async function ensureColumnExists(
  database: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string
): Promise<void> {
  const columns = await database.getAllAsync(`PRAGMA table_info(${tableName})`) as Array<{ name?: string }>;
  const hasColumn = columns.some(column => column.name === columnName);
  if (!hasColumn) {
    await database.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

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
      source_captured_at TEXT,
      source_metadata TEXT,

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

    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      suburb TEXT NOT NULL,
      state TEXT NOT NULL,
      postcode TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS other_parties (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT,
      phone TEXT,
      address TEXT,
      suburb TEXT,
      state TEXT,
      postcode TEXT,
      relationship TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      lives_with_user INTEGER NOT NULL DEFAULT 1,
      custody_arrangement TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS legislation (
      id TEXT PRIMARY KEY NOT NULL,
      jurisdiction TEXT NOT NULL,
      title TEXT NOT NULL,
      short_title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('dv_protection', 'family_law', 'criminal', 'child_protection')),
      description TEXT NOT NULL,
      url TEXT NOT NULL,
      full_text_url TEXT,
      last_amended TEXT,
      version_date TEXT,
      content_hash TEXT,
      key_provisions TEXT NOT NULL DEFAULT '[]',
      last_checked TEXT NOT NULL,
      attribution TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS legislation_update_log (
      id TEXT PRIMARY KEY NOT NULL,
      legislation_id TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK(change_type IN ('version_change', 'hash_mismatch', 'new_amendment', 'rss_update', 'no_change')),
      previous_hash TEXT,
      new_hash TEXT,
      previous_version_date TEXT,
      new_version_date TEXT,
      source_url TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (legislation_id) REFERENCES legislation(id)
    );

    CREATE TABLE IF NOT EXISTS legislation_updates (
      id TEXT PRIMARY KEY NOT NULL,
      legislation_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      effective_date TEXT,
      source_url TEXT NOT NULL,
      published_at TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (legislation_id) REFERENCES legislation(id)
    );

    CREATE TABLE IF NOT EXISTS court_feed (
      id TEXT PRIMARY KEY NOT NULL,
      court TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('practice_direction', 'media_release', 'judgment', 'notice', 'legislative_update')),
      published_at TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
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
    CREATE INDEX IF NOT EXISTS idx_other_parties_user ON other_parties(user_id);
    CREATE INDEX IF NOT EXISTS idx_children_user ON children(user_id);
    CREATE INDEX IF NOT EXISTS idx_legislation_jurisdiction ON legislation(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_legislation_category ON legislation(category);
    CREATE INDEX IF NOT EXISTS idx_legislation_updates_legislation ON legislation_updates(legislation_id);
    CREATE INDEX IF NOT EXISTS idx_court_feed_jurisdiction ON court_feed(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_court_feed_published ON court_feed(published_at);
    CREATE INDEX IF NOT EXISTS idx_legislation_update_log_legislation ON legislation_update_log(legislation_id);
    CREATE INDEX IF NOT EXISTS idx_legislation_update_log_timestamp ON legislation_update_log(timestamp);
  `);

  await ensureColumnExists(database, 'evidence', 'source_captured_at', 'TEXT');
  await ensureColumnExists(database, 'evidence', 'source_metadata', 'TEXT');
}
