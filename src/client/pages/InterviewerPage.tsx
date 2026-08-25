import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicationDetail, ApplicationSummary } from "../../shared/types";
import { getMyApplication, listMyApplications } from "../api";
import { ErrorBanner } from "../components/Banners";
import { ResultsCard } from "../components/ResultsCard";
import { SpinnerIcon } from "../components/icons";
import { useAuth } from "../auth";

type ReviewSuccessShape = Parameters<typeof ResultsCard>[0]["data"];

function detailToReviewSuccess(detail: ApplicationDetail): ReviewSuccessShape | null {
  const r = detail.result;
  if (r === null) return null;
  return {
    status: "ok",
    result: {
      overallVerdict: r.overallVerdict,
      summary: r.summary,
      perCriterion: r.perCriterion,
      strengths: r.strengths,
      concerns: r.concerns,
    },
    confidence: r.confidence,
    attempts: r.attempts,
    verificationIssues: r.verificationIssues,
    meta: {
      provider: r.provider,
      mainModel: r.mainModel,
      verifierModel: r.verifierModel,
      durationMs: r.durationMs,
    },
  };
}

export default function InterviewerPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ApplicationSummary[] | null>(null);
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<ApplicationDetail | null>(null);
  const [detailError, setDetailError] = useState<string | undefined>(undefined);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listMyApplications()
      .then((apps) => {
        if (!cancelled) setItems(apps);
      })
      .catch((err: unknown) => {
        if (!cancelled) setListError(err instanceof Error ? err.message : "Could not load assignments.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openDetail = useCallback(async (id: string) => {
    setSelected(null);
    setDetailError(undefined);
    setLoadingDetail(true);
    try {
      const detail = await getMyApplication(id);
      setSelected(detail);
      requestAnimationFrame(() => detailRef.current?.focus());
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Could not load the application.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const selectedReview = selected !== null ? detailToReviewSuccess(selected) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Your assigned applications</h2>
        <p className="text-sm text-slate-400">
          {user !== null ? `Signed in as ${user.name}.` : ""} Open one to review the AI assessment.
        </p>
      </div>

      {listError !== undefined && <ErrorBanner message={listError} />}

      {items === null && listError === undefined && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <SpinnerIcon className="h-4 w-4" /> Loading…
        </p>
      )}

      {items !== null && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-600">Nothing assigned to you yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            New applications are auto-assigned across each position's interviewer pool.
          </p>
        </div>
      )}

      {items !== null && items.length > 0 && (
        <ul className="space-y-2.5">
          {items.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => void openDetail(app.id)}
                disabled={loadingDetail}
                className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all duration-150 hover:border-indigo-300 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 ${
                  selected?.id === app.id ? "border-indigo-500 ring-1 ring-indigo-300" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{app.positionName}</span>
                  <span className="text-xs tabular-nums text-slate-400">
                    {new Date(app.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-400">{app.applicantFilename}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={detailRef} tabIndex={-1} className="space-y-6 outline-none">
        {loadingDetail && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <SpinnerIcon className="h-4 w-4" /> Loading application…
          </p>
        )}
        {detailError !== undefined && <ErrorBanner message={detailError} />}
        {selected !== null && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Candidate file</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-slate-700">{selected.applicantFilename}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Submitted</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-700">
                    {new Date(selected.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">First opened</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-700">
                    {selected.viewedAt === null
                      ? "just now"
                      : new Date(selected.viewedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </dd>
                </div>
              </dl>
              <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <summary className="cursor-pointer select-none text-xs font-medium text-slate-500">
                  Position criteria (snapshot at submission)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-600">
                  {selected.criteriaSnapshot}
                </pre>
              </details>
              <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <summary className="cursor-pointer select-none text-xs font-medium text-slate-500">
                  Resume text ({selected.resumeText.length.toLocaleString()} characters)
                </summary>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-600">
                  {selected.resumeText}
                </pre>
              </details>
            </section>

            {selectedReview !== null ? (
              <ResultsCard data={selectedReview} />
            ) : (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No stored result is attached to this application.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
