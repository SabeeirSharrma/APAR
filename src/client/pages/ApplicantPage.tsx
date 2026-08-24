import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { FormEvent } from "react";
import type { ReviewSuccess } from "../../shared/types";
import { ApiTransportError, listPositionSummaries, submitReview } from "../api";
import { ElapsedTimer, ErrorBanner } from "../components/Banners";
import { SpinnerIcon } from "../components/icons";
import { UploadField } from "../components/UploadField";
import { ResultsCard } from "../components/ResultsCard";

type Phase =
  | { kind: "idle" }
  | { kind: "submitting"; startedAt: number }
  | { kind: "result"; data: ReviewSuccess }
  | { kind: "error"; message: string };

type PositionsState =
  | { kind: "loading" }
  | { kind: "ready"; items: Awaited<ReturnType<typeof listPositionSummaries>> }
  | { kind: "failed"; message: string };

export default function ApplicantPage() {
  const [positions, setPositions] = useState<PositionsState>({ kind: "loading" });
  const [positionId, setPositionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [selectError, setSelectError] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const outcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listPositionSummaries()
      .then((items) => {
        if (!cancelled) setPositions({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPositions({
            kind: "failed",
            message: err instanceof Error ? err.message : "Could not load positions.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase.kind === "result" || phase.kind === "error") outcomeRef.current?.focus();
  }, [phase]);

  const handleFileSelect = useCallback((selected: File | null) => {
    setFile(selected);
    setFileError(undefined);
  }, []);

  const submitting = phase.kind === "submitting";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    const nextErrors: { file?: string; positionId?: string } = {};
    if (file === null) nextErrors.file = "Upload a resume PDF to review.";
    if (positionId === "") nextErrors.positionId = "Select a position.";
    setFileError(nextErrors.file);
    setSelectError(nextErrors.positionId);
    if (Object.keys(nextErrors).length > 0 || file === null) return;

    setPhase({ kind: "submitting", startedAt: Date.now() });
    try {
      const response = await submitReview({ file, positionId });
      if (response.status === "ok") setPhase({ kind: "result", data: response });
      else setPhase({ kind: "error", message: response.error.message });
    } catch (err) {
      setPhase({
        kind: "error",
        message:
          err instanceof ApiTransportError || err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      });
    }
  };

  const statusText =
    phase.kind === "result"
      ? "Assessment ready."
      : phase.kind === "error"
        ? `Review failed: ${phase.message}`
        : "";

  return (
    <div className="space-y-8">
      <p aria-live="polite" role="status" className="sr-only">
        {statusText}
      </p>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 className="sr-only">Apply</h2>

        {positions.kind === "loading" && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <SpinnerIcon className="h-4 w-4" /> Loading positions…
          </p>
        )}

        {positions.kind === "failed" && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {positions.message}
          </div>
        )}

        {positions.kind === "ready" && positions.items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-6 text-center">
            <p className="text-sm font-medium text-slate-600">No open positions yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              An administrator needs to create a position before applications can be reviewed.
            </p>
            <Link
              to="/admin"
              className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Go to admin setup
            </Link>
          </div>
        )}

        {positions.kind === "ready" && positions.items.length > 0 && (
          <>
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-slate-700">
                Position
              </label>
              <select
                id="position"
                value={positionId}
                disabled={submitting}
                onChange={(e) => {
                  setPositionId(e.target.value);
                  setSelectError(undefined);
                }}
                aria-invalid={selectError !== undefined}
                className={`mt-1 block w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
                  selectError !== undefined
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
                }`}
              >
                <option value="" disabled>
                  Select the position you are applying for…
                </option>
                {positions.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selectError !== undefined && (
                <p role="alert" className="mt-1.5 text-sm text-red-600">
                  {selectError}
                </p>
              )}
            </div>

            <UploadField
              file={file}
              disabled={submitting}
              onSelect={handleFileSelect}
              error={fileError}
              onErrorChange={(msg) => setFileError(msg ?? undefined)}
            />

            <div className="border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={submitting || file === null || positionId === ""}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {submitting ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    <ElapsedTimer startedAt={phase.startedAt} />
                  </>
                ) : (
                  "Submit application"
                )}
              </button>

              <p className="mt-2 text-center text-xs text-slate-400">
                The AI runs a verification pass and may retry up to 3 times — this can take a few minutes.
              </p>
              <p className="mt-1 text-center text-xs text-slate-400">
                Your resume is sent only to the AI provider configured for this position. Nothing is stored by APAR.
              </p>
            </div>
          </>
        )}
      </form>

      <div ref={outcomeRef} tabIndex={-1} className="space-y-8 outline-none">
        {phase.kind === "error" && <ErrorBanner message={phase.message} />}
        {phase.kind === "result" && <ResultsCard data={phase.data} />}
      </div>
    </div>
  );
}
