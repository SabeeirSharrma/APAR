import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(path.join(DATA_DIR, "apar.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

/** Applies pending SQL migrations from ./drizzle. Call once at boot. */
export function runMigrations(): void {
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
}
