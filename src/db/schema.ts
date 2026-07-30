// APAR Database Schema (§7)
// SQLite table definitions using better-sqlite3

export const SCHEMA_SQL = `
-- ============================================================================
-- Core / Identity
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_round_based INTEGER NOT NULL DEFAULT 0,
  round_count INTEGER NOT NULL DEFAULT 0,
  submission_email TEXT NOT NULL,
  theme_style TEXT NOT NULL DEFAULT 'light',
  primary_color TEXT,
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS company_admins (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, email)
);

CREATE TABLE IF NOT EXISTS interviewers (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, email)
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Many-to-many: Interviewers ↔ Positions
CREATE TABLE IF NOT EXISTS interviewer_positions (
  interviewer_id TEXT NOT NULL REFERENCES interviewers(id) ON DELETE CASCADE,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (interviewer_id, position_id)
);

-- ============================================================================
-- Rounds (§12)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  round_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, round_number)
);

-- Many-to-many: Interviewers ↔ Rounds
CREATE TABLE IF NOT EXISTS interviewer_rounds (
  interviewer_id TEXT NOT NULL REFERENCES interviewers(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (interviewer_id, round_id)
);

-- ============================================================================
-- Interview Flow
-- ============================================================================

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY NOT NULL,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  resume_path TEXT NOT NULL,
  resume_base64 TEXT,
  supplementary_info TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued','processing','verifying','delivered','approved','rejected')),
  current_round_id TEXT REFERENCES rounds(id) ON DELETE SET NULL,
  assigned_interviewer_id TEXT REFERENCES interviewers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_position ON applications(position_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_interviewer ON applications(assigned_interviewer_id);
CREATE INDEX IF NOT EXISTS idx_applications_round ON applications(current_round_id);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL,
  low_confidence INTEGER NOT NULL DEFAULT 0,
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Tags (§11)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  scope TEXT NOT NULL CHECK(scope IN ('global','local')),
  created_by_interviewer_id TEXT REFERENCES interviewers(id) ON DELETE SET NULL,
  is_approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tags_company ON tags(company_id);
CREATE INDEX IF NOT EXISTS idx_tags_scope ON tags(scope);

-- Many-to-many: Applications ↔ Tags
CREATE TABLE IF NOT EXISTS applicant_tags (
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (application_id, tag_id)
);

-- ============================================================================
-- Notes & Recordings
-- ============================================================================

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interviewer_id TEXT NOT NULL REFERENCES interviewers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_application ON notes(application_id);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interviewer_id TEXT NOT NULL REFERENCES interviewers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('screen-video','screen-audio','mic')),
  storage_reference TEXT NOT NULL,
  duration INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recordings_application ON recordings(application_id);

-- ============================================================================
-- Communications (§13)
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK(sender_type IN ('interviewer','applicant')),
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_application ON messages(application_id);

-- Chat messages (§16, optional opt-in feature)
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES interviewers(id) ON DELETE CASCADE,
  recipient_id TEXT,
  channel TEXT,
  encrypted_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_company ON chat_messages(company_id);

-- ============================================================================
-- Configuration / Infrastructure
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_provider_configs (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('main','verification')),
  provider TEXT NOT NULL CHECK(provider IN ('openrouter','openai-compatible')),
  endpoint_url TEXT,
  api_key TEXT,
  model_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, role)
);

CREATE TABLE IF NOT EXISTS database_configs (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  backend TEXT NOT NULL CHECK(backend IN ('sqlite','redis','supabase','firebase','mongodb','custom')),
  connection_string TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Relay config (§9.2, optional)
CREATE TABLE IF NOT EXISTS relay_configs (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  company_slug TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK(tier IN ('shared','own-worker','none')),
  auth_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Branch sub-records for multi-branch relay (§9.2)
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY NOT NULL,
  relay_config_id TEXT NOT NULL REFERENCES relay_configs(id) ON DELETE CASCADE,
  branch_slug TEXT NOT NULL,
  database_config_id TEXT REFERENCES database_configs(id) ON DELETE SET NULL,
  shared_database_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(relay_config_id, branch_slug)
);

-- Client soft-lock artifact (§9.1)
CREATE TABLE IF NOT EXISTS client_soft_lock_artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  interviewer_id TEXT NOT NULL UNIQUE REFERENCES interviewers(id) ON DELETE CASCADE,
  encrypted_config TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feature toggles (§15)
CREATE TABLE IF NOT EXISTS feature_toggles (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK(feature IN ('recording','interviewer-chat','interviewer-analytics','background-checks')),
  is_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, feature)
);

-- ============================================================================
-- Setup State
-- ============================================================================

CREATE TABLE IF NOT EXISTS setup_state (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  step_database INTEGER NOT NULL DEFAULT 0,
  step_branding INTEGER NOT NULL DEFAULT 0,
  step_model_provider INTEGER NOT NULL DEFAULT 0,
  step_interviewers INTEGER NOT NULL DEFAULT 0,
  is_complete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
