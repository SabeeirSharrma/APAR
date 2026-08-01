import rateLimit from 'express-rate-limit';

// ============================================================================
// Rate Limiting (§21 priority #0)
// ============================================================================

/**
 * General API rate limiter — 100 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMITED',
  },
});

/**
 * Strict rate limiter for auth endpoints — 10 requests per minute per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMITED',
  },
});

/**
 * Upload rate limiter — 20 uploads per minute per IP.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many uploads, please try again later',
    code: 'RATE_LIMITED',
  },
});

/**
 * Pipeline/model call rate limiter — 5 requests per minute per IP.
 * Prevents abuse of the AI model pipeline.
 */
export const pipelineLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many analysis requests, please try again later',
    code: 'RATE_LIMITED',
  },
});
