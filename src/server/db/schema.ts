import { blob, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

// ---------------------------------------------------------------------------
// Stage 3 — accounts, sessions, pools, applications, results
// ---------------------------------------------------------------------------

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    role: text("role", { enum: ["admin", "interviewer"] }).notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(), // lowercased
    passwordHash: text("password_hash").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAtMs: integer("created_at_ms").notNull(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;

/** Token is stored as sha256 hex; the raw token lives only in the cookie. */
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAtMs: integer("created_at_ms").notNull(),
  expiresAtMs: integer("expires_at_ms").notNull(),
});

export type SessionRecord = typeof sessions.$inferSelect;

export const positionPool = sqliteTable(
  "position_pool",
  {
    positionId: text("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    interviewerId: text("interviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("position_pool_pair_unique").on(t.positionId, t.interviewerId)],
);

export type PositionPoolRecord = typeof positionPool.$inferSelect;

/**
 * status "queued" = no active pool member existed at submission (stuck);
 * "assigned" = auto-assigned to the least-loaded pool interviewer.
 * criteriaSnapshot keeps the review interpretable if the position changes later.
 */
export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  positionId: text("position_id")
    .notNull()
    .references(() => positions.id, { onDelete: "restrict" }),
  applicantFilename: text("applicant_filename").notNull(),
  resumePdf: blob("resume_pdf", { mode: "buffer" }).notNull(),
  resumeText: text("resume_text").notNull(),
  criteriaSnapshot: text("criteria_snapshot").notNull(),
  status: text("status", { enum: ["queued", "assigned"] }).notNull(),
  assignedUserId: text("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  assignedAtMs: integer("assigned_at_ms"),
  viewedAtMs: integer("viewed_at_ms"),
  createdAtMs: integer("created_at_ms").notNull(),
});

export type ApplicationRecord = typeof applications.$inferSelect;
export type NewApplicationRecord = typeof applications.$inferInsert;

/** One-to-one with applications; separate table so stage 10 can encrypt it. */
export const results = sqliteTable("results", {
  applicationId: text("application_id")
    .primaryKey()
    .references(() => applications.id, { onDelete: "cascade" }),
  overallVerdict: text("overall_verdict", {
    enum: ["strong_match", "partial_match", "not_a_match"],
  }).notNull(),
  summary: text("summary").notNull(),
  perCriterionJson: text("per_criterion_json").notNull(),
  strengthsJson: text("strengths_json").notNull(),
  concernsJson: text("concerns_json").notNull(),
  confidence: text("confidence", { enum: ["high", "low"] }).notNull(),
  attempts: integer("attempts").notNull(),
  verificationIssuesJson: text("verification_issues_json").notNull(),
  provider: text("provider", { enum: ["openrouter", "ollama"] }).notNull(),
  mainModel: text("main_model").notNull(),
  verifierModel: text("verifier_model").notNull(),
  durationMs: integer("duration_ms").notNull(),
  resultCreatedAtMs: integer("result_created_at_ms").notNull(),
});

export type ResultRecord = typeof results.$inferSelect;
export type NewResultRecord = typeof results.$inferInsert;
