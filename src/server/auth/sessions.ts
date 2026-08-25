import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { getCookie, deleteCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { verifyPassword } from "./passwords";
import { db } from "../db/client";
import type { UserRecord } from "../db/schema";
import { sessions, users } from "../db/schema";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "apar_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface AuthenticatedUser {
  id: string;
  role: "admin" | "interviewer";
  name: string;
  email: string;
  active: boolean;
  createdAtMs: number;
}

function toAuthUser(row: UserRecord): AuthenticatedUser {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    active: row.active,
    createdAtMs: row.createdAtMs,
  };
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthenticatedUser } | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const row = rows[0];
  // Always run a verification pass so missing users cost the same as wrong passwords.
  const storedHash =
    row?.passwordHash ?? "scrypt:00000000000000000000000000000000:" + "0".repeat(128);
  const ok = await verifyPassword(password, storedHash);
  if (!row || !ok || !row.active) return null;

  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId: row.id,
    createdAtMs: now,
    expiresAtMs: now + SESSION_TTL_MS,
  });
  return { token, user: toAuthUser(row) };
}

export async function resolveSession(c: Context): Promise<AuthenticatedUser | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  const found = rows[0];
  if (!found) return null;
  if (found.session.expiresAtMs < Date.now() || !found.user.active) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }
  return toAuthUser(found.user);
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: process.env.COOKIE_SECURE === "true",
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function logout(c: Context): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  clearSessionCookie(c);
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
}

export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAtMs, Date.now()));
}
