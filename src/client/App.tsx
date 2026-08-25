import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { RequireRole } from "./components/RequireRole";
import AdminPage from "./pages/AdminPage";
import ApplicantPage from "./pages/ApplicantPage";
import InterviewerPage from "./pages/InterviewerPage";
import LoginPage from "./pages/LoginPage";

function Shell() {
  const { user, loading, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
              A
            </span>
            <span>
              <span className="block text-base font-semibold leading-tight tracking-tight">APAR</span>
              <span className="block text-[11px] text-slate-400">AI Powered Applicant Review</span>
            </span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1">
            {[
              { to: "/", label: "Apply", show: "always" as const },
              { to: "/interviewer", label: "Reviews", show: "interviewer" as const },
              { to: "/admin", label: "Admin", show: "admin" as const },
            ]
              .filter((item) => {
                if (item.show === "always") return true;
                if (loading) return false;
                if (item.show === "admin") return user?.role === "admin";
                return user?.role === "interviewer";
              })
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}

            {loading ? null : user === null ? (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  }`
                }
              >
                Sign in
              </NavLink>
            ) : (
              <span className="flex items-center gap-2 pl-1">
                <span className="hidden text-xs text-slate-400 sm:inline">
                  {user.name} · {user.role}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                >
                  Sign out
                </button>
              </span>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
        <Routes>
          <Route path="/" element={<ApplicantPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireRole roles={["admin"]}>
                <AdminPage />
              </RequireRole>
            }
          />
          <Route
            path="/interviewer"
            element={
              <RequireRole roles={["interviewer"]}>
                <InterviewerPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-8 text-center text-xs text-slate-300">
        APAR · Stage 3 · advisory assessments only — a human makes the decision
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
