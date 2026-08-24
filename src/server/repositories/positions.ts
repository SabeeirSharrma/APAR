import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { Position, PositionInput } from "../../shared/types";
import { db } from "../db/client";
import type { NewPositionRecord, PositionRecord } from "../db/schema";
import { positions } from "../db/schema";

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

export async function listPositions(): Promise<PositionRecord[]> {
  return db.select().from(positions).orderBy(asc(positions.createdAtMs));
}

export async function getPosition(id: string): Promise<PositionRecord | null> {
  const rows = await db.select().from(positions).where(eq(positions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPosition(input: PositionInput): Promise<PositionRecord> {
  const now = Date.now();
  const record: NewPositionRecord = {
    id: randomUUID(),
    ...recordFromInput(input),
    createdAtMs: now,
    updatedAtMs: now,
  };
  const inserted = await db.insert(positions).values(record).returning();
  const row = inserted[0];
  if (!row) throw new Error("position insert returned no row");
  return row;
}

export async function updatePosition(id: string, input: PositionInput): Promise<PositionRecord | null> {
  if ((await getPosition(id)) === null) return null;
  const updated = await db
    .update(positions)
    .set({ ...recordFromInput(input), updatedAtMs: Date.now() })
    .where(eq(positions.id, id))
    .returning();
  return updated[0] ?? null;
}

export async function deletePosition(id: string): Promise<boolean> {
  const result = await db.delete(positions).where(eq(positions.id, id));
  return result.changes > 0;
}

export function serializePosition(row: PositionRecord): Position {
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
    createdAt: new Date(row.createdAtMs).toISOString(),
    updatedAt: new Date(row.updatedAtMs).toISOString(),
  };
}
