import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

// ============================================================================
// Authentication Utilities (§6, §9.1)
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = 12;

export type UserRole = 'company_admin' | 'interviewer';

export interface TokenPayload {
  userId: string;
  companyId: string;
  role: UserRole;
  email: string;
}

export interface AuthToken {
  token: string;
  expiresAt: string;
}

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for an authenticated user.
 */
export function generateToken(payload: TokenPayload): AuthToken {
  const expiresInMs = parseExpiresIn(JWT_EXPIRES_IN);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: Math.floor(expiresInMs / 1000) });
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
  return { token, expiresAt };
}

/**
 * Verify and decode a JWT token.
 * Returns null if the token is invalid or expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return {
      userId: decoded.userId,
      companyId: decoded.companyId,
      role: decoded.role,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a expires-in string to milliseconds.
 */
function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}
