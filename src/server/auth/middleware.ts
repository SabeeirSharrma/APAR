import type { MiddlewareHandler } from "hono";
import { errorResponse } from "../http";
import { resolveSession, type AuthenticatedUser } from "../auth/sessions";

declare module "hono" {
  interface ContextVariableMap {
    authUser: AuthenticatedUser;
  }
}

export function requireRole(...roles: Array<"admin" | "interviewer">): MiddlewareHandler {
  return async (c, next) => {
    const user = await resolveSession(c);
    if (user === null) {
      return errorResponse(c, "AUTH_REQUIRED", "Sign in to continue.");
    }
    if (!roles.includes(user.role)) {
      return errorResponse(c, "FORBIDDEN", "Your account does not have access to this area.");
    }
    c.set("authUser", user);
    await next();
  };
}
