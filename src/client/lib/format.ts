import type { OverallVerdict, Provider } from "../../shared/types";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  return rest === 0 ? `${m}m` : `${m}m ${rest}s`;
}

export function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function providerLabel(provider: Provider): string {
  return provider === "openrouter" ? "OpenRouter" : "Ollama";
}

export interface VerdictStyle {
  label: string;
  badgeClasses: string;
}

export const VERDICT_META: Record<OverallVerdict, VerdictStyle> = {
  strong_match: {
    label: "Strong match",
    badgeClasses: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/25",
  },
  partial_match: {
    label: "Partial match",
    badgeClasses: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/25",
  },
  not_a_match: {
    label: "Not a match",
    badgeClasses: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/25",
  },
};
