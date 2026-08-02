import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA_SQL } from './schema.js';

// ============================================================================
// Database Connection (§9.1 — SQLite default)
// ============================================================================
// DB is lazy — only created on first actual query. Server starts clean
// without any DB file. Health, docs, and info endpoints work without DB.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../apar.db');

let db: Database.Database | null = null;

/**
 * Get or create the SQLite database connection.
 * Creates the file and runs schema on first access.
 */
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DEFAULT_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.exec(SCHEMA_SQL);
    console.log('✅ Database initialized');
  }
  return db;
}

/**
 * Check if the database has been initialized (without creating it).
 */
export function isDbReady(): boolean {
  return db !== null;
}

/**
 * Initialize the database schema (run on startup if needed).
 * Now a no-op — schema runs lazily on first getDb() call.
 * Kept for backward compatibility.
 */
export function initDb(): Database.Database {
  return getDb();
}

/**
 * Close the database connection gracefully.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('🔒 Database connection closed');
  }
}

// ============================================================================
// Type-safe query helpers
// ============================================================================

/**
 * Get a prepared statement that returns a single row.
 */
export function getOne<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>,
): T | undefined {
  const database = getDb();
  return database.prepare(sql).get(params ?? {}) as T | undefined;
}

/**
 * Get a prepared statement that returns multiple rows.
 */
export function getMany<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>,
): T[] {
  const database = getDb();
  return database.prepare(sql).all(params ?? {}) as T[];
}

/**
 * Run an insert/update/delete statement and return info.
 */
export function run(
  sql: string,
  params?: Record<string, unknown>,
): Database.RunResult {
  const database = getDb();
  return database.prepare(sql).run(params ?? {});
}

/**
 * Run multiple statements in a transaction.
 */
export function transaction<T>(fn: () => T): T {
  const database = getDb();
  const txn = database.transaction(fn);
  return txn();
}

// ============================================================================
// Graceful shutdown
// ============================================================================

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
