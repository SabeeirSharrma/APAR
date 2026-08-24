import { Hono } from "hono";
import { listPositions } from "../repositories/positions";

/** Public surface for applicants — deliberately exposes only id + name. */
export const positionsPublicRoute = new Hono();

positionsPublicRoute.get("/api/positions", async (c) => {
  const items = (await listPositions()).map((p) => ({ id: p.id, name: p.name }));
  return c.json({ positions: items });
});
