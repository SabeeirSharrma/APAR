import { Request, Response, NextFunction } from 'express';

// ============================================================================
// Standardized Error Handling (§21 priority #0)
// ============================================================================

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Create an API error with status code and optional code/details.
 */
export function createError(statusCode: number, message: string, code?: string, details?: unknown): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * 400 Bad Request
 */
export function badRequest(message: string, details?: unknown): ApiError {
  return createError(400, message, 'BAD_REQUEST', details);
}

/**
 * 401 Unauthorized
 */
export function unauthorized(message = 'Authentication required'): ApiError {
  return createError(401, message, 'UNAUTHORIZED');
}

/**
 * 403 Forbidden
 */
export function forbidden(message = 'Insufficient permissions'): ApiError {
  return createError(403, message, 'FORBIDDEN');
}

/**
 * 404 Not Found
 */
export function notFound(resource: string): ApiError {
  return createError(404, `${resource} not found`, 'NOT_FOUND');
}

/**
 * 409 Conflict
 */
export function conflict(message: string, details?: unknown): ApiError {
  return createError(409, message, 'CONFLICT', details);
}

/**
 * 422 Unprocessable Entity
 */
export function validationError(message: string, details?: unknown): ApiError {
  return createError(422, message, 'VALIDATION_ERROR', details);
}

/**
 * 429 Too Many Requests
 */
export function rateLimited(message = 'Too many requests, please try again later'): ApiError {
  return createError(429, message, 'RATE_LIMITED');
}

/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns a consistent JSON response.
 */
export function errorHandler(err: ApiError, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${statusCode}: ${err.message}`);
  if (isDev && err.stack) {
    console.error(err.stack);
  }

  const body: Record<string, unknown> = {
    success: false,
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  };
  if (isDev && err.stack) body.stack = err.stack;
  if (err.details) body.details = err.details;

  res.status(statusCode).json(body);
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  });
}
