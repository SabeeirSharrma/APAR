import type { Context } from "hono";
import { Hono } from "hono";
import { PositionInputSchema, type PositionInput } from "../../shared/types";
import { errorResponse, readJsonBody } from "../http";
import { countApplicationsForPosition } from "../repositories/applications";
import {
  createPosition,
  deletePosition,
  getPosition,
  listPositions,
  serializePosition,
  serializePositions,
  updatePosition,
} from "../repositories/positions";
import { getUser } from "../repositories/users";

export const adminPositionsRoute = new Hono();

adminPositionsRoute.get("/api/admin/positions", async (c) => {
  const rows = await listPositions();
  return c.json({ positions: await serializePositions(rows) });
});

/** Every pool id must reference an existing interviewer. */
async function validatePool(ids: string[]): Promise<string | null> {
  for (const id of ids) {
    const user = await getUser(id);
    if (user === null || user.role !== "interviewer") {
      return `Pool member "${id}" is not an existing interviewer.`;
    }
  }
  return null;
}

type ParsedPosition = { ok: true; data: PositionInput } | { ok: false; response: Response };

async function parsePositionBody(c: Context): Promise<ParsedPosition> {
  const body = await readJsonBody(c);
  if (!body.ok) {
    return { ok: false, response: errorResponse(c, "INVALID_REQUEST", "Request body must be JSON.") };
  }
  const parsed = PositionInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse(
        c,
        "INVALID_REQUEST",
        parsed.error.issues[0]?.message ?? "Invalid position payload.",
      ),
    };
  }
  const poolError = await validatePool(parsed.data.interviewerIds);
  if (poolError !== null) {
    return { ok: false, response: errorResponse(c, "INVALID_REQUEST", poolError) };
  }
  return { ok: true, data: parsed.data };
}

adminPositionsRoute.post("/api/admin/positions", async (c) => {
  const parsed = await parsePositionBody(c);
  if (!parsed.ok) return parsed.response;
  return c.json(await createPosition(parsed.data));
});

adminPositionsRoute.put("/api/admin/positions/:id", async (c) => {
  const id = c.req.param("id");
  const parsed = await parsePositionBody(c);
  if (!parsed.ok) return parsed.response;
  const updated = await updatePosition(id, parsed.data);
  if (updated === null) {
    return errorResponse(c, "POSITION_NOT_FOUND", "This position no longer exists.");
  }
  return c.json(updated);
});

adminPositionsRoute.delete("/api/admin/positions/:id", async (c) => {
  const id = c.req.param("id");
  if ((await getPosition(id)) === null) {
    return errorResponse(c, "POSITION_NOT_FOUND", "This position no longer exists.");
  }
  const applicationCount = await countApplicationsForPosition(id);
  if (applicationCount > 0) {
    return errorResponse(
      c,
      "CONFLICT",
      `This position has ${applicationCount} application${applicationCount === 1 ? "" : "s"} on record and cannot be deleted.`,
    );
  }
  await deletePosition(id);
  return c.json({ ok: true });
});

adminPositionsRoute.all("/api/admin/positions/*", (c) =>
  errorResponse(c, "NOT_FOUND", "Unknown admin route."),
);
