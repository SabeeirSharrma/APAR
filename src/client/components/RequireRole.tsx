import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import type { Role } from "../../shared/types";
import { useAuth } from "../auth";

/**
 * Gate for role-protected pages: waits for the session probe, redirects
 * anonymous users to /login (preserving origin), and bounces wrong-role users home.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <p aria-live="polite" className="py-12 text-center text-sm text-slate-400">
        Checking your session…
      </p>
    );
  }
  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
