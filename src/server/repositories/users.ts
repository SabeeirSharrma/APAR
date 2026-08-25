import { and, eq } from "drizzle-orm";
import { applications } from "../db/schema";
import { db } from "../db/client";
import type { NewUserRecord, UserRecord } from "../db/schema";
import { users } from "../db/schema";

export async function countAdmins(): Promise<number> {
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return admins.length;
}

export async function emailExists(email: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return rows.length > 0;
}

export async function listUsers(role?: "admin" | "interviewer"): Promise<UserRecord[]> {
  const rows =
    role !== undefined
      ? await db.select().from(users).where(eq(users.role, role))
      : await db.select().from(users);
  return [...rows].sort((a, b) => a.createdAtMs - b.createdAtMs || a.name.localeCompare(b.name));
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export interface CreateUserArgs {
  role: "admin" | "interviewer";
  name: string;
  email: string;
  passwordHash: string;
}

export async function createUserRecord(args: CreateUserArgs): Promise<UserRecord> {
  const record: NewUserRecord = {
    id: crypto.randomUUID(),
    role: args.role,
    name: args.name,
    email: args.email,
    passwordHash: args.passwordHash,
    active: true,
    createdAtMs: Date.now(),
  };
  const inserted = await db.insert(users).values(record).returning();
  const row = inserted[0];
  if (!row) throw new Error("user insert returned no row");
  return row;
}

export interface UpdateUserArgs {
  name?: string;
  email?: string;
  active?: boolean;
  passwordHash?: string;
}

export async function updateUserRecord(id: string, args: UpdateUserArgs): Promise<UserRecord | null> {
  if ((await getUser(id)) === null) return null;
  const updated = await db
    .update(users)
    .set({
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.email !== undefined ? { email: args.email } : {}),
      ...(args.active !== undefined ? { active: args.active } : {}),
      ...(args.passwordHash !== undefined ? { passwordHash: args.passwordHash } : {}),
    })
    .where(eq(users.id, id))
    .returning();
  return updated[0] ?? null;
}

/** Hard delete; caller is responsible for reference checks. */
export async function deleteUserRecord(id: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.id, id));
  return result.changes > 0;
}

export async function countApplicationsAssignedTo(userId: string): Promise<number> {
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.assignedUserId, userId)));
  return rows.length;
}
