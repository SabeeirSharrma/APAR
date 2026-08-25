import { Hono } from "hono";
import { MeResponseSchema, UserSchema, LoginRequestSchema } from "../../shared/types";
import { login, logout, resolveSession, setSessionCookie } from "../auth/sessions";
import { clearFailures, clientIp, isLockedOut, recordFailure } from "../auth/throttle";
import { errorResponse } from "../http";

export const authRoute = new Hono();

authRoute.post("/api/auth/login", async (c) => {
  const ip = clientIp(c);
  if (isLockedOut(ip)) {
    return errorResponse(c, "AUTH_REQUIRED", "Too many failed attempts. Try again later.");
  }
  const body = await c.req.json().catch(() => null);
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(c, "INVALID_REQUEST", "Email and password are required.");
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (result === null) {
    recordFailure(ip);
    return errorResponse(c, "AUTH_REQUIRED", "Incorrect email or password.");
  }
  clearFailures(ip);
  setSessionCookie(c, result.token);
  return c.json(
    UserSchema.parse({ ...result.user, createdAt: new Date(result.user.createdAtMs).toISOString() }),
  );
});

authRoute.post("/api/auth/logout", async (c) => {
  await logout(c);
  return c.json({ ok: true });
});

// Always 200: anonymous users are valid state here, not errors.
authRoute.get("/api/auth/me", async (c) => {
  const session = await resolveSession(c);
  const user =
    session === null ? null : { ...session, createdAt: new Date(session.createdAtMs).toISOString() };
  return c.json(MeResponseSchema.parse({ user }));
});
