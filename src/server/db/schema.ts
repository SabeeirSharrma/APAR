import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Stage 2 persistence. API keys live in plaintext for now — spec defers
 * encryption to stage 10; SQLite file permissions are the boundary until then.
 */
export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(), // crypto.randomUUID() — opaque from day one
  name: text("name").notNull(),
  criteria: text("criteria").notNull(),
  provider: text("provider", { enum: ["openrouter", "ollama"] }).notNull(),
  openrouterApiKey: text("openrouter_api_key"),
  openrouterModel: text("openrouter_model"),
  ollamaEndpoint: text("ollama_endpoint"),
  ollamaModel: text("ollama_model"),
  verifierModelOverride: text("verifier_model_override"),
  createdAtMs: integer("created_at_ms").notNull(),
  updatedAtMs: integer("updated_at_ms").notNull(),
});

export type PositionRecord = typeof positions.$inferSelect;
export type NewPositionRecord = typeof positions.$inferInsert;
