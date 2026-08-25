import { Hono } from "hono";
import {
  ApplicationSummarySchema,
  type ApplicationSummary,
} from "../../shared/types";
import { z } from "zod";
import { errorResponse } from "../http";
import { listApplicationsForAdmin, parseStatusParam } from "../repositories/applications";

const SummaryListSchema = z.object({ applications: z.array(ApplicationSummarySchema) });

export const adminApplicationsRoute = new Hono();

adminApplicationsRoute.get("/api/admin/applications", async (c) => {
  const status = parseStatusParam(c.req.query("status"));
  if (status === "invalid") {
    return errorResponse(c, "INVALID_REQUEST", "Unknown status filter.");
  }
  const summaries: ApplicationSummary[] = await listApplicationsForAdmin(status);
  return c.json(SummaryListSchema.parse({ applications: summaries }));
});
