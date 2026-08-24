import {
  MAX_ATTEMPTS,
  MainModelOutputSchema,
  VerificationOutputSchema,
  type MainModelOutput,
  type ResolvedProviderConfig,
} from "../shared/types";
import type { z } from "zod";
import { PipelineError } from "./errors";
import { chatCompletion } from "./providers/openai-compat";
import { MAIN_SYSTEM_PROMPT, mainUserPrompt, VERIFIER_SYSTEM_PROMPT, verifierUserPrompt } from "./prompts";

const MAIN_CALL_TIMEOUT_MS = 120_000;
const VERIFIER_CALL_TIMEOUT_MS = 60_000;

export interface ReviewRunResult {
  result: MainModelOutput;
  confidence: "high" | "low";
  attempts: number;
  verificationIssues: string[];
}

/**
 * Extracts the first balanced JSON object from raw model output,
 * tolerating markdown fences and surrounding prose.
 */
export function extractJsonObject(raw: string): unknown {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();

  const start = s.indexOf("{");
  if (start === -1) throw new Error("no JSON object found");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s.charAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1)) as unknown;
    }
  }
  throw new Error("unbalanced JSON object");
}

function tryParseModelJson<T>(raw: string, schema: z.ZodType<T>): T | null {
  try {
    const obj = extractJsonObject(raw);
    const parsed = schema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Stage-1 pipeline per spec:
 *   main model scores the resume -> independent verification pass by a second
 *   model -> on inconsistency flag re-run the main model, capped at
 *   MAX_ATTEMPTS -> still inconsistent after the cap => deliver with a
 *   low-confidence disclaimer.
 *
 * Error policy:
 * - Provider failures on the MAIN call propagate immediately (the user must
 *   see provider outages/timeouts, not a silently degraded result).
 * - A failing verification pass is recorded as an issue; while attempts
 *   remain, the loop continues so a verifiable result can still be produced.
 *   If no verification ever succeeds across all attempts, the delivered
 *   result is marked low-confidence.
 */
export async function runReview(
  resumeText: string,
  criteria: string,
  cfg: ResolvedProviderConfig,
): Promise<ReviewRunResult> {
  const verificationIssues: string[] = [];
  let lastParsedOutput: MainModelOutput | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // --- Main scoring call ---
    const rawMain = await chatCompletion(
      cfg,
      cfg.mainModel,
      [
        { role: "system", content: MAIN_SYSTEM_PROMPT },
        { role: "user", content: mainUserPrompt(criteria, resumeText) },
      ],
      { timeoutMs: MAIN_CALL_TIMEOUT_MS },
    );

    const mainOut = tryParseModelJson(rawMain, MainModelOutputSchema);
    if (!mainOut) {
      verificationIssues.push(`Attempt ${attempt}: main model produced invalid or unparseable output.`);
      continue;
    }
    lastParsedOutput = mainOut;

    // --- Verification pass ---
    let verRaw: string | null = null;
    try {
      verRaw = await chatCompletion(
        cfg,
        cfg.verifierModel,
        [
          { role: "system", content: VERIFIER_SYSTEM_PROMPT },
          { role: "user", content: verifierUserPrompt(criteria, resumeText, JSON.stringify(mainOut)) },
        ],
        { timeoutMs: VERIFIER_CALL_TIMEOUT_MS, temperature: 0 },
      );
    } catch (err) {
      const detail = err instanceof PipelineError ? `${err.code.toLowerCase()}` : "unknown error";
      verificationIssues.push(`Attempt ${attempt}: verification pass could not complete (${detail}).`);
    }

    if (verRaw !== null) {
      const verOut = tryParseModelJson(verRaw, VerificationOutputSchema);
      if (!verOut) {
        verificationIssues.push(`Attempt ${attempt}: verification response was unparseable.`);
      } else if (verOut.consistent) {
        return { result: mainOut, confidence: "high", attempts: attempt, verificationIssues };
      } else {
        for (const issue of verOut.issues) {
          verificationIssues.push(`Attempt ${attempt}: ${issue}`);
        }
        if (verOut.issues.length === 0) {
          verificationIssues.push(`Attempt ${attempt}: flagged inconsistent without specifics.`);
        }
      }
    }
    // Inconsistent or unverified -> next attempt.
  }

  if (!lastParsedOutput) {
    throw new PipelineError(
      "PROVIDER_ERROR",
      `The model repeatedly returned output that could not be parsed after ${MAX_ATTEMPTS} attempts.`,
    );
  }
  return {
    result: lastParsedOutput,
    confidence: "low",
    attempts: MAX_ATTEMPTS,
    verificationIssues,
  };
}
