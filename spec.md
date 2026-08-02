# APAR — AI Powered Applicant Review

**Status:** Spec (clean-slate rewrite, v1)
**Predecessor:** Original JS-only APAR (March), fully deprecated — no code carried over.

## 1. Overview

APAR is a free, self-hosted-friendly web/API service that automates first-pass eligibility
review of applicants (job candidates, school applicants, etc.) against criteria a company
or institution defines. It produces an advisory verdict, never a final decision — the
assigned human interviewer always makes the actual call.

Free-to-use model: users bring their own OpenRouter API key, **or** run a local
model (e.g. via Ollama) — see §9.3 for the local option and its tradeoffs. Either
way, APAR does not pay for inference and does not proxy/subsidize model costs.

## 2. Core Actors

- **Company / Institution** — creates an account, defines one or more Positions, each
  with its own reusable criteria. Manages an interviewer roster per position.
- **Interviewer** — account provisioned by the company. Assigned to one or more
  positions. Receives auto-assigned candidates and views their decrypted analysis in
  the web GUI.
- **Applicant** — uploads a resume against a specific position. No account required
  (public-facing upload flow, scoped to that position's submission link).

## 3. Scope (v1)

**In scope:**
- Resume upload → automated eligibility analysis → advisory verdict delivered to an
  assigned interviewer.
- Per-position reusable criteria (typed once by the company, applied to every
  applicant for that position).
- Auto-assignment of applicants to interviewers via load-balanced distribution across
  a position's interviewer pool.
- Encrypted storage of analysis results, company-recoverable.

**Out of scope (deferred to v2+):**
- Custom integrations (ATS hooks, school application system hooks, Slack/email
  delivery, webhooks).
- External claim verification (confirming a claimed degree/certification actually
  exists). APAR checks *internal consistency of the AI's output against the stated
  criteria* — it does not fact-check the applicant's claims against outside sources.

## 4. Pipeline (target: ~5 minutes, upload to interviewer visibility)

1. **Upload** — Applicant uploads resume (PDF; may be scanned/image-based) against a
   specific position's public link.
2. **Queue** — Job enters that company's queue, scoped to the specific position.
3. **Auto-assignment** — Load-balancer assigns the applicant to one interviewer from
   the position's interviewer pool, based on **per-position current distribution**
   (evenest-load assignment, not round-robin blind). Load is measured **within
   this position's pool only** — an interviewer's workload on other positions
   they're also assigned to does not factor in. If the company is round-based
   (§12), this naturally narrows further to interviewers assigned to the
   applicant's current round.
   - **Empty pool fallback**: if a position (or the applicant's current round)
     has zero available interviewers, the application is held in queue rather
     than silently dropped or force-assigned, and the company admin should be
     surfaced this state (exact notification mechanism TBD — see open
     questions).
4. **Processor #1 (sender)**
   - Parses resume + any supplementary info provided.
   - Encodes the file as base64 for the main model call. Base64 (not extracted text)
     is used specifically because scanned/image-based PDFs are not reliably
     text-extractable — this lets the model read the document visually/natively
     rather than depending on OCR succeeding upstream.
5. **Main model call** — Sent to the primary model (OpenRouter) with:
   - Fixed system instructions (interviewer persona, task framing, output format
     contract) — identical across all positions/companies.
   - Position-specific criteria, slotted into the prompt template.
   - The base64-encoded resume.
   - Model returns: per-criterion scores (0–100, self-assigned by the model) +
     reasoning text + overall verdict category.
6. **Verification pass** — A smaller, cheaper, text-only model checks the main
   model's output for internal consistency against the criteria (e.g. a
   high score paired with reasoning that describes a disqualifying gap). This is a
   consistency gate on the main model's output, not a second independent analysis and
   not external fact-checking. **On a flagged inconsistency, the result is sent back
   to the main model for a re-run** (not auto-adjusted by the verifier, and not
   silently passed through with a warning label) — the main model re-analyzes and
   produces a fresh result, which goes through verification again.
   - **Re-run cap**: capped at **3 attempts**. If the result still fails
     verification after the 3rd attempt, it is delivered anyway, but prefixed with
     a low-confidence disclaimer (see below) rather than withheld or endlessly
     retried.
7. **Processor #2 (receiver)** — Takes the (possibly flagged/adjusted) result and
   encrypts it before storage.
8. **Storage** — Encrypted result stored, associated with the applicant, position,
   and assigned interviewer.
9. **Delivery** — Assigned interviewer views the decrypted result in the web GUI.
   Only that interviewer (or company admin, per §6) can access it.

## 5. Output Format

Delivered to the interviewer as:

- **Low-confidence disclaimer (conditional)**: if the result never passed
  verification after hitting the re-run cap (§4 step 6), the output is prefixed
  with a disclaimer that this specific output may not be accurate and the
  interviewer should verify against the resume and other materials directly,
  rather than relying on the verdict as-is.
- **Single-line summary**: one of `Meets Criteria` / `Partially Meets Criteria` /
  `Does Not Meet Criteria`, paired with an **overall color grade** (averaged from
  per-criterion grades).
- **Reasoning**: why that verdict was reached, in prose, tied back to the criteria.
- **Per-criterion breakdown**: each criterion the company defined gets its own
  0–100 score, self-assigned by the main model, with its own color grade.

**Color grading** — light mode, solid color bands (no gradient) — flat, corporate
look rather than a smooth spectrum. Score thresholds locked:

| Grade | Score Range | Color Label |
|-------|------------|-------------|
| A | 80–100 | excellent |
| B | 70–80 | good |
| C | 60–70 | average |
| D | 55–60 | below-average |
| F | <55 | poor |

## 6. Encryption & Access Control

**Model: company-recoverable encryption at rest** (not zero-access).

- Analysis results are encrypted before storage (processor #2).
- The assigned interviewer can decrypt and view their assigned candidates' results
  in the web GUI.

**Roles:**

- **Interviewer** — can decrypt/view results for applicants assigned to them.
- **Company Admin** — **standing access** to their own company's data (not
  recovery-only — this was reconsidered from the earlier draft). Manages their own
  company's interviewer roster: add, delete, and reassign interviewers across
  positions. Can view/recover results within their own company at any time, not
  just when something's gone wrong.
  - **Auto-reassignment on delete**: if a company admin deletes an interviewer, all
    of that interviewer's currently-assigned applicants/interviewees are
    automatically reassigned to another interviewer in the same position's pool
    (via the same load-balanced auto-assignment logic used for new applicants —
    §4 step 3), rather than being orphaned.
- **Platform Admin (APAR-level) — SaaS-only, does not exist in self-hosted v1.**
  Under the current self-hosted deployment model (§9), there is no central
  "platform" — each company runs its own isolated instance, so there is nothing
  for a platform admin to have access *to*. This role only becomes meaningful
  **if/when a pure online SaaS version of APAR is built** (not currently on the
  committed roadmap — see §19). In that hypothetical SaaS scenario: platform
  admins would have **override access, gated by explicit company permission** —
  not standing, not default, not silently available. A company would need to grant
  that override capability (e.g. for support purposes) before a platform admin
  could act on their data. Until a SaaS version actually exists, this entire role
  is inapplicable — self-hosted instances have company admins and interviewers
  only.

**Resolved decisions:**
- ✅ **Key hierarchy**: Each interviewer gets a randomly generated 32-byte
  encryption key. Keys stored encrypted with company master key. Admins can
  regenerate (reset) but never define/choose. Results encrypted per-interviewer
  key. Admin recovery via company master key (`decryptResultAsAdmin`).
- **If/when a SaaS version is built**: the exact permission-granting mechanism a
  company would use to authorize platform admin override (explicit toggle, a
  scoped/time-limited grant, per-incident approval, etc.) — deferred until that
  SaaS decision is actually made, not designed prematurely.

## 7. Data Model

Organized by area rather than one flat list, since the entity count has grown a
lot since the original draft. This is still conceptual (entities + key
relationships), not literal schema/DDL — exact column types, indices, etc. are
implementation-time decisions.

**Core / Identity**

- **Company** — account. Owns Positions, Interviewer roster, Company Admins. Has
  branding (name, theme/layout style — §9.1), a round-based flag + round count
  (§12), a single submission/notification email (§13), a DatabaseConfig, and a
  ModelProviderConfig (below).
- **CompanyAdmin** — belongs to a Company. Has **standing access** (§6) to their
  company's data. Manages Interviewers, Positions, tags (global tag
  approval), and setup/config.
- **PlatformAdmin** — **SaaS-only, does not exist under self-hosted deployment**
  (§6). Not part of the self-hosted data model at all; only relevant if a future
  SaaS version is built.
- **Interviewer** — belongs to a Company. Assigned to one or more Positions
  (many-to-many) and, if the company is round-based, one or more Rounds
  (many-to-many — §12). Has an encryption keypair (§6 — public key stored, private
  key held client-side/company-recoverable per the encryption model), a
  ClientSoftLockArtifact (§9.1), and owns any Local/personal Tags (§11).
- **Position** — belongs to a Company. Has reusable criteria (prose-based,
  slotted into the fixed prompt template — not structured/parsed criteria
  fields). Has an Interviewer pool (many-to-many with Interviewer).

**Interview Flow**

- **Applicant / Application** — a resume submission against one Position. Has a
  status (queued → processing → verifying → delivered → approved/rejected), a
  current Round (if the company is round-based — §12), an assigned Interviewer,
  applied Tags (many-to-many), Notes, Recordings, Messages, and one encrypted
  Result.
- **Result** — belongs to an Application. Per-criterion scores + grades
  (criterion, 0–100 score, justification, color grade), overall verdict + overall
  grade, a low-confidence flag (set if verification never passed within the
  3-attempt cap — §4/§5), and a verification-attempt count. Encrypted at rest
  (§6).
- **Round** — belongs to a Company (or Position, if criteria/rounds ever need to
  vary per-position rather than company-wide — open question). Has a round
  number/order and a name. Interviewers are linked to specific Rounds via the
  Interviewer↔Round relationship above.
- **Tag** — either **global** (belongs to a Company, created/approved by a
  Company Admin, usable by all that company's Interviewers) or **local/personal**
  (belongs to a single Interviewer, not synced company-wide). Global tags may
  have a pending/approved status if the request-then-approve flow (§11) is
  modeled as its own state rather than handled purely as a workflow outside the
  data model.
- **Note** — belongs to an Application and the Interviewer who wrote it.
  Freeform text.
- **Recording** — belongs to an Application and the Interviewer who made it. Has
  a type (screen-video / screen-audio / mic), a storage reference, and (once
  decided — open question) a retention policy.

**Communications**

- **Message** — anonymous Applicant↔Interviewer messaging (§10/§13). Belongs to
  an Application, has a sender type (interviewer/applicant), content, and is sent
  via the Company's single submission/notification email address — neither
  party's real address is exposed.
- **ChatMessage** — optional, opt-in (§15/§16). Belongs to a Company. Has a
  sender Interviewer, a recipient (Interviewer or a channel, depending on how
  chat topology is eventually designed), and content — encrypted using the same
  keypair infrastructure as Results (§6), unless the per-company encryption
  toggle (§16, still open) changes that per company.

**Optional / Infra**

- **ModelProviderConfig** — belongs to a Company, one entry each for "main model"
  and "verification model" roles (§9.3). Has a provider type (OpenRouter, or
  OpenAI-compatible endpoint for local/self-hosted models), an endpoint URL (for
  the local case), an API key reference (for OpenRouter), and a model name.
- **DatabaseConfig** — belongs to a Company. Records the chosen backend (SQLite,
  Redis, Supabase, Firebase, MongoDB, or Custom) and connection details (§9.1).
- **RelayConfig** — belongs to a Company, only present if the company opts into
  the relay (§9.2). Records the company-slug, the chosen relay tier
  (shared/own-Worker/none), an auth token reference, and — if multi-branch is
  used — a set of **Branch** sub-records (branch-slug, and either a shared DB
  reference or its own DatabaseConfig, per the still-open branch-structure
  question).
- **ClientSoftLockArtifact** — belongs to an Interviewer. The encrypted config
  file (§9.1) generated by the setup API and bundled with their downloaded
  Flutter client, scoping it to the company's instance/database.
- **FeatureToggle** — belongs to a Company. Records which opt-in features (§15)
  are enabled: recording, interviewer chat, interviewer analytics, background
  checks (once built), etc. Endpoints for a disabled feature aren't hosted at
  all, per §15 — this table/entity is what a company's setup determines those
  toggles from.
- **BackgroundCheckConfig** — v2+/deferred (§14), noted here only so the data
  model has a placeholder shape once it's built: would belong to a Company, with
  a provider type (third-party / AI-based / custom-template) and provider-specific
  config.

## 8. Prompt System

- **Fixed system instructions**: define the AI's role as an interviewer-support tool,
  task framing, and the output format contract (so the response is reliably
  parseable — likely structured/JSON under the hood even though the interviewer
  sees a formatted view).
- **Criteria injection**: Position-specific criteria (free-form prose, written once
  by the company, reused for every applicant to that position) inserted into a fixed
  slot in the template. No hardcoded tiers (e.g. no fixed "Senior = 30 years"
  thresholds baked into the prompt) — criteria are entirely company-defined.
- **Verification model prompt**: separate, smaller text-only model prompt whose job
  is narrowly scoped to consistency-checking the main model's scores/reasoning
  against the same criteria — not re-analyzing the resume from scratch.
- **Strict JSON output** is required from the main model (not prose/emoji-tagged
  output) so the verification pass can programmatically check `criteria_scores`
  against `overall_verdict` rather than parsing free text.

**Draft main model prompt:**

```
You are an interviewer-support assistant for {company_name}. Your task is to analyze
the attached resume and assess the candidate strictly against the criteria below.
Your output is advisory only — a human interviewer makes the final decision.

Position Criteria:
{criteria}

For EACH criterion listed above, provide:
- A score from 0-100 reflecting how well the resume demonstrates that criterion.
- A one-line justification for that score, grounded in specific resume content.

Then provide:
- An overall verdict: "Meets Criteria" / "Partially Meets Criteria" / "Does Not Meet
  Criteria".
- A concise summary of relevant experience, education, and skills.
- A clear closing recommendation for the interviewer.

Respond ONLY in the following JSON structure, no preamble or additional text:
{
  "criteria_scores": [
    { "criterion": "...", "score": 0-100, "justification": "..." }
  ],
  "overall_verdict": "Meets Criteria" | "Partially Meets Criteria" | "Does Not Meet Criteria",
  "summary": "...",
  "recommendation": "..."
}
```

Color grading (per-criterion and overall) is derived deterministically from the
0-100 scores by processor #2 — not assigned by the model itself — so grading
thresholds stay consistent across every response regardless of model phrasing.

## 9. Stack (draft — needs confirmation)

Given the pipeline is I/O-bound (waiting on OpenRouter latency) rather than
CPU-bound, raw processing speed matters less here than in something like SAI or
Wordon. Candidate approach, consistent with the modular-monolith pattern used in
Stampd:

- **Core processor / orchestration** (queue, sender/receiver, encryption): open —
  Rust would fit the "uniform across projects" pattern, but isn't required by the
  workload itself.
- **API gateway**: Express + Multer. Multer handles the incoming resume upload
  (multipart/form-data), Express fronts the API before the job hits processor #1.
  Note: this is Express, not Fastify (Stampd's choice) — a deliberate deviation for
  this project, not an inconsistency to "fix" later.
- **Interviewer client**: client-side desktop application (not a browser-based
  flow) — see §9.1.
- **Company admin interface**: local web UI (see §9.1) — since the deployment is
  self-hosted, this UI talks directly to the local database.
- **Model provider**: OpenRouter (BYOK), **or** a local model via Ollama — see
  §9.3. Same choice applies to both the main model and the verification model,
  independently selectable.

**Deployment model: strictly self-hosted, for now.** APAR v1 is not offered as a
hosted/managed service. Companies run their own instance. This sidesteps a large
amount of complexity that a hosted multi-tenant offering would otherwise force
early — data residency, per-company isolation guarantees, uptime/SLA expectations,
and abuse handling on a service that touches applicants' PII. Revisit hosted
offering only once self-hosted v1 is stable and the operational model (especially
§6 encryption/recovery) has proven out in practice. This mirrors CPAC's stance
(no pre-built binary distribution, self-hosted-first) rather than Stampd's staged
path toward a v4 hosted multi-tenant option — APAR has no committed hosted roadmap
at this time.

### 9.1 Interviewer Client & Setup Wizard

Rather than interviewers accessing everything through a browser, APAR provides a
**client-side desktop application** for interviewer use. Company admins continue to
use a **web UI**, which — since the deployment is self-hosted — can make changes
directly to the local database without needing a separate backend hop.

**Setup flow ("soft-lock"):**

1. **Company registration** — a company registers with their self-hosted APAR
   instance and enters a setup wizard.
2. **Database registration** — during setup, the admin chooses and registers the
   database the instance will use. Supported options for v1:
   - SQLite (local, app-created)
   - Redis
   - Supabase
   - Firebase (online/hosted) — more setup overhead than Supabase (Supabase is
     effectively "give an anon key + RLS exceptions"; Firebase needs more
     configuration), but included since a real share of companies already use it.
   - MongoDB (online/hosted)
   - **Custom** — admin specifies connection details for a database type not in
     the preset list, so the app knows how to contact it. Exact scope of "custom"
     (which protocols/drivers are actually supported vs. just a connection-string
     field) is TBD — see open questions.
3. **Company branding** — admin sets the company name (displayed in the interviewer
   client app) and an app layout/theme style for the client.
4. **Model provider setup** — admin chooses, independently for the main model and
   the verification model:
   - **OpenRouter (cloud, BYOK)** — company registers their OpenRouter API key
     (this is the key that funds every resume analysis run through this instance
     — worth being deliberate about how/where it's stored, see open questions).
   - **Local model (e.g. via Ollama)** — company points APAR at a local model
     endpoint instead of a cloud API key. See §9.3 for the vision-capability
     requirement and infra tradeoffs this introduces.
5. **Interviewer provisioning wizard** — for each interviewer, admins (or the
   interviewer themselves, via an invite) go through a creation wizard that
   provisions their account and issues them the client app, pre-configured/locked
   to that company's instance and database.
6. **Remaining admin setup steps** — not fully defined yet (see open questions;
   candidates: default position/criteria template, data retention policy for
   applicant data, notification preferences).

**Interviewer client framework: Flutter, staged rollout.**

- **Stage 1**: base working version ships with **web UIs only** — the applicant
  submission UI (§18) and admin panel (§18/§9) as already spec'd, **plus an
  interviewer web UI** used as the interim interviewer-facing interface. This
  keeps Stage 1 usable end-to-end (pipeline output actually has somewhere to be
  seen) rather than shipping a backend with no consumer. The interviewer web UI is
  retired once the Flutter client (Stage 2) ships.
- **Stage 2**: dedicated **Flutter interviewer client** — one codebase covering
  Windows, macOS, Linux desktop **and** iPad/Android tablet, resolving the
  cross-platform requirement (this replaces the PyQt decision and the tablet
  conflict flagged in the previous revision of this section — both are now
  resolved by Flutter's single-codebase, multi-platform model).
- **Client independence**: the Flutter app is a genuinely separate client that
  talks to the self-hosted APAR API over the network — it is not a thin wrapper
  bundled with the server. This matters for the soft-lock design (§9.1 still
  applies: the client is scoped to a specific company instance via the encrypted
  config artifact from the setup API) and means the API itself needs to be solid
  and well-documented as a contract, independent of any specific client consuming
  it.
- **Sequencing note**: API quality/design work is prioritized **before** the
  Flutter client is built, not the other way around — a good API-first foundation
  means the client (and any future client, or company-built alternative frontend)
  has something reliable to build against, rather than the client and API
  co-evolving haphazardly.
- **Language note**: Flutter's UI code is written in **Dart**, not Python — this
  is a genuine language switch from the PyQt-era Python assumption, not a
  continuation of it. Worth being clear-eyed about the learning curve this
  introduces.
- **Transit note**: Transit currently bridges JS↔Rust and JS↔Java — it does **not**
  currently support Dart. **Explicitly not extending Transit to Dart right now** —
  API-quality work on APAR's own backend comes first, before introducing a new
  language into the Transit ecosystem. If Dart interop via Transit becomes useful
  later, that's a separate, later decision.

**Soft-lock mechanism**: a **setup API**, run by the self-hosted APAR instance
itself, generates the soft-locked client package server-side (i.e. on the
company's own self-hosted instance, not an Anthropic/third-party server) and hands
it to the client for download during the interviewer provisioning wizard step.
This avoids per-client compilation.

**Soft-lock artifact**: a **config file in APAR's own encrypted format**, generated
by the setup API and bundled with the downloaded client. Because the format is
proprietary/encrypted rather than a plain editable config, an interviewer can't
directly hand-edit it to repoint the client at a different company/instance/database
— the client only knows how to decrypt and trust config files it generated itself
through the setup API flow.

Worth naming plainly since it affects how "locked" this really is: this is a
**soft** lock by design (as named), not a hardware- or license-server-backed hard
lock. It stops casual tampering (editing a JSON/YAML file) but doesn't stop someone
with enough reverse-engineering effort from extracting the format and forging their
own config, since the decryption logic ships inside the client itself. That's
consistent with the project's self-hosted, no-backend-license-server model — just
worth being explicit that "soft-lock" means "not trivially editable," not
"cryptographically impossible to bypass."

### 9.2 Relay / Tunnel Gateway (`apar.qd.je`)

Inspired by playit.gg-style tunneling for self-hosted game servers: rather than
every company handling their own port forwarding to expose their self-hosted
instance publicly (the exact pain point flagged in §19's hosting guidance), APAR
can offer an **optional** centrally-hosted relay at `apar.qd.je` that companies
register with.

- **How it works**: the company's self-hosted instance makes an **outbound**
  connection to the relay — no inbound ports need to be opened on the company's
  network at all, sidestepping the port-forwarding/shared-hosting problem in §19
  entirely rather than working around it via VPS choice. Public requests to
  `apar.qd.je/<company-slug>/<endpoint>` are forwarded over that tunnel to the
  company's own instance, which does all actual processing and holds all actual
  data.
- **URL structure**: `apar.qd.je/<company-slug>/<endpoint>` — company-slug
  uniquely identifies the company, reserved at registration (first-come,
  first-served — needs a squatting-prevention/reservation mechanism, see open
  questions).
- **Auth**: since this exposes what would otherwise be a local-only instance,
  every relayed request needs an API key/token. The relay itself should reject
  unauthenticated requests before they're ever forwarded to the company's
  instance — the relay is a gate, not just a dumb pipe.
- **Multi-branch support**: a company with multiple physical branches could
  either (a) share one main DB across branches, all reachable under the same
  company-slug/instance, or (b) run separate sub-instances per branch, each with
  its own DB, reachable under nested paths (e.g.
  `apar.qd.je/<company-slug>/<branch-slug>/<endpoint>`). Whether "branch" becomes
  a first-class concept in the data model (§7) or is just a routing convention on
  top of separate instances — TBD.
- **What this is, named plainly**: a reverse tunnel/relay service — the same
  category as ngrok, Cloudflare Tunnel, or playit.gg — not a hosted SaaS. The
  relay never touches decrypted data or does any processing; it only forwards
  traffic to the company's own self-hosted instance. This is meaningfully
  different from the hypothetical "pure online SaaS" discussed in §6 — that
  scenario would mean APAR hosting the actual compute/data; this is purely a
  networking convenience layer, and the company's instance + database stay
  entirely self-hosted and outside APAR's infrastructure either way.
- **Real infra commitment, worth naming honestly**: unlike the rest of APAR's
  self-hosted model, this relay does require running and maintaining something
  centrally — the relay/tunnel server itself, its uptime, the `qd.je` subdomain,
  and the company-slug registry — even though it never sees plaintext data. This
  is a small, real operational commitment, not a zero-ops feature, and worth
  weighing against the "strictly self-hosted, no committed hosted roadmap"
  stance in §9/§19 (this doesn't violate that stance — data/compute stays fully
  self-hosted — but it does mean *something* runs centrally under Sabeeir's
  control).
- **Hosting for the relay**: split across three pieces, matching how the
  different needs actually map to different infra. (Vercel and InfinityFree-class
  shared hosting were considered and ruled out for the relay piece specifically —
  Vercel's serverless functions aren't built for persistent connections either,
  and InfinityFree-class shared hosting is rate-limited/slow in a way that's fine
  for static content or rarely-updated APIs but not for something holding
  real-time connections open.) —
  - **GitHub Pages** — static landing/marketing site for `apar.qd.je` (the
    non-relay, human-facing part), consistent with how other portfolio/Cinder
    sites are hosted.
  - **Supabase** — company-slug registry, relay auth tokens, and other
    structured relay metadata (consistent access pattern with how Supabase is
    used elsewhere as a lightweight backing store).
  - **Cloudflare Worker + Durable Objects (WebSocket)** — the actual tunnel
    mechanism. Important distinction: a **plain Cloudflare Worker alone cannot
    hold a persistent connection** from a company's self-hosted instance —
    Workers are stateless, request/response. **Durable Objects with WebSocket
    support** are what actually make this work edge-natively: each company gets
    a Durable Object instance that holds the open connection from their
    self-hosted instance, and public requests to
    `apar.qd.je/<company-slug>/<endpoint>` get routed to that company's Durable
    Object, which forwards them over the held connection. This avoids needing a
    dedicated VPS for the relay (revising the earlier draft of this section,
    which assumed a VPS was required the way FileFlare's relay mode uses one —
    Durable Objects are a genuine edge-native alternative for this specific
    use case, worth using instead given it fits the existing GH Pages/Supabase/
    Cloudflare Worker stack already in play here).

**Relay tiers — three options, not one mandatory path:**

1. **Shared relay (`apar.qd.je`-hosted)** — the default, lowest-effort option.
   Company registers a slug and connects to APAR's own shared Worker +
   Durable Object setup (§9.2 hosting, above). Capacity is shared across every
   company using this tier, so it's the most convenient but potentially the
   slowest under load from other companies sharing the same relay.
2. **Own Worker (self-hosted relay infra)** — company runs their **own**
   Cloudflare Worker + Durable Object under their own Cloudflare account,
   dedicated entirely to them. Faster and fully private (no shared capacity with
   other companies), at the cost of the company needing to set this up
   themselves. APAR would need to document how to stand this up (likely a
   template Worker script, similar in spirit to the background-check custom
   integration template in §14) and how it gets referenced/routed —
   still worth deciding whether this still lives under `apar.qd.je/<slug>/...`
   (pointing at their Worker) or resolves to a domain the company controls
   entirely.
3. **No relay at all** — companies self-hosting purely within their own private
   network, never exposing anything to `apar.qd.je`, need **none** of this
   infrastructure — no Worker, no Durable Object, no Supabase registry entry.
   The entire relay system (all of §9.2) is opt-in and irrelevant to them; this
   was always implied by "self-hosted by default" but worth stating explicitly
   now that the relay has three concrete shapes instead of one.

This keeps the relay itself modular in the same spirit as the feature opt-in
system in §15 — nothing about the relay is assumed or required for APAR to
function.

### 9.3 Local / Self-Hosted AI Provider Support

Alongside OpenRouter (cloud, BYOK), companies can point APAR at a **locally-run
model** instead — e.g. via Ollama, or another local inference runtime serving a
model like Gemma. Selectable independently for the main model and the
verification model (§4 steps 5-6), so a company could, for example, run a local
model for verification (cheap, fast, doesn't need to be very capable) while still
using OpenRouter for the main analysis, or run both locally, or both on
OpenRouter — whatever combination fits their resources.

**Integration contract: OpenAI-compatible endpoint**, not an Ollama-specific
integration. Ollama (and most other local runtimes — LM Studio, llama.cpp
server, vLLM, etc.) already expose an OpenAI-compatible API surface, so building
against that shared contract covers all of them with the same integration work,
rather than writing Ollama-specific glue that would need to be duplicated for
every other runtime. Admins point APAR at any endpoint speaking that contract,
local or otherwise.

**Vision-capability requirement — real constraint, not optional.** The pipeline's
base64-encoded resume approach (§4 step 4) was specifically chosen so the main
model can read scanned/image-based PDFs natively, without depending on OCR
succeeding upstream. This only works if the model actually **has vision
capability**. Not every model available via Ollama does — a company selecting a
local text-only model would silently lose the ability to correctly process
scanned resumes (the model would receive a base64 blob it can't actually
interpret visually). This needs to be surfaced clearly in the setup wizard (e.g.
flagging which locally-available models are vision-capable, or requiring
confirmation), not left as a silent failure mode. Whether APAR maintains a
known-good list of vision-capable local models (Gemma 3's multimodal variants,
LLaVA, Qwen-VL, etc.) or just documents the requirement and trusts the admin to
pick correctly — TBD, see open questions.

**Infra tradeoff, worth being explicit about.** OpenRouter's BYOK model means
zero infrastructure burden on the company beyond an API key — this is part of why
APAR's resource footprint is pitched as light (§19/§20). Running models locally
flips that: the company now needs to provision and maintain real compute (GPU,
typically) capable of running inference at whatever volume their applicant flow
requires. This is a legitimate option for companies that want to avoid any
external API dependency or per-call cost, but it's not a free lunch relative to
OpenRouter — it trades API cost for infrastructure cost and operational
complexity, and should be presented to admins as a real tradeoff during setup,
not just "the free option."

## 10. Interviewer Client — Core Features

Design principle stated explicitly: **feature-packed, not bloated.** The bar for
inclusion is "features companies/interviewers will actually use," not "every
feature seen in bloated commercial interview-management apps." Reference point: the
apps that inspired the opt-in system below reportedly balloon to 1GB+ despite most
users only touching a handful of features.

**Always-on core (v1 essentials):**

- **Applicant dashboard** — the interviewer's view of everyone assigned to them:
  who's pending AI review, who has a completed review, filterable/sortable.
- **Score-as-percentage** — the 0-100 per-criterion and overall scores (§5) are
  additionally surfaced as a percentage in the client UI (0-100 already reads as a
  percentage numerically, but this is about explicit percentage framing/display in
  the interviewer-facing UI, not a separate calculation).
- **Tagging system** — see §11.
- **Notes** — interviewer can attach freeform notes to an applicant.
- **Approve / Reject actions** — one-click decision recorded against the applicant,
  which triggers the automated email flow (§13).
- **Anonymous applicant messaging** — interviewer can message an applicant through
  the app without either party seeing the other's real email address; routed
  through the company's single submission/notification email (§13). This was
  explicitly named as one of the few features actually used from prior
  interview-app experience.

**Recording (v1, opt-in per-session):**

- **Screen recording** (video) or **screen audio-only** recording, for remote/
  online interviews.
- **Microphone/voice recording**, for physical in-person interviews.
- Recording is a session-level choice the interviewer makes, not something forced
  on by default — consent/legal considerations around recording candidates are the
  company's responsibility to handle (consent language, local law compliance), not
  something APAR enforces or advises on.

## 11. Tag System

- **Always-on** (per §10) — not part of the opt-in feature toggle system (§15).
- **Two scopes:**
  - **Global tags** — created/approved by company admins, visible/usable by all
    interviewers at that company. An interviewer who wants a new tag added
    globally sends a **request to admins through the client app**; admins approve
    or decline.
  - **Local/personal tags** — an interviewer can create a tag for their own use
    only, without going through the admin approval flow. Saved with that
    interviewer's data, not synced company-wide. (Example given: an interviewer
    wants a tag like "possible liability" for their own filtering, without
    needing every interviewer at the company to have access to it.)
- **Use case**: filtering/sorting the applicant dashboard by tag, in addition to
  round (§12) and review status.

## 12. Round-Based Interviews

- **Admin-configured during setup**: is this company's interview process
  round-based? If yes, how many rounds (n)?
- **Interviewer-to-round assignment**: when admins add/manage interviewers, they
  specify which round(s) each interviewer participates in — a single round only,
  or all rounds 1 through n.
- **Applicant progression**: applicants move through rounds (e.g. round 1 online →
  N advance to round 2 physical → fewer advance to round 3), tracked per-applicant.
  Exact mechanics of "advancing" an applicant to the next round (manual
  interviewer/admin action vs. some automated trigger) — TBD, see open questions.
- Tags (§11) and round status both function as dashboard filters for interviewers.

## 13. Communications & Email

- **Single company submission/notification email** — one address, registered by
  admins during setup, used for:
  - Applicants submitting applications and receiving application instructions.
  - Applicants receiving their outcome (approved/rejected).
  - Anonymous interviewer↔applicant messaging (§10) — interviewers never see the
    applicant's real address and vice versa; the app relays through this single
    address.
- **Approve/Reject flow**: one click from the interviewer client (§10) triggers:
  - A template (rejection or approval) with applicant/position details
    auto-filled.
  - For approvals: **automated inclusion of next-step details** — interview
    time/date/round name/location, not just a bare "you're approved" message —
    where that information is available (e.g. next round already scheduled).
  - The email is sent from the single company address (above), not from any
    individual interviewer's account.
- **Encryption**: not required for outbound email content itself — the sending
  service (e.g. Resend, the company's own email provider) and the applicant's own
  email client (Gmail, Proton, etc.) each handle whatever encryption they handle;
  APAR does not need to layer its own encryption on top of email transport.
- **Two-way email**: some outcome/messaging emails may warrant a reply from the
  applicant (e.g. confirming an interview time). Handling replies back into the
  app is explicitly **not yet designed** — noted as a real gap, not a solved
  problem (see open questions).

## 14. Background Checks (v2+ / deferred)

Not in v1 scope — noted here because it surfaces a real product-philosophy
decision worth deciding early, even if implementation is deferred.

**Planned options (later version):**
- Third-party background-check service integrations (may require contractual
  agreements with those providers).
- An **AI-based background check** option — less accurate than a real background
  check service, but keeps everything under the company's single API key setup
  and avoids APAR needing to integrate/contract with every third-party provider.
- A **custom integration template** — APAR gives companies a template/spec for
  wiring up their own background-check API (in-house or a provider APAR doesn't
  natively support), so they aren't limited to whatever APAR has pre-built.

**Open philosophical question, explicitly flagged rather than resolved:** should
background-check results feed into the AI's eligibility analysis/verdict, or stay
entirely separate and visible only to the human interviewer? The concern raised:
folding more decision-relevant data into the AI's output pushes APAR further
toward *being* the decision-maker rather than an advisor to one — some companies
would readily lean on that to reduce human interviewer headcount, which runs
against the stated design philosophy in §1 ("advisory only, never the final
decision"). Current leaning, not yet locked: **keep background-check results
separate from the AI verdict**, visible to the interviewer alongside (not folded
into) the AI's analysis, to keep the human decision-maker fully in the loop rather
than rubber-stamping an AI verdict that already incorporated everything.

## 15. Feature Opt-In System (Modular Endpoints)

Core anti-bloat mechanism: **optional features only run/exist if explicitly
enabled by the company admin.** If a feature is off, its backend endpoint(s) are
not hosted at all — not hosted-but-disabled, not present-but-gated, genuinely not
running.

- **Always-on essentials** (never gated): tagging, notes, approve/reject, the core
  AI review pipeline, applicant dashboard. These are the "the app doesn't work
  without them" features and are always active.
- **Opt-in features** (admin toggles yes/no during setup or later): interviewer
  chat (§16), recording, background checks (§14; once built), interviewer
  analytics (§17), and others as they're added.
- **Client-side behavior**: the client does **not** poll/check every optional
  endpoint on startup to determine what's enabled — that itself would be
  unnecessary overhead. Instead, the client only checks the specific optional
  endpoints relevant to features it's about to show, and hides or disables the UI
  for that feature if the endpoint isn't there. Concretely: if the chat endpoint
  returns 404, the client hides the chat option (or shows it disabled with "your
  organization has disabled chat" rather than a broken/dead button).

## 16. Interviewer Chat (optional feature, example of §15)

- Peer-to-peer chat among interviewers at the same company. Off by default — an
  admin opt-in feature per §15.
- **Encryption**: reuses the **same public/private keypair infrastructure already
  used for interview result encryption (§6)** rather than standing up a separate
  key system for chat — explicitly to avoid the bloat of parallel crypto
  infrastructure for one optional feature.
- **Admin-configurable encryption toggle** — floated as an alternative/addition:
  let the company choose whether chat is encrypted at all, rather than it being
  mandatory. Not fully decided — see open questions.

## 17. Interviewer Analytics (optional feature)

- **Server-generated, not client-generated** — analytics (e.g. approval counts,
  rejection counts, per-interviewer breakdowns) are computed server-side.
- Opt-in per §15 — no endpoint/computation overhead if a company doesn't want it.

## 18. Admin Panel & Applicant Submission UI Customization

- **Applicant submission UI** — the public-facing page where applicants upload
  resumes (§4 step 1). APAR ships a **reference implementation in Astro**, kept
  static/simple (basic HTML/CSS) rather than a heavy framework, specifically so
  it's easy for companies to understand and replace. Since building a generic
  "customizable frontend" system would be more complex than just documenting the
  API contract, APAR instead **documents how the submission flow works** so
  companies can reimplement the applicant-facing frontend in whatever
  stack they want (Astro, React, plain HTML, anything) — the reference
  implementation is a starting point, not a requirement to use it. This mirrors
  the Multer-based upload endpoint being a straightforward, well-documented
  target to build against.
- **Admin panel customization** — lighter-touch than the applicant UI: **text/label
  changes only** are supported and recommended (e.g. swapping a generic header for
  "{Company Name} Dashboard"). Deeper customization of the admin panel is
  explicitly **not recommended** — it's a materially more complex surface than the
  applicant submission page (which is essentially just an upload endpoint), so
  going beyond text/label swaps is on the company at their own risk, not something
  APAR designs support around.

## 19. Deployment & Distribution

- **Goal: single executable / as-simple-as-possible setup.** Given this is a solo
  portfolio project (predates The Cinder Project, not part of it), setup
  complexity should be minimized rather than mirroring a larger multi-repo
  project's operational overhead.
- **Primary/recommended target: Linux servers** (Debian and Debian-derivatives,
  and other Linux distributions companies commonly run). *(Note: OpenBSD, if
  companies use it, is a separate BSD-family OS — not Debian-based — worth
  tracking separately if it's actually a supported target, rather than assumed
  compatible via a shared lineage that doesn't exist.)*
- **Windows Server support**: still available via a built EXE, even though Windows
  Server ships with WSL — companies running native Windows-first ops shouldn't be
  forced into a WSL detour just to run APAR.
- **Hosting guidance for companies**:
  - Self-hosting on the company's own infrastructure is the default recommendation.
  - For companies wary of provisioning their own resources: the resource footprint
    is designed to be small relative to typical enterprise infrastructure — most
    of the actual storage growth comes from the database (applicant data volume/
    retention), not the app itself.
  - If a company doesn't want to self-host on their own hardware, renting a
    **dedicated VPS with full control** (not shared hosting) is the recommendation
    over shared hosting, mainly because shared hosting plans typically restrict
    which ports are exposed to the tenant — and APAR's self-hosted components
    (admin web UI, API gateway, setup API, etc.) need more flexibility than a
    shared-hosting port allowance typically provides. A dedicated VPS avoids that
    constraint entirely. **Alternative**: the optional relay/tunnel gateway (§9.2,
    `apar.qd.je`) sidesteps the port problem a different way — no inbound ports
    need to be exposed at all, since the company's instance connects outbound to
    the relay. Companies that don't want to deal with VPS/port configuration at
    all can use the relay instead of working around port restrictions themselves.
  - Remote (non-local) hosting is explicitly **not the recommended default** —
    self-hosted-and-local is the primary design target; remote deployment is
    supported but requires the company to handle their own port
    forwarding/networking setup properly.

## 20. Business / Monetization Notes

- **Affiliate VPS recommendations** — floated as a monetization avenue: APAR could
  recommend (and be sponsored by) specific VPS providers for companies that want
  to rent hosting rather than self-host on owned hardware, similar to how some
  open-source/community projects (e.g. certain Minecraft modpacks) display
  sponsor/hosting-partner branding. Not a v1 concern — noted here as a future
  direction, not a commitment.


## 21. Open Questions

**⭐ Immediate priority (stated as the definitive next focus, before anything else
gets built):**
0. ✅ **API-first hardening scope** — RESOLVED. Auth (JWT), Zod validation on all
   routes, rate limiting (api/auth/upload/pipeline), standardized error responses,
   versioned endpoints (`/api/v1/...`). All endpoints implemented.

**Carried over:**
1. ✅ **Grade thresholds** — RESOLVED. A: 80-100, B: 70-80, C: 60-70, D: 55-60,
   F: <55. Flat solid color bands locked.
2. ✅ **Encryption key hierarchy** — RESOLVED. Per-interviewer keys stored encrypted
   with company master key. Admins can reset but not define. See §6.
3. **Platform admin override mechanism — conditional, SaaS-only.** DEFERRED until
   SaaS funding exists. Not applicable to v1 self-hosted.
4. ✅ **Core processor stack** — RESOLVED. TypeScript primary. Rust/Java via Transit
   (https://github.com/SabeeirSharrma/transit) for performance-critical tasks.
5. ✅ **Applicant-side experience** — RESOLVED. Confirmation email on upload +
   public status endpoint (`/api/v1/status/:applicationId`) + status page UI.
6. ✅ **Remaining admin setup wizard steps** — RESOLVED. Step 5 (interviewer
   provisioning) is skippable via "Skip for now" button. Step 6 = client
   distribution: desktop (Windows/macOS, Linux future) + mobile/tablet (Android
   APK, iOS/iPadOS App Store). Interviewers input public company endpoint + admin-
   generated code → app soft-locks per admin config. Custom UIs supported on all
   platforms via documentation (admin follows guides to build custom layouts for
   desktop, tablet, mobile, web dash, and applicant form). Defaults provided.
7. ✅ **"Custom" database option scope** — RESOLVED. Real driver support for known
   external DBs (PostgreSQL, MySQL, MongoDB, etc.). Local = SQLite (auto-created).
   Custom/unsupported = admin enters connection string + DB type → app generates
   schema + RLS exceptions → admin provides connection endpoint with credentials.
8. ✅ **OpenRouter API key storage** — RESOLVED. Encrypted at rest using company
   master key. API keys treated as payment-credential sensitivity.
9. ✅ **App layout/theme style options** — RESOLVED. Full configurability on all
   platforms (desktop, tablet, mobile, web dash, applicant form). Documentation
   provided for custom UI creation. Defaults available for all who don't want to
   customize.

**New from previous session:**
10. ✅ **Round advancement mechanics (§12)** — RESOLVED. Manual interviewer action:
    when interviewer approves/accepts, applicant moves to next round (for round-
    based companies).
11. **Two-way email handling (§13)** — DEFERRED to v1 Stage 2. Replies from
    applicants need to route back into the app.
12. **Background-check-into-AI-verdict question (§14)** — DEFERRED to v2+.
    Current leaning: keep separate.
13. **Interviewer chat encryption (§16)** — DEFERRED to v1 optional scope.
    Mandatory (reusing §6 keys) is the default; admin-configurable toggle is
    also supported.
14. ✅ **Custom database driver support** — RESOLVED. See #7 above.
15. **Recording storage & retention (§10)** — DEFERRED to v1 optional scope.
16. **Relay gateway (§9.2)** — DEFERRED to post-v1. Assumed opt-in.
17. **Company-slug reservation mechanics (§9.2)** — DEFERRED to post-v1.
18. **Relay auth token issuance/rotation (§9.2)** — DEFERRED to post-v1.
19. **Relay cost model (§9.2)** — DEFERRED to post-v1.
20. **Branch/sub-DB structure (§9.2)** — DEFERRED to post-v1.
21. **"Own Worker" tier routing (§9.2)** — DEFERRED to post-v1.
22. **Vision-capability enforcement for local models (§9.3)** — DEFERRED. Document
    requirement, trust admin to pick correctly. Silent failure risk acknowledged.
23. ✅ **Empty-pool notification mechanism (§4 step 3)** — RESOLVED. Email
    notification to all company admins when position has zero interviewers and
    applicant is stuck in queue.

## 22. Custom UI System

The custom UI system allows companies to replace default platform interfaces with
their own branded designs. All platforms (desktop, tablet, mobile, web dash,
applicant form) support full UI customization.

### Architecture

- **Storage**: Custom UI files stored on disk under `data/custom_uis/{companyId}/{platform}/`
- **Database**: `custom_uis` table tracks metadata (name, version, manifest, active status)
- **Versioning**: Semantic versioning with update check endpoint for client auto-updates
- **Base templates**: 5 default templates provided as starting points

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/custom-ui` | GET | List all custom UIs for company |
| `/api/v1/custom-ui/:platform` | GET | Get active UI for platform |
| `/api/v1/custom-ui/:platform` | POST | Create/update UI (files as JSON object) |
| `/api/v1/custom-ui/:platform/activate/:id` | POST | Activate specific version |
| `/api/v1/custom-ui/:platform/:id` | DELETE | Delete inactive version |
| `/api/v1/custom-ui/:platform/check-update` | GET | Check for updates (clients) |
| `/api/v1/custom-ui/:platform/files/*` | GET | Serve static UI files |
| `/api/v1/custom-ui/defaults` | GET | List available base templates |
| `/api/v1/custom-ui/defaults/:template/install` | POST | Install template as custom UI |

### Platforms

1. **desktop** — Wide layout, sidebar navigation, keyboard-optimized
2. **tablet** — Touch-friendly, card-based, bottom tab bar
3. **mobile** — Compact, bottom navigation, swipe gestures
4. **web_dash** — Admin dashboard, sidebar nav, data tables
5. **applicant_form** — Clean submission form, drag-and-drop upload

### WebView Caching (Mobile/Desktop Clients)

Clients check for updates on launch via `/check-update?currentVersion=x`. If new
version available, download and cache locally. No App Store re-review needed for
UI changes — only native code changes require re-submission.

## 23. Roadmap

- **v1 — Stage 1 (base working version)**: core pipeline (§4-§9) + web UIs only
  (applicant submission, admin panel, **and interviewer web UI** — used until the
  Flutter client ships). **API-first hardening is prioritized here** — before any
  dedicated client (Flutter or otherwise) is built, the API itself should be
  solid, documented, and stable as a contract, since it's the thing every future
  client depends on. Tagging, notes, approve/reject with automated templated
  emails, anonymous applicant messaging, round-based interview support all belong
  in this stage's scope.
- **v1 — Stage 2 (Flutter client)**: dedicated Flutter interviewer client —
  Windows/Mac/Linux desktop + iPad/Android tablet from one codebase, **retiring
  the Stage 1 interviewer web UI**. Client talks to the Stage 1 API as an
  independent, network-connected client (§9.1) — not bundled with the server.
- **v1 — optional (opt-in, per §15)**: recording (screen/audio/mic, §10);
  interviewer chat (§16); interviewer analytics (§17). Ship the toggle system
  itself early so the anti-bloat design holds from day one, even if not every
  optional feature is fully built out at launch.
- **v2+**: background checks (third-party, AI-based, and custom-template options,
  §14) — deferred both because it's a larger scope and because the AI-verdict
  philosophical question (§14, open question 13) needs to be settled first;
  broader custom integrations (ATS hooks, school application system hooks,
  webhooks); Transit-Dart interop, if it ever becomes useful (explicitly not
  planned for now); affiliate/monetization features (§20).

## 24. Native Module Architecture

APAR uses native code for performance-critical operations via Transit
(JS↔Rust/Java interop). The split is deliberate: Rust binaries for one-shot
ops, Java via Transit for persistent hot-path processes.

### Why This Split

- **Rust toolchain is 2-4GB on Windows** — too heavy for dev machines. Shipping
  pre-built binaries keeps setup fast. Only used for one-shot operations where
  spawning a process per call is acceptable.
- **Java via Transit for hot-path code** — JVM stays resident as a long-lived
  process. Transit discovers functions via tree-sitter, calls them over a binary
  protocol. Lower latency than spawning a new process each time.
- **TypeScript remains primary** — native modules handle crypto and text
  analysis. Everything else (routing, DB, pipeline orchestration) stays in TS.

### Module Split

| Module | Language | Transport | Operations |
|--------|----------|-----------|------------|
| `apar-keygen` | Rust | CLI binary | AES-256-GCM key generation, encrypt/decrypt |
| `CryptoModule` | Java | Transit bridge | Hot-path encrypt/decrypt (persistent JVM) |
| `TextAnalysisModule` | Java | Transit bridge | Text analysis, tokenization, pattern matching |

### Integration

```typescript
// src/lib/transit.ts — unified wrapper
import { transit } from '@sabeeirsharrma/transit';

// Initialize Java bridge on boot (non-blocking)
const javaModule = transit.java('./native/apar-java/src/main/java');

// Call functions as async proxies
const result = await javaModule.generateKey('{}');
```

### Fallback Chain

All native operations fall back gracefully:
1. Rust binary (if available)
2. Java Transit (if JVM running)
3. Node.js crypto (always available)

### File Locations

```
native/
├── apar-keygen/          # Rust binary (branch: rust-keygen)
│   ├── src/main.rs
│   └── Cargo.toml
└── apar-java/            # Java Transit modules (branch: java-transit)
    └── src/main/java/
        ├── CryptoModule.java
        └── TextAnalysisModule.java
```git push -u origin main