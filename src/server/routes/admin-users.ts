import { Hono } from "hono";
import { RosterInputSchema, UserSchema, type User } from "../../shared/types";
import { hashPassword } from "../auth/passwords";
import { errorResponse } from "../http";
import {
  countApplicationsAssignedTo,
  createUserRecord,
  deleteUserRecord,
  emailExists,
  getUser,
  getUserByEmail,
  listUsers,
  updateUserRecord,
} from "../repositories/users";

export const adminUsersRoute = new Hono();

function serializeUser(row: { id: string; role: "admin" | "interviewer"; name: string; email: string; active: boolean; createdAtMs: number }): User {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    active: row.active,
    createdAt: new Date(row.createdAtMs).toISOString(),
  };
}

adminUsersRoute.get("/api/admin/users", async (c) => {
  const role = c.req.query("role");
  const filter = role === "admin" || role === "interviewer" ? role : undefined;
  const rows = await listUsers(filter);
  return c.json({ users: rows.map(serializeUser) });
});

// Stage 3 roster = interviewers only; admins bootstrap via env (documented).
adminUsersRoute.post("/api/admin/users", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = RosterInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      c,
      "INVALID_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid roster payload.",
    );
  }
  if (parsed.data.password === "") {
    return errorResponse(c, "INVALID_REQUEST", "Password is required for new interviewers.");
  }
  if (await emailExists(parsed.data.email)) {
    return errorResponse(c, "CONFLICT", "That email is already in use.");
  }
  const created = await createUserRecord({
    role: "interviewer",
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
  });
  return c.json(serializeUser(created));
});

adminUsersRoute.put("/api/admin/users/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await getUser(id);
  if (existing === null || existing.role !== "interviewer") {
    return errorResponse(c, "NOT_FOUND", "Interviewer not found.");
  }
  const body = await c.req.json().catch(() => null);
  const parsed = RosterInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      c,
      "INVALID_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid roster payload.",
    );
  }
  const input = parsed.data;
  if (
    input.email !== existing.email &&
    (await getUserByEmail(input.email)) !== null
  ) {
    return errorResponse(c, "CONFLICT", "That email is already in use.");
  }
  const updated = await updateUserRecord(id, {
    name: input.name,
    email: input.email,
    active: input.active,
    ...(input.password !== "" ? { passwordHash: await hashPassword(input.password) } : {}),
  });
  if (updated === null) return errorResponse(c, "NOT_FOUND", "Interviewer not found.");
  return c.json(serializeUser(updated));
});

adminUsersRoute.delete("/api/admin/users/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await getUser(id);
  if (existing === null || existing.role !== "interviewer") {
    return errorResponse(c, "NOT_FOUND", "Interviewer not found.");
  }
  const assignedCount = await countApplicationsAssignedTo(id);
  if (assignedCount > 0) {
    return errorResponse(
      c,
      "CONFLICT",
      `This interviewer has ${assignedCount} assigned application${assignedCount === 1 ? "" : "s"}. Deactivate the account instead of deleting it.`,
    );
  }
  await deleteUserRecord(id);
  return c.json({ ok: true });
});
