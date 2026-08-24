import { useEffect, useState } from "react";
import type { ReviewSuccess } from "../../shared/types";
import { formatElapsed } from "../lib/format";
import { AlertIcon } from "./icons";

/** Live elapsed timer shown while a review runs (can take minutes). */
export function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="tabular-nums font-medium text-indigo-700">
      Reviewing… {formatElapsed(Math.max(0, Math.floor((now - startedAt) / 1000)))}
    </span>
  );
}

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="animate-rise-in flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-red-800"
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <div>
        <p className="text-sm font-semibold">Review failed</p>
        <p className="mt-0.5 text-sm text-red-700">{message}</p>
        <p className="mt-1 text-xs text-red-500/90">Your form was kept intact — adjust the inputs and try again.</p>
      </div>
    </div>
  );
}

interface ConfidenceBannerProps {
  data: ReviewSuccess;
}

/**
 * Spec stage 1: when the assessment is still inconsistent after the retry
 * cap, it ships with an explicit low-confidence disclaimer.
 */
export function ConfidenceBanner({ data }: ConfidenceBannerProps) {
  if (data.confidence !== "low") return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-amber-900">
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      <div>
        <p className="text-sm font-semibold">Low confidence — treat as advisory only</p>
        <p className="mt-0.5 text-sm text-amber-800">
          This assessment failed internal consistency verification after {data.attempts} attempt
          {data.attempts === 1 ? "" : "s"}. A second model could not confirm that the scores and justifications are
          grounded in the resume.
        </p>
        {data.verificationIssues.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-xs font-medium text-amber-700 underline underline-offset-2">
              What the verification pass flagged ({data.verificationIssues.length})
            </summary>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-amber-700">
              {data.verificationIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
