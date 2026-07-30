import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOne, getMany, run } from '../db/index.js';
import {
  createModelClient,
  callMainModel,
  callVerificationModel,
  scoreToGrade,
  calculateOverallGrade,
  buildMainPrompt,
  type MainModelResponse,
} from './models.js';
import { encryptResult } from './encryption.js';

// ============================================================================
// Pipeline Types
// ============================================================================

export interface PipelineContext {
  applicationId: string;
  companyId: string;
  positionId: string;
  resumePath: string;
  applicantEmail: string;
  applicantName: string;
  supplementaryInfo?: string;
}

export interface PipelineResult {
  applicationId: string;
  status: 'delivered' | 'error';
  resultId?: string;
  error?: string;
  durationMs: number;
}

// ============================================================================
// Database Row Types
// ============================================================================

interface PositionRow {
  id: string;
  company_id: string;
  name: string;
  criteria: string;
}

interface CompanyRow {
  id: string;
  name: string;
}

interface InterviewerRow {
  id: string;
}

interface ModelConfigRow {
  role: string;
  provider: string;
  endpoint_url: string | null;
  api_key: string | null;
  model_name: string;
}

// ============================================================================
// Pipeline Steps (§4)
// ============================================================================

/**
 * Step 3: Auto-assign applicant to interviewer (load-balanced).
 * Assigns to the interviewer with the fewest current assignments in this position.
 */
function assignInterviewer(applicationId: string, positionId: string): string | null {
  // Find available interviewers for this position, ordered by current workload
  const interviewers = getMany<InterviewerRow>(
    `SELECT i.id
     FROM interviewers i
     JOIN interviewer_positions ip ON i.id = ip.interviewer_id
     WHERE ip.position_id = ?
     ORDER BY (
       SELECT COUNT(*) FROM applications a
       WHERE a.assigned_interviewer_id = i.id
         AND a.position_id = ?
         AND a.status NOT IN ('approved', 'rejected')
     ) ASC`,
    { positionId },
  );

  if (interviewers.length === 0) {
    console.log(`⚠️  Empty interviewer pool for position ${positionId}`);
    return null; // Empty pool — hold in queue
  }

  const assignedId = interviewers[0].id;

  run(
    `UPDATE applications SET assigned_interviewer_id = ?, updated_at = datetime('now') WHERE id = ?`,
    { interviewerId: assignedId, applicationId },
  );

  return assignedId;
}

/**
 * Step 4: Processor #1 (sender) — Read file, encode as base64.
 */
async function prepareResume(resumePath: string): Promise<string> {
  const fullPath = path.resolve(resumePath);
  const buffer = await fs.readFile(fullPath);
  return buffer.toString('base64');
}

/**
 * Step 5: Main model call — analyze resume against criteria.
 */
async function analyzeResume(
  resumeBase64: string,
  company: CompanyRow,
  position: PositionRow,
  mainConfig: ModelConfigRow,
): Promise<MainModelResponse> {
  const client = createModelClient({
    provider: mainConfig.provider as 'openrouter' | 'openai-compatible',
    endpointUrl: mainConfig.endpoint_url ?? undefined,
    apiKey: mainConfig.api_key ?? undefined,
    modelName: mainConfig.model_name,
  });

  const systemPrompt = buildMainPrompt(company.name, position.criteria);

  return callMainModel(
    client,
    {
      provider: mainConfig.provider as 'openrouter' | 'openai-compatible',
      endpointUrl: mainConfig.endpoint_url ?? undefined,
      apiKey: mainConfig.api_key ?? undefined,
      modelName: mainConfig.model_name,
    },
    systemPrompt,
    resumeBase64,
  );
}

/**
 * Step 6: Verification pass — check main model output for consistency.
 * Returns the number of verification attempts and whether it passed.
 */
async function verifyResult(
  mainResult: MainModelResponse,
  criteria: string,
  verificationConfig: ModelConfigRow,
): Promise<{ passed: boolean; attempts: number }> {
  const client = createModelClient({
    provider: verificationConfig.provider as 'openrouter' | 'openai-compatible',
    endpointUrl: verificationConfig.endpoint_url ?? undefined,
    apiKey: verificationConfig.api_key ?? undefined,
    modelName: verificationConfig.model_name,
  });

  const maxAttempts = 3;
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    attempts++;
    const verification = await callVerificationModel(
      client,
      {
        provider: verificationConfig.provider as 'openrouter' | 'openai-compatible',
        endpointUrl: verificationConfig.endpoint_url ?? undefined,
        apiKey: verificationConfig.api_key ?? undefined,
        modelName: verificationConfig.model_name,
      },
      criteria,
      mainResult,
    );

    if (verification.passed) {
      return { passed: true, attempts };
    }
  }

  return { passed: false, attempts };
}

/**
 * Step 7: Processor #2 (receiver) — Encrypt and store result.
 */
function storeResult(
  applicationId: string,
  mainResult: MainModelResponse,
  verification: { passed: boolean; attempts: number },
): string {
  const resultId = randomUUID();
  const overallGrade = calculateOverallGrade(mainResult.criteria_scores);

  // Enrich criteria scores with grades
  const enrichedScores = mainResult.criteria_scores.map((s) => ({
    ...s,
    grade: scoreToGrade(s.score),
  }));

  const resultData = {
    criteriaScores: enrichedScores,
    overallVerdict: mainResult.overall_verdict,
    overallGrade,
    summary: mainResult.summary,
    recommendation: mainResult.recommendation,
  };

  const encryptedData = encryptResult(resultData);

  run(
    `INSERT INTO results (id, application_id, encrypted_data, low_confidence, verification_attempts)
     VALUES (?, ?, ?, ?, ?)`,
    {
      resultId,
      applicationId,
      encryptedData,
      lowConfidence: verification.passed ? 0 : 1,
      verificationAttempts: verification.attempts,
    },
  );

  return resultId;
}

// ============================================================================
// Pipeline Orchestrator
// ============================================================================

/**
 * Run the full pipeline for an uploaded resume (§4).
 * Steps: assign → prepare → analyze → verify → encrypt → store → mark delivered.
 */
export async function runPipeline(ctx: PipelineContext): Promise<PipelineResult> {
  const startTime = Date.now();

  try {
    // Look up position and company
    const position = getOne<PositionRow>(
      'SELECT id, company_id, name, criteria FROM positions WHERE id = ?',
      { positionId: ctx.positionId },
    );
    if (!position) {
      throw new Error(`Position ${ctx.positionId} not found`);
    }

    const company = getOne<CompanyRow>(
      'SELECT id, name FROM companies WHERE id = ?',
      { companyId: position.company_id },
    );
    if (!company) {
      throw new Error(`Company ${position.company_id} not found`);
    }

    // Update status to processing
    run(
      `UPDATE applications SET status = 'processing', updated_at = datetime('now') WHERE id = ?`,
      { applicationId: ctx.applicationId },
    );

    // Step 3: Auto-assign to interviewer (§4 step 3)
    const assignedInterviewerId = assignInterviewer(ctx.applicationId, ctx.positionId);
    if (!assignedInterviewerId) {
      // Empty pool — hold in queue
      run(
        `UPDATE applications SET status = 'queued', updated_at = datetime('now') WHERE id = ?`,
        { applicationId: ctx.applicationId },
      );
      return {
        applicationId: ctx.applicationId,
        status: 'error',
        error: 'No interviewers available for this position',
        durationMs: Date.now() - startTime,
      };
    }

    // Step 4: Prepare resume as base64 (§4 step 4)
    const resumeBase64 = await prepareResume(ctx.resumePath);

    // Store base64 on the application record
    run(
      `UPDATE applications SET resume_base64 = ?, updated_at = datetime('now') WHERE id = ?`,
      { resumeBase64, applicationId: ctx.applicationId },
    );

    // Look up model configs
    const mainConfig = getOne<ModelConfigRow>(
      'SELECT * FROM model_provider_configs WHERE company_id = ? AND role = ?',
      { companyId: position.company_id, role: 'main' },
    );
    if (!mainConfig) {
      throw new Error('Main model provider not configured');
    }

    const verificationConfig = getOne<ModelConfigRow>(
      'SELECT * FROM model_provider_configs WHERE company_id = ? AND role = ?',
      { companyId: position.company_id, role: 'verification' },
    );
    if (!verificationConfig) {
      throw new Error('Verification model provider not configured');
    }

    // Step 5: Main model call (§4 step 5)
    const mainResult = await analyzeResume(resumeBase64, company, position, mainConfig);

    // Update status to verifying
    run(
      `UPDATE applications SET status = 'verifying', updated_at = datetime('now') WHERE id = ?`,
      { applicationId: ctx.applicationId },
    );

    // Step 6: Verification pass (§4 step 6)
    const verification = await verifyResult(mainResult, position.criteria, verificationConfig);

    // Step 7-8: Encrypt and store result (§4 step 7-8)
    const resultId = storeResult(ctx.applicationId, mainResult, verification);

    // Step 9: Mark as delivered (§4 step 9)
    run(
      `UPDATE applications SET status = 'delivered', updated_at = datetime('now') WHERE id = ?`,
      { applicationId: ctx.applicationId },
    );

    console.log(`✅ Pipeline complete for ${ctx.applicationId} in ${Date.now() - startTime}ms`);

    return {
      applicationId: ctx.applicationId,
      status: 'delivered',
      resultId,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Pipeline failed for ${ctx.applicationId}:`, errorMessage);

    // Mark as queued so it can be retried
    run(
      `UPDATE applications SET status = 'queued', updated_at = datetime('now') WHERE id = ?`,
      { applicationId: ctx.applicationId },
    );

    return {
      applicationId: ctx.applicationId,
      status: 'error',
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Get pipeline status for an application.
 */
export function getPipelineStatus(applicationId: string): {
  status: string;
  assignedInterviewerId: string | null;
  hasResult: boolean;
} | null {
  interface ApplicationStatusRow {
    id: string;
    status: string;
    assigned_interviewer_id: string | null;
  }
  const app = getOne<ApplicationStatusRow>(
    'SELECT id, status, assigned_interviewer_id FROM applications WHERE id = ?',
    { applicationId },
  );

  if (!app) return null;

  interface ResultRow { id: string; }
  const result = getOne<ResultRow>(
    'SELECT id FROM results WHERE application_id = ?',
    { applicationId },
  );

  return {
    status: app.status,
    assignedInterviewerId: app.assigned_interviewer_id,
    hasResult: !!result,
  };
}
