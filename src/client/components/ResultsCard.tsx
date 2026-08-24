import type { PerCriterionScore, ReviewSuccess } from "../../shared/types";
import { formatDuration, providerLabel, VERDICT_META } from "../lib/format";
import { ConfidenceBanner } from "./Banners";

function ScoreBar({ score }: { score: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="img"
      aria-label={`Score ${score} out of 10`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, score * 10))}%` }}
      />
    </div>
  );
}

function CriterionRow({ item }: { item: PerCriterionScore }) {
  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">{item.criterion}</p>
        <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-indigo-700 ring-1 ring-inset ring-indigo-600/15">
          {item.score}/10
        </span>
      </div>
      <div className="mt-2">
        <ScoreBar score={item.score} />
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{item.justification}</p>
    </li>
  );
}

function EvidenceList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  if (items.length === 0) return null;
  const marker = tone === "positive" ? "+" : "\u2212";
  const markerColor = tone === "positive" ? "text-emerald-600" : "text-red-500";
  const titleColor = tone === "positive" ? "text-emerald-700" : "text-red-700";
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${titleColor}`}>{title}</h4>
      <ul className="mt-2.5 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-600">
            <span aria-hidden="true" className={`mt-0.5 shrink-0 font-bold ${markerColor}`}>
              {marker}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-slate-700" title={value}>
        {value}
      </dd>
    </div>
  );
}

export function ResultsCard({ data }: { data: ReviewSuccess }) {
  const verdict = VERDICT_META[data.result.overallVerdict];

  return (
    <section
      aria-label="Advisory AI assessment"
      className="animate-rise-in space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Advisory AI Assessment</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Advisory only — a human interviewer makes the actual decision.
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${verdict.badgeClasses}`}>
          {verdict.label}
        </span>
      </div>

      <ConfidenceBanner data={data} />

      <p className="text-sm leading-relaxed text-slate-700">{data.result.summary}</p>

      <div>
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Criteria breakdown ({data.result.perCriterion.length})
        </h4>
        <ul className="space-y-2.5">
          {data.result.perCriterion.map((item, i) => (
            <CriterionRow key={`${item.criterion}-${i}`} item={item} />
          ))}
        </ul>
      </div>

      {(data.result.strengths.length > 0 || data.result.concerns.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <EvidenceList title="Strengths" items={data.result.strengths} tone="positive" />
          <EvidenceList title="Concerns" items={data.result.concerns} tone="negative" />
        </div>
      )}

      {data.confidence === "high" && data.verificationIssues.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <summary className="cursor-pointer select-none text-xs font-medium text-slate-500 underline underline-offset-2">
            Verification notes ({data.verificationIssues.length})
          </summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-slate-500">
            {data.verificationIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </details>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
        <MetaItem label="Provider" value={providerLabel(data.meta.provider)} />
        <MetaItem label="Main model" value={data.meta.mainModel} />
        <MetaItem label="Verifier model" value={data.meta.verifierModel} />
        <MetaItem label="Attempts" value={String(data.attempts)} />
        <MetaItem label="Duration" value={formatDuration(data.meta.durationMs)} />
      </dl>
    </section>
  );
}
