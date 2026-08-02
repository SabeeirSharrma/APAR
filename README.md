# APAR — AI Powered Applicant Review

A self-hosted web service that automates first-pass eligibility review of job applicants using AI. Companies bring their own API keys (OpenRouter, OpenAI, etc.) or run local models via Ollama.

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd APAR
npm install

# Run in development (hot reload)
npm run dev

# Or build and run in production
npm run build
npm start
```

The server starts on `http://localhost:3000` by default.

**First time?** Open `http://localhost:3000/admin.html` to register your company and walk through the setup wizard.

## What It Does

1. **Applicants apply** via a public form (`/apply.html`) — upload resume + supplementary info
2. **AI analyzes** the resume against position criteria using your configured model provider
3. **Verification pass** runs a second model to confirm the analysis
4. **Results are encrypted** with per-interviewer keys and stored locally
5. **Admins review** candidates in the admin panel, approve/reject with one click
6. **Interviewers see** their assigned applicants with decrypted analysis

## Pages

| Page | URL | Purpose |
| ------ | ----- | --------- |
| Admin Panel | `/admin.html` | Manage positions, interviewers, applicants, features |
| Interviewer Dashboard | `/interviewer.html` | View assigned applicants, send messages |
| Apply | `/apply.html` | Public applicant submission form |
| Status Check | `/status.html` | Public application status lookup |
| API Docs | `/docs` | Interactive Swagger UI |
| Health | `/health` | Server status (JSON) |

## API

Full API documentation is available at `/docs` (Swagger UI) or `/docs.json` (OpenAPI 3.0 spec).

### Key Endpoints

```md
POST   /api/v1/auth/register       Register a new company
POST   /api/v1/auth/login          Login (admin or interviewer)
GET    /api/v1/applicants          List applicants (auth required)
POST   /api/v1/applicants/:id/approve   Approve applicant
POST   /api/v1/applicants/:id/reject    Reject applicant
GET    /api/v1/positions           List positions
POST   /api/v1/positions           Create position
GET    /api/v1/interviewers        List interviewers
POST   /api/v1/interviewers        Create interviewer (generates key)
PATCH  /api/v1/features            Toggle feature flags
POST   /api/v1/upload              Upload resume (public, multipart)
GET    /api/v1/status/:id          Check application status (public)
```

## Configuration

Create a `.env` file (or use defaults):

```bash
# Server
PORT=3000

# Company master key (used to encrypt API keys and interviewer keys)
COMPANY_MASTER_KEY=your-strong-random-value-here

# Email (optional — dev mode logs to console)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM=noreply@example.com

# Database (optional — defaults to ./apar.db)
DATABASE_PATH=./apar.db
```

## Architecture

```md
src/
├── index.ts                 # Express server entry point
├── db/
│   ├── index.ts             # Lazy SQLite connection (better-sqlite3)
│   └── schema.ts            # Database schema
├── routes/
│   ├── auth.ts              # Register/login (JWT)
│   ├── applicants.ts        # Applicant CRUD + approve/reject
│   ├── interviewers.ts      # Interviewer CRUD + key management
│   ├── positions.ts         # Position CRUD
│   ├── rounds.ts            # Interview round management
│   ├── upload.ts            # Resume upload (public, triggers pipeline)
│   ├── messages.ts          # Anonymous interviewer↔applicant messaging
│   ├── tags.ts              # Applicant tagging
│   ├── notes.ts             # Internal notes
│   ├── setup.ts             # Setup wizard (5 steps)
│   ├── features.ts          # Feature toggle CRUD
│   ├── customUi.ts          # Custom UI management
│   └── status.ts            # Public status check
├── middleware/
│   ├── auth.ts              # JWT verification + role checking
│   ├── featureToggle.ts     # Feature gate middleware
│   ├── rateLimit.ts         # Rate limiting
│   └── error.ts             # Error handlers
├── lib/
│   ├── pipeline.ts          # AI review pipeline (upload → analyze → encrypt → store)
│   ├── encryption.ts        # AES-256-GCM encryption, key hierarchy
│   ├── transit.ts           # Native module bridge (Rust + Java)
│   ├── email.ts             # Email templates (approval, rejection, notifications)
│   ├── models.ts            # Grade thresholds, scoring logic
│   ├── validation.ts        # Zod schemas for all inputs
│   ├── retryWorker.ts       # Background retry for failed pipelines
│   └── swagger.ts           # OpenAPI 3.0 spec
native/
├── apar-keygen/             # Rust binary — AES-256-GCM key generation
└── apar-java/               # Java Transit modules — crypto + text analysis
public/
├── admin.html               # Admin panel (SPA)
├── interviewer.html         # Interviewer dashboard
├── apply.html               # Applicant submission form
└── status.html              # Public status page
```

## Security Model

- **Encryption at rest**: All API keys stored encrypted with AES-256-GCM using a company master key
- **Per-interviewer keys**: Each interviewer gets a unique encryption key; results are encrypted per-interviewer
- **Admin recovery**: Company master key can decrypt any interviewer's data
- **Anonymous messaging**: Interviewer names are hidden from non-admins
- **JWT auth**: Short-lived tokens with role-based access (`company_admin`, `interviewer`)
- **Rate limiting**: Applied to API endpoints, separate limits for auth and upload
- **Lazy DB**: Server starts without a database; DB is created on first query

## Native Modules

APAR optionally uses native code for performance:

| Module | Language | Purpose |
| -------- | ---------- | --------- |
| `apar-keygen` | Rust | AES-256-GCM key generation, encrypt/decrypt |
| `CryptoModule` | Java/Transit | Persistent encryption process |
| `TextAnalysisModule` | Java/Transit | Word/token/pattern analysis |

If native modules aren't available, Node.js crypto is used as fallback. The Rust binary and Java modules are optional — the system works fully without them.

## Tech Stack

- **Runtime**: Node.js 20+ (ESM)
- **Framework**: Express 5 + TypeScript
- **Database**: SQLite via better-sqlite3 (lazy init, WAL mode)
- **Auth**: JWT (bcryptjs + jsonwebtoken)
- **Validation**: Zod
- **Build**: tsup (single ESM bundle)
- **AI**: OpenAI-compatible client (OpenRouter, Ollama, etc.)
- **Native**: Rust (keygen binary), Java (Transit bridge)

## Development

```bash
npm run dev          # Start with hot reload (tsx watch)
npm run build        # Build production bundle
npm run start        # Run production build
npm run typecheck    # Type check without emitting
npm run test         # Run tests (vitest)
```

## License

PolyForm Noncommercial License 1.0.0
