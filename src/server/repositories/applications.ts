import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  APPLICATION_STATUSES,
  type ApplicationDetail,
  type ApplicationStatus,
  type ApplicationSummary,
  type StoredResult,
} from "../../shared/types";
import { db } from "../db/client";
import type { ApplicationRecord, ResultRecord, UserRecord } from "../db/schema";
import { applications, positionPool, positions, results, users } from "../db/schema";

// ---------------------------------------------------------------------------
// Auto-assignment: least-loaded active member of the position's pool
// ---------------------------------------------------------------------------

export async function pickAssignee(positionId: string): Promise<UserRecord | null> {
  const pool = await db
    .select({ user: users })
    .from(positionPool)
    .innerJoin(users, eq(positionPool.interviewerId, users.id))
    .where(and(eq(positionPool.positionId, positionId), eq(users.active, true)));
  if (pool.length === 0) return null;

  const loadRows = await db
    .select({ userId: applications.assignedUserId, n: applications.id })
    .from(applications)
    .where(eq(applications.positionId, positionId));
  const loads = new Map<string, number>();
  for (const row of loadRows) {
    if (row.userId === null) continue;
    loads.set(row.userId, (loads.get(row.userId) ?? 0) + 1);
  }

  return pool.reduce((best, cur) => {
    const bestLoad = loads.get(best.user.id) ?? 0;
    const curLoad = loads.get(cur.user.id) ?? 0;
    if (curLoad !== bestLoad) return curLoad < bestLoad ? cur : best;
    // Tie-break: longest-waiting roster member first.
    return cur.user.createdAtMs < best.user.createdAtMs ? cur : best;
  }).user;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface PersistReviewArgs {
  positionId: string;
  criteriaSnapshot: string;
  filename: string;
  pdfBytes: Buffer;
  resumeText: string;
  outcome: {
    overallVerdict: StoredResult["overallVerdict"];
    summary: string;
    perCriterion: StoredResult["perCriterion"];
    strengths: string[];
    concerns: string[];
    confidence: "high" | "low";
    attempts: number;
    verificationIssues: string[];
  };
  meta: { provider: "openrouter" | "ollama"; mainModel: string; verifierModel: string; durationMs: number };
}

export interface PersistedApplicationInfo {
  applicationId: string;
  status: ApplicationStatus;
  assignedTo: { id: string; name: string } | null;
}

export async function persistApplicationWithResult(
  args: PersistReviewArgs,
): Promise<PersistedApplicationInfo> {
  const assignee = await pickAssignee(args.positionId);
  const now = Date.now();
  const applicationId = randomUUID();

  // better-sqlite3 transactions are synchronous; drizzle builders run via .run().
  db.transaction((tx) => {
    tx.insert(applications)
      .values({
        id: applicationId,
        positionId: args.positionId,
        applicantFilename: args.filename,
        resumePdf: args.pdfBytes,
        resumeText: args.resumeText,
        criteriaSnapshot: args.criteriaSnapshot,
        status: assignee === null ? "queued" : "assigned",
        assignedUserId: assignee?.id ?? null,
        assignedAtMs: assignee === null ? null : now,
        createdAtMs: now,
      })
      .run();
    tx.insert(results)
      .values({
        applicationId,
        overallVerdict: args.outcome.overallVerdict,
        summary: args.outcome.summary,
        perCriterionJson: JSON.stringify(args.outcome.perCriterion),
        strengthsJson: JSON.stringify(args.outcome.strengths),
        concernsJson: JSON.stringify(args.outcome.concerns),
        confidence: args.outcome.confidence,
        attempts: args.outcome.attempts,
        verificationIssuesJson: JSON.stringify(args.outcome.verificationIssues),
        provider: args.meta.provider,
        mainModel: args.meta.mainModel,
        verifierModel: args.meta.verifierModel,
        durationMs: args.meta.durationMs,
        resultCreatedAtMs: now,
      })
      .run();
  });

  return {
    applicationId,
    status: assignee === null ? "queued" : "assigned",
    assignedTo: assignee === null ? null : { id: assignee.id, name: assignee.name },
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

export function serializeSummary(
  app: ApplicationRecord,
  positionName: string,
  assignee: { id: string; name: string } | null,
  result: ResultRecord | null,
): ApplicationSummary {
  return {
    id: app.id,
    positionId: app.positionId,
    positionName,
    status: app.status,
    applicantFilename: app.applicantFilename,
    createdAt: new Date(app.createdAtMs).toISOString(),
    assignedTo: assignee,
    verdict: result?.overallVerdict ?? null,
    confidence: result?.confidence ?? null,
  };
}

export function serializeDetail(
  app: ApplicationRecord,
  positionName: string,
  assignee: { id: string; name: string } | null,
  result: ResultRecord | null,
): ApplicationDetail {
  return {
    ...serializeSummary(app, positionName, assignee, result),
    criteriaSnapshot: app.criteriaSnapshot,
    resumeText: app.resumeText,
    viewedAt: iso(app.viewedAtMs),
    result:
      result === null
        ? null
        : {
            overallVerdict: result.overallVerdict,
            summary: result.summary,
            perCriterion: JSON.parse(result.perCriterionJson) as StoredResult["perCriterion"],
            strengths: JSON.parse(result.strengthsJson) as string[],
            concerns: JSON.parse(result.concernsJson) as string[],
            confidence: result.confidence,
            attempts: result.attempts,
            verificationIssues: JSON.parse(result.verificationIssuesJson) as string[],
            provider: result.provider,
            mainModel: result.mainModel,
            verifierModel: result.verifierModel,
            durationMs: result.durationMs,
          },
  };
}

interface JoinedRow {
  app: ApplicationRecord;
  positionName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  result: ResultRecord | null;
}

const baseSelect = () =>
  db
    .select({
      app: applications,
      positionName: positions.name,
      assigneeId: users.id,
      assigneeName: users.name,
      result: results,
    })
    .from(applications)
    .innerJoin(positions, eq(applications.positionId, positions.id))
    .leftJoin(users, eq(applications.assignedUserId, users.id))
    .leftJoin(results, eq(results.applicationId, applications.id));

export async function listApplicationsForAdmin(status?: ApplicationStatus): Promise<ApplicationSummary[]> {
  const rows: JoinedRow[] =
    status === undefined
      ? await baseSelect().orderBy(desc(applications.createdAtMs))
      : await baseSelect().where(eq(applications.status, status)).orderBy(desc(applications.createdAtMs));
  return rows.map((r) =>
    serializeSummary(r.app, r.positionName, r.assigneeId && r.assigneeName ? { id: r.assigneeId, name: r.assigneeName } : null, r.result),
  );
}

export async function listApplicationsForInterviewer(userId: string): Promise<ApplicationSummary[]> {
  const rows = await baseSelect()
    .where(eq(applications.assignedUserId, userId))
    .orderBy(desc(applications.createdAtMs));
  return rows.map((r) =>
    serializeSummary(r.app, r.positionName, r.assigneeId && r.assigneeName ? { id: r.assigneeId, name: r.assigneeName } : null, r.result),
  );
}

export async function getApplicationForInterviewer(
  applicationId: string,
  userId: string,
): Promise<ApplicationDetail | null> {
  const rows = await baseSelect()
    .where(and(eq(applications.id, applicationId), eq(applications.assignedUserId, userId)))
    .limit(1);
  const row = rows[0];
  if (row === undefined) return null;
  const assignee =
    row.assigneeId !== null && row.assigneeName !== null
      ? { id: row.assigneeId, name: row.assigneeName }
      : null;
  if (row.app.viewedAtMs === null) {
    await db.update(applications).set({ viewedAtMs: Date.now() }).where(eq(applications.id, applicationId));
    row.app.viewedAtMs = Date.now();
  }
  return serializeDetail(row.app, row.positionName, assignee, row.result);
}

export async function countApplicationsForUser(userId: string): Promise<number> {
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.assignedUserId, userId));
  return rows.length;
}

export async function countApplicationsForPosition(positionId: string): Promise<number> {
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.positionId, positionId));
  return rows.length;
}

export function parseStatusParam(value: string | undefined): ApplicationStatus | undefined | "invalid" {
  if (value === undefined) return undefined;
  return (APPLICATION_STATUSES as readonly string[]).includes(value)
    ? (value as ApplicationStatus)
    : "invalid";
}
