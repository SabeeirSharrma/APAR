import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import ApplicantPage from "./pages/ApplicantPage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 rounded-lg">
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
              { to: "/", label: "Apply" },
              { to: "/admin", label: "Admin" },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
        <Routes>
          <Route path="/" element={<ApplicantPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-8 text-center text-xs text-slate-300">
        APAR · Stage 2 · advisory assessments only
      </footer>
    </div>
  );
}
