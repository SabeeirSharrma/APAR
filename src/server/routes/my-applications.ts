import { Hono } from "hono";
import {
  ApplicationDetailSchema,
  ApplicationSummarySchema,
  type ApplicationSummary,
} from "../../shared/types";
import { z } from "zod";
import { errorResponse } from "../http";
import {
  getApplicationForInterviewer,
  listApplicationsForInterviewer,
} from "../repositories/applications";

const SummaryListSchema = z.object({ applications: z.array(ApplicationSummarySchema) });

export const myApplicationsRoute = new Hono();

myApplicationsRoute.get("/api/my/applications", async (c) => {
  const userId = c.get("authUser").id;
  const summaries: ApplicationSummary[] = await listApplicationsForInterviewer(userId);
  return c.json(SummaryListSchema.parse({ applications: summaries }));
});

myApplicationsRoute.get("/api/my/applications/:id", async (c) => {
  const userId = c.get("authUser").id;
  const detail = await getApplicationForInterviewer(c.req.param("id"), userId);
  if (detail === null) {
    // Not found OR not mine — same response, no existence oracle.
    return errorResponse(c, "NOT_FOUND", "Application not found.");
  }
  return c.json(ApplicationDetailSchema.parse(detail));
});
