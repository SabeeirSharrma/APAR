import type { Context } from "hono";
import { ERROR_HTTP_STATUS, type ErrorCode, type ReviewError } from "../shared/types";

export function errorBody(code: ErrorCode, message: string): ReviewError {
  return { status: "error", error: { code, message } };
}

export function errorResponse(c: Context, code: ErrorCode, message: string): Response {
  return c.json(errorBody(code, message), ERROR_HTTP_STATUS[code]);
}

export async function readJsonBody(c: Context): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await c.req.json() };
  } catch {
    return { ok: false };
  }
}
