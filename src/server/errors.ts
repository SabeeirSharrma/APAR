import type { ErrorCode } from "../shared/types";

/**
 * Typed pipeline failure. Carries an ErrorCode that maps directly to both
 * the response body schema and the HTTP status via ERROR_HTTP_STATUS.
 */
export class PipelineError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}
