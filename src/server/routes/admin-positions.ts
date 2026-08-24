import { Hono } from "hono";
import { PositionInputSchema } from "../../shared/types";
import { errorResponse, readJsonBody } from "../http";
import {
  createPosition,
  deletePosition,
  getPosition,
  listPositions,
  serializePosition,
  updatePosition,
} from "../repositories/positions";

/**
 * Stage-2 admin CRUD. Unprotected by design until stage 3 — anyone with
 * network access to the instance can read stored provider keys.
 */
export const adminPositionsRoute = new Hono();

adminPositionsRoute.get("/api/admin/positions", async (c) => {
  const rows = await listPositions();
  return c.json({ positions: rows.map(serializePosition) });
});

adminPositionsRoute.post("/api/admin/positions", async (c) => {
  const body = await readJsonBody(c);
  if (!body.ok) return errorResponse(c, "INVALID_REQUEST", "Request body must be JSON.");
  const parsed = PositionInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(
      c,
      "INVALID_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid position payload.",
    );
  }
  return c.json(serializePosition(await createPosition(parsed.data)));
});

adminPositionsRoute.put("/api/admin/positions/:id", async (c) => {
  const id = c.req.param("id");
  const body = await readJsonBody(c);
  if (!body.ok) return errorResponse(c, "INVALID_REQUEST", "Request body must be JSON.");
  const parsed = PositionInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(
      c,
      "INVALID_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid position payload.",
    );
  }
  const updated = await updatePosition(id, parsed.data);
  if (updated === null) {
    return errorResponse(c, "POSITION_NOT_FOUND", "This position no longer exists.");
  }
  return c.json(serializePosition(updated));
});

adminPositionsRoute.delete("/api/admin/positions/:id", async (c) => {
  const id = c.req.param("id");
  if (!(await deletePosition(id))) {
    return errorResponse(c, "POSITION_NOT_FOUND", "This position no longer exists.");
  }
  return c.json({ ok: true });
});

// Explicit 404 for other methods on the collection/item paths keeps the API
// surface honest under the SPA fallback.
adminPositionsRoute.all("/api/admin/positions/*", (c) =>
  errorResponse(c, "NOT_FOUND", "Unknown admin route."),
);
