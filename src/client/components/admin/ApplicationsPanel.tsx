import { useCallback, useEffect, useState } from "react";
import { VERDICT_META } from "../../lib/format";
import { adminListApplications } from "../../api";
import type { ApplicationSummary } from "../../../shared/types";
import { ErrorBanner } from "../Banners";
import { SpinnerIcon } from "../icons";

export function ApplicationsPanel() {
  const [items, setItems] = useState<ApplicationSummary[] | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(undefined);
    try {
      setItems(await adminListApplications());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load applications.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const queued = items?.filter((a) => a.status === "queued") ?? [];
  const assigned = items?.filter((a) => a.status === "assigned") ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Every submitted application. Queued ones had no active interviewer in the position's pool — they are stuck
          until a pool member is added.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error !== undefined && <ErrorBanner message={error} />}

      {items === null && error === undefined && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <SpinnerIcon className="h-4 w-4" /> Loading…
        </p>
      )}

      {items !== null && (
        <>
          {queued.length > 0 && (
            <section aria-label="Stuck applications" className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                Stuck — no active pool member ({queued.length})
              </h3>
              <ul className="space-y-2">
                {queued.map((a) => (
                  <ApplicationRow key={a.id} app={a} stuck />
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Assigned applications" className="space-y-2">
            {queued.length > 0 && (
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned</h3>
            )}
            {assigned.length === 0 && queued.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-600">No applications yet.</p>
                <p className="mt-1 text-sm text-slate-400">
                  Submissions from the applicant page will appear here as they come in.
                </p>
              </div>
            )}
            <ul className="space-y-2">
              {assigned.map((a) => (
                <ApplicationRow key={a.id} app={a} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function ApplicationRow({ app, stuck = false }: { app: ApplicationSummary; stuck?: boolean }) {
  const verdict = app.verdict !== null ? VERDICT_META[app.verdict] : null;
  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        stuck ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-slate-800">{app.positionName}</span>
        {verdict !== null ? (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${verdict.badgeClasses}`}>
            {verdict.label}
            {app.confidence === "low" ? " · low conf." : ""}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            no result
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-slate-400">{app.applicantFilename}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
        <span>
          {stuck ? (
            <span className="font-medium text-amber-600">Unassigned — add an active pool member to unstick</span>
          ) : (
            <>Assigned to {app.assignedTo?.name ?? "—"}</>
          )}
        </span>
        <span className="tabular-nums">
          {new Date(app.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </span>
      </p>
    </li>
  );
}
