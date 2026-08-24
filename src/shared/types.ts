import { z } from "zod";

/**
 * Shared contract for the APAR review pipeline.
 * Single source of truth used by server (validation, pipeline IO) and client.
 *
 * Stage 1: stateless single-page review pipeline.
 * Stage 2: persisted positions; applicant submits against a saved position;
 *          unprotected admin CRUD enters the build (auth arrives in stage 3).
 */

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export const PROVIDERS = ["openrouter", "ollama"] as const;
export const ProviderSchema = z.enum(PROVIDERS);
export type Provider = z.infer<typeof ProviderSchema>;

export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";

/** Resolved provider config — what the pipeline consumes regardless of source. */
export interface ResolvedProviderConfig {
  provider: Provider;
  mainModel: string;
  verifierModel: string; // falls back to mainModel when not overridden
  openrouterApiKey?: string; // required iff provider === "openrouter"
  ollamaEndpoint?: string; // defaults to DEFAULT_OLLAMA_ENDPOINT
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Provider config fields as entered by an admin — optional until refines. */
const ProviderConfigShape = {
  provider: ProviderSchema,
  openrouterApiKey: z.string().trim().min(1).optional(),
  openrouterModel: z.string().trim().min(1).optional(),
  ollamaEndpoint: z.string().trim().optional(),
  ollamaModel: z.string().trim().min(1).optional(),
  verifierModelOverride: z.string().trim().min(1).optional(),
};

// ---------------------------------------------------------------------------
// Multipart form field names (kept in sync between client and server)
// ---------------------------------------------------------------------------

export const FORM_FIELDS = {
  file: "file",
  positionId: "positionId",
} as const;

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
/** Resume text below this length is treated as an unreadable/empty PDF. */
export const MIN_RESUME_TEXT_LENGTH = 50;
/** Main model attempts are capped at 3 per spec (stage 1). */
export const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Model output schemas (what each AI call must return)
// ---------------------------------------------------------------------------

export const PerCriterionScoreSchema = z.object({
  criterion: z.string().min(1),
  /** 0–10 score against this single criterion. */
  score: z.number().min(0).max(10),
  justification: z.string().min(1),
});
export type PerCriterionScore = z.infer<typeof PerCriterionScoreSchema>;

export const OverallVerdictSchema = z.enum(["strong_match", "partial_match", "not_a_match"]);
export type OverallVerdict = z.infer<typeof OverallVerdictSchema>;

export const MainModelOutputSchema = z.object({
  overallVerdict: OverallVerdictSchema,
  summary: z.string().min(1),
  perCriterion: z.array(PerCriterionScoreSchema).min(1),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
});
export type MainModelOutput = z.infer<typeof MainModelOutputSchema>;
/** The review result shown to the user. */
export type ReviewResult = MainModelOutput;

export const VerificationOutputSchema = z.object({
  consistent: z.boolean(),
  issues: z.array(z.string()),
});
export type VerificationOutput = z.infer<typeof VerificationOutputSchema>;

// ---------------------------------------------------------------------------
// Positions (stage 2)
// ---------------------------------------------------------------------------

export const POSITION_NAME_MAX = 200;
export const CRITERIA_MAX = 20_000;

/** What the public applicant surface may see: id + name only. */
export const PositionSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
});
export type PositionSummary = z.infer<typeof PositionSummarySchema>;

/** Admin-facing serialized position (timestamps ISO 8601 UTC). */
export const PositionSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  criteria: z.string().min(1),
  provider: ProviderSchema,
  openrouterApiKey: z.string().optional(),
  openrouterModel: z.string().optional(),
  ollamaEndpoint: z.string().optional(),
  ollamaModel: z.string().optional(),
  verifierModelOverride: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Position = z.infer<typeof PositionSchema>;

/** Create/update payload for the admin API. */
export const PositionInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(POSITION_NAME_MAX),
    criteria: z.string().trim().min(1, "Criteria is required").max(CRITERIA_MAX),
    ...ProviderConfigShape,
  })
  .refine(
    (v) => v.provider !== "openrouter" || (!!v.openrouterApiKey && !!v.openrouterModel),
    { message: "OpenRouter requires an API key and a model name", path: ["openrouterApiKey"] },
  )
  .refine((v) => v.provider !== "ollama" || !!v.ollamaModel, {
    message: "Ollama requires a model name",
    path: ["ollamaModel"],
  })
  .refine((v) => !v.ollamaEndpoint || isValidHttpUrl(v.ollamaEndpoint), {
    message: "Ollama endpoint must be a full URL including http:// or https://",
    path: ["ollamaEndpoint"],
  });
export type PositionInput = z.infer<typeof PositionInputSchema>;

/**
 * Derives the pipeline's provider config from stored position fields.
 * Throws only if a row is corrupted (missing its provider's main model) —
 * unreachable through normal flows because PositionInputSchema guarantees it.
 */
export function resolveProviderConfig(
  position: Pick<
    Position,
    | "provider"
    | "openrouterApiKey"
    | "openrouterModel"
    | "ollamaEndpoint"
    | "ollamaModel"
    | "verifierModelOverride"
  >,
): ResolvedProviderConfig {
  const mainModel =
    position.provider === "openrouter" ? position.openrouterModel : position.ollamaModel;
  if (!mainModel) {
    throw new Error(`Position is missing its ${position.provider} main model`);
  }
  return {
    provider: position.provider,
    mainModel,
    verifierModel: position.verifierModelOverride ?? mainModel,
    ...(position.provider === "openrouter" && position.openrouterApiKey
      ? { openrouterApiKey: position.openrouterApiKey }
      : {}),
    ...(position.provider === "ollama" && position.ollamaEndpoint
      ? { ollamaEndpoint: position.ollamaEndpoint }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// API request (multipart/form-data) — validated server-side
// ---------------------------------------------------------------------------

export const ReviewFormSchema = z.object({
  positionId: z.uuid("A saved position must be selected"),
});

// ---------------------------------------------------------------------------
// API responses
// ---------------------------------------------------------------------------

export const ReviewMetaSchema = z.object({
  provider: ProviderSchema,
  mainModel: z.string(),
  verifierModel: z.string(),
  durationMs: z.number().int().nonnegative(),
});
export type ReviewMeta = z.infer<typeof ReviewMetaSchema>;

export const ReviewSuccessSchema = z.object({
  status: z.literal("ok"),
  result: MainModelOutputSchema,
  /**
   * "high" = final attempt passed internal verification.
   * "low"  = still inconsistent after MAX_ATTEMPTS → client renders the
   * low-confidence disclaimer (spec stage 1).
   */
  confidence: z.enum(["high", "low"]),
  /** Number of main-model calls actually made (1..MAX_ATTEMPTS). */
  attempts: z.number().int().min(1).max(MAX_ATTEMPTS),
  /** Issues collected from every failed verification pass. */
  verificationIssues: z.array(z.string()),
  meta: ReviewMetaSchema,
});
export type ReviewSuccess = z.infer<typeof ReviewSuccessSchema>;

export const ErrorCodeSchema = z.enum([
  "INVALID_REQUEST", // 400 — bad/missing form fields or body
  "UNREADABLE_PDF", // 422 — not a PDF / no extractable text
  "POSITION_NOT_FOUND", // 404 — referenced position does not exist
  "NOT_FOUND", // 404 — unknown route/resource
  "PROVIDER_ERROR", // 502 — upstream AI provider failed
  "PROVIDER_TIMEOUT", // 504 — upstream AI provider timed out
  "INTERNAL", // 500 — unexpected
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ReviewErrorSchema = z.object({
  status: z.literal("error"),
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
  }),
});
export type ReviewError = z.infer<typeof ReviewErrorSchema>;

export const ReviewResponseSchema = z.discriminatedUnion("status", [
  ReviewSuccessSchema,
  ReviewErrorSchema,
]);
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

/** Maps error codes to the HTTP status routes respond with. */
export const ERROR_HTTP_STATUS = {
  INVALID_REQUEST: 400,
  UNREADABLE_PDF: 422,
  POSITION_NOT_FOUND: 404,
  NOT_FOUND: 404,
  PROVIDER_ERROR: 502,
  PROVIDER_TIMEOUT: 504,
  INTERNAL: 500,
} as const satisfies Record<ErrorCode, number>;
