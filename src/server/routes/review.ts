import { Hono } from "hono";
import {
  ERROR_HTTP_STATUS,
  FORM_FIELDS,
  MAX_PDF_BYTES,
  ReviewFormSchema,
  ReviewSuccessSchema,
  type ErrorCode,
  type ReviewError,
  type ReviewSuccess,
} from "../../shared/types";
import { PipelineError } from "../errors";
import { runReview } from "../pipeline";
import { extractResumeText } from "../pdf";

export const reviewRoute = new Hono();

function errorBody(code: ErrorCode, message: string): ReviewError {
  return { status: "error", error: { code, message } };
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

reviewRoute.post("/api/review", async (c) => {
  const startedAt = Date.now();
  try {
    const body = await c.req.parseBody();

    // --- File field ---
    const fileEntry = body[FORM_FIELDS.file];
    if (!(fileEntry instanceof File)) {
      return c.json(errorBody("INVALID_REQUEST", "A PDF file upload is required."), ERROR_HTTP_STATUS.INVALID_REQUEST);
    }
    if (fileEntry.size <= 0) {
      return c.json(errorBody("INVALID_REQUEST", "The uploaded file is empty."), ERROR_HTTP_STATUS.INVALID_REQUEST);
    }
    if (fileEntry.size > MAX_PDF_BYTES) {
      const maxMb = Math.floor(MAX_PDF_BYTES / (1024 * 1024));
      return c.json(
        errorBody("INVALID_REQUEST", `The PDF exceeds the ${maxMb} MB limit.`),
        ERROR_HTTP_STATUS.INVALID_REQUEST,
      );
    }
    const looksLikePdf =
      fileEntry.type === "application/pdf" || fileEntry.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) {
      return c.json(errorBody("UNREADABLE_PDF", "Please upload a valid PDF file."), ERROR_HTTP_STATUS.UNREADABLE_PDF);
    }

    // --- Text fields ---
    const formInput = {
      criteria: asTrimmedString(body[FORM_FIELDS.criteria]) ?? "",
      provider: asTrimmedString(body[FORM_FIELDS.provider]) ?? "",
      openrouterApiKey: asTrimmedString(body[FORM_FIELDS.openrouterApiKey]),
      openrouterModel: asTrimmedString(body[FORM_FIELDS.openrouterModel]),
      ollamaEndpoint: asTrimmedString(body[FORM_FIELDS.ollamaEndpoint]),
      ollamaModel: asTrimmedString(body[FORM_FIELDS.ollamaModel]),
      verifierModelOverride: asTrimmedString(body[FORM_FIELDS.verifierModelOverride]),
    };
    const form = ReviewFormSchema.safeParse(formInput);
    if (!form.success) {
      const firstIssue = form.error.issues[0];
      return c.json(
        errorBody("INVALID_REQUEST", firstIssue?.message ?? "Invalid request."),
        ERROR_HTTP_STATUS.INVALID_REQUEST,
      );
    }
    const { provider } = form.data;

    // --- Resolve provider config (refines above guarantee presence) ---
    let openrouterApiKey: string | undefined;
    let ollamaEndpoint: string | undefined;
    let mainModel: string;
    if (provider === "openrouter") {
      const key = form.data.openrouterApiKey;
      const model = form.data.openrouterModel;
      if (!key || !model) {
        return c.json(
          errorBody("INVALID_REQUEST", "OpenRouter requires an API key and a model name."),
          ERROR_HTTP_STATUS.INVALID_REQUEST,
        );
      }
      openrouterApiKey = key;
      mainModel = model;
    } else {
      const model = form.data.ollamaModel;
      if (!model) {
        return c.json(
          errorBody("INVALID_REQUEST", "Ollama requires a model name."),
          ERROR_HTTP_STATUS.INVALID_REQUEST,
        );
      }
      ollamaEndpoint = form.data.ollamaEndpoint;
      mainModel = model;
    }
    const cfg = {
      provider,
      mainModel,
      verifierModel: form.data.verifierModelOverride ?? mainModel,
      ...(openrouterApiKey ? { openrouterApiKey } : {}),
      ...(ollamaEndpoint ? { ollamaEndpoint } : {}),
    };

    // --- Extract resume text ---
    const pdfBytes = new Uint8Array(await fileEntry.arrayBuffer());
    const resumeText = await extractResumeText(pdfBytes);

    // --- Run pipeline ---
    const outcome = await runReview(resumeText, form.data.criteria, cfg);

    const success: ReviewSuccess = {
      status: "ok",
      result: outcome.result,
      confidence: outcome.confidence,
      attempts: outcome.attempts,
      verificationIssues: outcome.verificationIssues,
      meta: {
        provider: cfg.provider,
        mainModel: cfg.mainModel,
        verifierModel: cfg.verifierModel,
        durationMs: Date.now() - startedAt,
      },
    };
    return c.json(ReviewSuccessSchema.parse(success));
  } catch (err) {
    if (err instanceof PipelineError) {
      return c.json(errorBody(err.code, err.message), ERROR_HTTP_STATUS[err.code]);
    }
    console.error("[review] unexpected error:", err);
    return c.json(errorBody("INTERNAL", "An unexpected server error occurred."), ERROR_HTTP_STATUS.INTERNAL);
  }
});
