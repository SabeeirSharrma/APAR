import {
  FORM_FIELDS,
  PositionInputSchema,
  PositionSchema,
  PositionSummarySchema,
  ReviewErrorSchema,
  ReviewResponseSchema,
  ApplicationDetailSchema,
  ApplicationSummarySchema,
  MeResponseSchema,
  UserSchema,
  type ApplicationDetail,
  type ApplicationSummary,
  type Position,
  type PositionInput,
  type PositionSummary,
  type ReviewResponse,
  type Role,
  type User,
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

// ---------------------------------------------------------------------------
// Auth (stage 3)
// ---------------------------------------------------------------------------

export async function fetchMe(): Promise<User | null> {
  const body = await requestJson("/api/auth/me", undefined, MeResponseSchema);
  return body.user;
}

export async function login(email: string, password: string): Promise<User> {
  return requestJson(
    "/api/auth/login",
    jsonInit("POST", { email, password }),
    UserSchema,
  );
}

export async function logout(): Promise<void> {
  await requestJson("/api/auth/logout", { method: "POST" }, z.object({ ok: z.literal(true) }));
}

// ---------------------------------------------------------------------------
// Roster (admin)
// ---------------------------------------------------------------------------

const UsersListSchema = z.object({ users: z.array(UserSchema) });

export interface RosterFormInput {
  name: string;
  email: string;
  active: boolean;
  /** Empty string on update = keep current password. */
  password: string;
}

export async function listRoster(role?: Role): Promise<User[]> {
  const url = role === undefined ? "/api/admin/users" : `/api/admin/users?role=${role}`;
  const body = await requestJson(url, undefined, UsersListSchema);
  return body.users;
}

export async function createInterviewer(input: RosterFormInput): Promise<User> {
  return requestJson("/api/admin/users", jsonInit("POST", input), UserSchema);
}

export async function updateInterviewer(id: string, input: RosterFormInput): Promise<User> {
  return requestJson(`/api/admin/users/${id}`, jsonInit("PUT", input), UserSchema);
}

export async function deleteInterviewer(id: string): Promise<void> {
  await requestJson(
    `/api/admin/users/${id}`,
    { method: "DELETE" },
    z.object({ ok: z.literal(true) }),
  );
}

// ---------------------------------------------------------------------------
// Applications (stage 3)
// ---------------------------------------------------------------------------

const ApplicationListSchema = z.object({ applications: z.array(ApplicationSummarySchema) });

export async function adminListApplications(): Promise<ApplicationSummary[]> {
  const body = await requestJson("/api/admin/applications", undefined, ApplicationListSchema);
  return body.applications;
}

export async function listMyApplications(): Promise<ApplicationSummary[]> {
  const body = await requestJson("/api/my/applications", undefined, ApplicationListSchema);
  return body.applications;
}

export async function getMyApplication(id: string): Promise<ApplicationDetail> {
  return requestJson(`/api/my/applications/${id}`, undefined, ApplicationDetailSchema);
}
