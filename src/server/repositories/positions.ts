import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import type { Position, PositionInput } from "../../shared/types";
import { db } from "../db/client";
import type { NewPositionRecord, PositionRecord } from "../db/schema";
import { positionPool, positions } from "../db/schema";

function recordFromInput(
  input: PositionInput,
): Omit<NewPositionRecord, "id" | "createdAtMs" | "updatedAtMs"> {
  return {
    name: input.name,
    criteria: input.criteria,
    provider: input.provider,
    openrouterApiKey: input.openrouterApiKey ?? null,
    openrouterModel: input.openrouterModel ?? null,
    ollamaEndpoint: input.ollamaEndpoint ?? null,
    ollamaModel: input.ollamaModel ?? null,
    verifierModelOverride: input.verifierModelOverride ?? null,
  };
}

async function poolIdsFor(positionId: string): Promise<string[]> {
  const rows = await db
    .select({ interviewerId: positionPool.interviewerId })
    .from(positionPool)
    .where(eq(positionPool.positionId, positionId));
  return rows.map((r) => r.interviewerId);
}

export async function listPositions(): Promise<PositionRecord[]> {
  return db.select().from(positions).orderBy(asc(positions.createdAtMs));
}

export async function getPosition(id: string): Promise<PositionRecord | null> {
  const rows = await db.select().from(positions).where(eq(positions.id, id)).limit(1);
  return rows[0] ?? null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Replaces the pool with exactly these members (caller pre-validates ids). */
function writePool(tx: Tx, positionId: string, interviewerIds: string[]): void {
  tx.delete(positionPool).where(eq(positionPool.positionId, positionId)).run();
  if (interviewerIds.length > 0) {
    // Deduplicate defensively; unique index would reject dupes otherwise.
    const unique = [...new Set(interviewerIds)];
    tx.insert(positionPool)
      .values(unique.map((interviewerId) => ({ positionId, interviewerId })))
      .run();
  }
}

export async function createPosition(input: PositionInput): Promise<Position> {
  const now = Date.now();
  const id = randomUUID();
  const record: NewPositionRecord = {
    id,
    ...recordFromInput(input),
    createdAtMs: now,
    updatedAtMs: now,
  };
  db.transaction((tx) => {
    tx.insert(positions).values(record).run();
    writePool(tx, id, input.interviewerIds);
  });
  const created = await getPosition(id);
  if (created === null) throw new Error("position insert returned no row");
  return serialize(created, [...new Set(input.interviewerIds)]);
}

export async function updatePosition(id: string, input: PositionInput): Promise<Position | null> {
  const updatedRow = db.transaction((tx) => {
    const rows = tx
      .update(positions)
      .set({ ...recordFromInput(input), updatedAtMs: Date.now() })
      .where(eq(positions.id, id))
      .returning()
      .all();
    const row = rows[0];
    if (row === undefined) return null;
    writePool(tx, id, input.interviewerIds);
    return row;
  });
  if (updatedRow === null) return null;
  return serialize(updatedRow, [...new Set(input.interviewerIds)]);
}

export async function deletePosition(id: string): Promise<boolean> {
  const result = await db.delete(positions).where(eq(positions.id, id));
  return result.changes > 0;
}

function serialize(row: PositionRecord, interviewerIds: string[]): Position {
  return {
    id: row.id,
    name: row.name,
    criteria: row.criteria,
    provider: row.provider,
    ...(row.openrouterApiKey !== null ? { openrouterApiKey: row.openrouterApiKey } : {}),
    ...(row.openrouterModel !== null ? { openrouterModel: row.openrouterModel } : {}),
    ...(row.ollamaEndpoint !== null ? { ollamaEndpoint: row.ollamaEndpoint } : {}),
    ...(row.ollamaModel !== null ? { ollamaModel: row.ollamaModel } : {}),
    ...(row.verifierModelOverride !== null
      ? { verifierModelOverride: row.verifierModelOverride }
      : {}),
    interviewerIds,
    createdAt: new Date(row.createdAtMs).toISOString(),
    updatedAt: new Date(row.updatedAtMs).toISOString(),
  };
}

export async function serializePosition(row: PositionRecord): Promise<Position> {
  return serialize(row, await poolIdsFor(row.id));
}

export async function serializePositions(rows: PositionRecord[]): Promise<Position[]> {
  const allIds = rows.map((r) => r.id);
  const poolRows =
    allIds.length > 0
      ? await db
          .select({ positionId: positionPool.positionId, interviewerId: positionPool.interviewerId })
          .from(positionPool)
          .where(inArray(positionPool.positionId, allIds))
      : [];
  const byPosition = new Map<string, string[]>();
  for (const r of poolRows) {
    const list = byPosition.get(r.positionId) ?? [];
    list.push(r.interviewerId);
    byPosition.set(r.positionId, list);
  }
  return rows.map((row) => serialize(row, byPosition.get(row.id) ?? []));
}
