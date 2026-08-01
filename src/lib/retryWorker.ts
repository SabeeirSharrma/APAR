import { getMany, run } from '../db/index.js';
import { runPipeline, type PipelineContext } from './pipeline.js';

// ============================================================================
// Pipeline Retry Worker
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 30_000; // Check every 30 seconds

interface QueuedApplication {
  id: string;
  position_id: string;
  company_id: string;
  email: string;
  name: string;
  resume_path: string;
  supplementary_info: string | null;
  retry_count: number;
}

let retryTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Pick up queued applications and re-run the pipeline.
 * Stops retrying after MAX_RETRIES attempts.
 */
async function processRetries(): Promise<void> {
  try {
    const queued = getMany<QueuedApplication>(
      `SELECT id, position_id, company_id, email, name, resume_path, supplementary_info, retry_count
       FROM applications
       WHERE status = 'queued' AND retry_count < @maxRetries
       ORDER BY created_at ASC
       LIMIT @limit`,
      { maxRetries: MAX_RETRIES, limit: 5 },
    );

    if (queued.length === 0) return;

    console.log(`🔄 Retry worker: processing ${queued.length} queued application(s)`);

    for (const app of queued) {
      // Increment retry count
      run(
        `UPDATE applications SET retry_count = retry_count + 1, updated_at = datetime('now') WHERE id = @id`,
        { id: app.id },
      );

      const ctx: PipelineContext = {
        applicationId: app.id,
        companyId: app.company_id,
        positionId: app.position_id,
        resumePath: app.resume_path,
        applicantEmail: app.email,
        applicantName: app.name,
        supplementaryInfo: app.supplementary_info ?? undefined,
      };

      // Run pipeline — errors are caught inside runPipeline
      const result = await runPipeline(ctx);

      if (result.status === 'error') {
        console.error(`❌ Retry ${app.retry_count + 1}/${MAX_RETRIES} failed for ${app.id}: ${result.error}`);

        // If max retries reached, mark as failed (leave in queued with max retry_count)
        if (app.retry_count + 1 >= MAX_RETRIES) {
          console.error(`🚫 Max retries reached for ${app.id} — application will not be automatically retried`);
        }
      } else {
        console.log(`✅ Retry succeeded for ${app.id}`);
      }
    }
  } catch (error) {
    console.error('Retry worker error:', error);
  }
}

/**
 * Start the retry worker background interval.
 */
export function startRetryWorker(): void {
  if (retryTimer) return; // Already running
  console.log(`🔄 Pipeline retry worker started (interval: ${RETRY_INTERVAL_MS / 1000}s, max retries: ${MAX_RETRIES})`);
  retryTimer = setInterval(processRetries, RETRY_INTERVAL_MS);
}

/**
 * Stop the retry worker.
 */
export function stopRetryWorker(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
    console.log('🔄 Pipeline retry worker stopped');
  }
}

/**
 * Manually trigger a retry check (for admin use).
 */
export async function triggerRetryCheck(): Promise<number> {
  const queued = getMany<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications WHERE status = 'queued' AND retry_count < @maxRetries`,
    { maxRetries: MAX_RETRIES },
  );
  const count = queued[0]?.count ?? 0;
  if (count > 0) {
    await processRetries();
  }
  return count;
}
