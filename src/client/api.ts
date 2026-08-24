import {
  FORM_FIELDS,
  PositionInputSchema,
  PositionSchema,
  PositionSummarySchema,
  ReviewErrorSchema,
  ReviewResponseSchema,
  type Position,
  type PositionInput,
  type PositionSummary,
  type ReviewResponse,
} from "../shared/types";
import { z } from "zod";

/** Transport-level failure: unreachable server, non-JSON body, malformed payload. */
export class ApiTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiTransportError";
  }
}

/**
 * Fetches JSON and validates it against `schema`.
 * Server error bodies (ReviewError shape) surface their message directly;
 * anything else non-OK becomes a generic transport error.
 */
async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  schema: z.ZodType<T>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiTransportError("Could not reach the APAR server. Check that it is running.");
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiTransportError(`The server returned a non-JSON response (HTTP ${res.status}).`);
  }

  const serverError = ReviewErrorSchema.safeParse(json);
  if (serverError.success) {
    throw new ApiTransportError(serverError.data.error.message);
  }
  if (!res.ok) {
    throw new ApiTransportError(`Request failed (HTTP ${res.status}).`);
  }
  try {
    return schema.parse(json);
  } catch {
    throw new ApiTransportError("The server returned a malformed response.");
  }
}

// ---------------------------------------------------------------------------
// Review submission
// ---------------------------------------------------------------------------

export interface SubmitReviewInput {
  file: File;
  positionId: string;
}

/**
 * POSTs the resume against a saved position. Resolves with the discriminated
 * ReviewResponse on any well-formed answer; throws ApiTransportError only
 * when no trustworthy response exists. No artificial timeout — local models
 * can legitimately take minutes.
 */
export async function submitReview(input: SubmitReviewInput): Promise<ReviewResponse> {
  const fd = new FormData();
  fd.set(FORM_FIELDS.file, input.file);
  fd.set(FORM_FIELDS.positionId, input.positionId);

  let res: Response;
  try {
    res = await fetch("/api/review", { method: "POST", body: fd });
  } catch {
    throw new ApiTransportError(
      "Could not reach the APAR server. Check that it is running and your connection is up.",
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiTransportError(`The server returned a non-JSON response (HTTP ${res.status}).`);
  }

  try {
    return ReviewResponseSchema.parse(json);
  } catch {
    throw new ApiTransportError("The server returned a malformed response.");
  }
}

// ---------------------------------------------------------------------------
// Public positions (applicant dropdown)
// ---------------------------------------------------------------------------

const PositionsListSchema = z.object({ positions: z.array(PositionSummarySchema) });

export async function listPositionSummaries(): Promise<PositionSummary[]> {
  const body = await requestJson("/api/positions", undefined, PositionsListSchema);
  return body.positions;
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

const AdminPositionsListSchema = z.object({ positions: z.array(PositionSchema) });

export async function adminListPositions(): Promise<Position[]> {
  const body = await requestJson("/api/admin/positions", undefined, AdminPositionsListSchema);
  return body.positions;
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export async function adminCreatePosition(input: PositionInput): Promise<Position> {
  return requestJson("/api/admin/positions", jsonInit("POST", input), PositionSchema);
}

export async function adminUpdatePosition(id: string, input: PositionInput): Promise<Position> {
  return requestJson(`/api/admin/positions/${id}`, jsonInit("PUT", input), PositionSchema);
}

export async function adminDeletePosition(id: string): Promise<void> {
  await requestJson(
    `/api/admin/positions/${id}`,
    { method: "DELETE" },
    z.object({ ok: z.literal(true) }),
  );
}

export { PositionInputSchema };
