import { FORM_FIELDS, ReviewResponseSchema, type Provider, type ReviewResponse } from "../shared/types";

export interface SubmitReviewInput {
  file: File;
  criteria: string;
  provider: Provider;
  openrouterApiKey?: string;
  openrouterModel?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  verifierModelOverride?: string;
}

/** Transport-level failure: unreachable server, non-JSON body, malformed payload. */
export class ApiTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiTransportError";
  }
}

/**
 * POSTs the review form. Resolves with the discriminated ReviewResponse on
 * any well-formed server answer (including business errors); throws
 * ApiTransportError only when no trustworthy response exists.
 * No artificial fetch timeout — local models can legitimately take minutes.
 */
export async function submitReview(input: SubmitReviewInput): Promise<ReviewResponse> {
  const fd = new FormData();
  fd.set(FORM_FIELDS.file, input.file);
  fd.set(FORM_FIELDS.criteria, input.criteria);
  fd.set(FORM_FIELDS.provider, input.provider);
  if (input.openrouterApiKey) fd.set(FORM_FIELDS.openrouterApiKey, input.openrouterApiKey);
  if (input.openrouterModel) fd.set(FORM_FIELDS.openrouterModel, input.openrouterModel);
  if (input.ollamaEndpoint) fd.set(FORM_FIELDS.ollamaEndpoint, input.ollamaEndpoint);
  if (input.ollamaModel) fd.set(FORM_FIELDS.ollamaModel, input.ollamaModel);
  if (input.verifierModelOverride) fd.set(FORM_FIELDS.verifierModelOverride, input.verifierModelOverride);

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
