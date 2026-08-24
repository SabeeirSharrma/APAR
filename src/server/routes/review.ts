import { Hono } from "hono";
import {
  FORM_FIELDS,
  MAX_PDF_BYTES,
  ReviewFormSchema,
  ReviewSuccessSchema,
  resolveProviderConfig,
  type ReviewSuccess,
} from "../../shared/types";
import { PipelineError } from "../errors";
import { errorResponse } from "../http";
import { runReview } from "../pipeline";
import { extractResumeText } from "../pdf";
import { getPosition, serializePosition } from "../repositories/positions";

export const reviewRoute = new Hono();

reviewRoute.post("/api/review", async (c) => {
  const startedAt = Date.now();
  try {
    const body = await c.req.parseBody();

    const fileEntry = body[FORM_FIELDS.file];
    if (!(fileEntry instanceof File)) {
      return errorResponse(c, "INVALID_REQUEST", "A PDF file upload is required.");
    }
    if (fileEntry.size <= 0) {
      return errorResponse(c, "INVALID_REQUEST", "The uploaded file is empty.");
    }
    if (fileEntry.size > MAX_PDF_BYTES) {
      const maxMb = Math.floor(MAX_PDF_BYTES / (1024 * 1024));
      return errorResponse(c, "INVALID_REQUEST", `The PDF exceeds the ${maxMb} MB limit.`);
    }
    const looksLikePdf =
      fileEntry.type === "application/pdf" || fileEntry.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) {
      return errorResponse(c, "UNREADABLE_PDF", "Please upload a valid PDF file.");
    }

    const rawPositionId = body[FORM_FIELDS.positionId];
    if (typeof rawPositionId !== "string") {
      return errorResponse(c, "INVALID_REQUEST", "Select a position to review against.");
    }
    const form = ReviewFormSchema.safeParse({ positionId: rawPositionId.trim() });
    if (!form.success) {
      return errorResponse(
        c,
        "INVALID_REQUEST",
        form.error.issues[0]?.message ?? "Invalid request.",
      );
    }

    const record = await getPosition(form.data.positionId);
    if (record === null) {
      return errorResponse(
        c,
        "POSITION_NOT_FOUND",
        "This position no longer exists. Pick another one and try again.",
      );
    }
    const position = serializePosition(record);

    const pdfBytes = new Uint8Array(await fileEntry.arrayBuffer());
    const resumeText = await extractResumeText(pdfBytes);

    const cfg = resolveProviderConfig(position);
    const outcome = await runReview(resumeText, position.criteria, cfg);

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
      return errorResponse(c, err.code, err.message);
    }
    console.error("[review] unexpected error:", err);
    return errorResponse(c, "INTERNAL", "An unexpected server error occurred.");
  }
});
