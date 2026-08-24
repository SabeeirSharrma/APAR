/** Prompt templates for the stage-1 review pipeline. */

// Resume text sent to each call is capped so huge CVs don't blow context
// windows on smaller/local models.
export const MAIN_RESUME_MAX_CHARS = 60_000;
export const VERIFIER_RESUME_MAX_CHARS = 40_000;

function truncateResume(resumeText: string, maxChars: number): string {
  if (resumeText.length <= maxChars) return resumeText;
  return `${resumeText.slice(0, maxChars)}\n\n[...resume truncated due to length]`;
}

// ---------------------------------------------------------------------------
// Main scoring call
// ---------------------------------------------------------------------------

export const MAIN_SYSTEM_PROMPT = `You are a senior technical recruiter assessing a candidate's resume against explicitly stated hiring criteria.

Rules:
- Evaluate ONLY the stated criteria. Never invent or imply additional requirements.
- Score every criterion individually on a 0-10 scale based strictly on evidence found in the resume.
- Ground every justification in specific resume content (roles, projects, skills, tenure). Quote or closely paraphrase the evidence.
- Derive overallVerdict from the criterion scores: average >= 7 => "strong_match"; average >= 4 => "partial_match"; otherwise "not_a_match".
- "strengths" and "concerns" must each list at least one concise item drawn from the resume.
- If the resume gives no information relevant to a criterion, score it low and say what was missing.

Respond with STRICT JSON only — no markdown fences, no commentary. Exact shape:
{
  "overallVerdict": "strong_match" | "partial_match" | "not_a_match",
  "summary": "<2-4 sentence overall assessment>",
  "perCriterion": [{ "criterion": "<criterion text>", "score": <0-10>, "justification": "<evidence-grounded reasoning>" }],
  "strengths": ["..."],
  "concerns": ["..."]
}`;

export function mainUserPrompt(criteria: string, resumeText: string): string {
  return `## Job Criteria
${criteria}

## Candidate Resume
${truncateResume(resumeText, MAIN_RESUME_MAX_CHARS)}

Assess this candidate against every criterion above. Respond with JSON only, exactly matching the required schema.`;
}

// ---------------------------------------------------------------------------
// Verification pass (second, smaller model)
// ---------------------------------------------------------------------------

export const VERIFIER_SYSTEM_PROMPT = `You are a meticulous QA auditor performing an adversarial consistency check on an AI-generated candidate assessment. You did NOT produce this assessment — your job is to find flaws in it.

Check exactly these four things:
1. COVERAGE: every criterion listed appears in perCriterion exactly once — none missing, none duplicated, none renamed.
2. GROUNDING: every justification cites evidence plausibly present in the resume. Flag fabricated employers, dates, certifications, skills, or metrics.
3. CALIBRATION: overallVerdict matches the score bands (average score >= 7 => strong_match; average >= 4 => partial_match; otherwise not_a_match).
4. ACCURACY: the summary contains no claim contradicted by the resume, the criteria, or the per-criterion justifications.

Respond with STRICT JSON only — no markdown fences, no commentary. Exact shape:
{ "consistent": <boolean>, "issues": ["<one short actionable sentence per flaw>"] }
Use an empty issues array only when fully consistent.`;

export function verifierUserPrompt(criteria: string, resumeText: string, assessmentJson: string): string {
  return `## Job Criteria
${criteria}

## Candidate Resume
${truncateResume(resumeText, VERIFIER_RESUME_MAX_CHARS)}

## Assessment Under Review
${assessmentJson}

Audit this assessment against the criteria and the resume. Respond with JSON only, exactly matching: {"consistent": boolean, "issues": [string]}`;
}
