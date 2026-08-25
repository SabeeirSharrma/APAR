import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { MAX_PDF_BYTES } from "../shared/types";
import { hashPassword } from "./auth/passwords";
import { requireRole } from "./auth/middleware";
import { pruneExpiredSessions } from "./auth/sessions";
import { runMigrations } from "./db/client";
import { adminApplicationsRoute } from "./routes/admin-applications";
import { adminPositionsRoute } from "./routes/admin-positions";
import { adminUsersRoute } from "./routes/admin-users";
import { authRoute } from "./routes/auth";
import { myApplicationsRoute } from "./routes/my-applications";
import { positionsPublicRoute } from "./routes/positions-public";
import { reviewRoute } from "./routes/review";
import { countAdmins, createUserRecord, emailExists } from "./repositories/users";

const PORT = Number(process.env.PORT ?? 3001);

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const MAX_BODY_BYTES = MAX_PDF_BYTES + MULTIPART_OVERHEAD_BYTES;

runMigrations();
await seedBootstrapAdmin();
await pruneExpiredSessions();

async function seedBootstrapAdmin(): Promise<void> {
  if ((await countAdmins()) > 0) return;
  const email = process.env.APAR_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.APAR_ADMIN_PASSWORD;
  if (email === undefined || email === "" || password === undefined || password.length < 8) {
    console.warn(
      "[apar] No admin account exists. Set APAR_ADMIN_EMAIL and APAR_ADMIN_PASSWORD " +
        "(min 8 chars) and restart to bootstrap one.",
    );
    return;
  }
  if (await emailExists(email)) {
    console.warn(`[apar] Cannot seed admin: email ${email} is already taken by another account.`);
    return;
  }
  await createUserRecord({
    role: "admin",
    name: "Administrator",
    email,
    passwordHash: await hashPassword(password),
  });
  console.log(`[apar] seeded bootstrap admin account: ${email}`);
}

const app = new Hono();

// Request logging — method, path, status, duration. Never logs bodies or keys.
app.use("*", async (c, next) => {
  const startedAt = Date.now();
  await next();
  console.log(`${c.req.method} ${c.req.path} -> ${c.res.status} (${Date.now() - startedAt}ms)`);
});

app.use(
  "/api/*",
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) =>
      c.json({ status: "error", error: { code: "INVALID_REQUEST", message: "Request body too large." } }, 413),
  }),
);

app.route("/", authRoute);
app.route("/", reviewRoute);
app.route("/", positionsPublicRoute);

app.use("/api/admin/*", requireRole("admin"));
app.route("/", adminPositionsRoute);
app.route("/", adminUsersRoute);
app.route("/", adminApplicationsRoute);

app.use("/api/my/*", requireRole("interviewer"));
app.route("/", myApplicationsRoute);

app.get("/api/health", (c) => c.json({ ok: true }));

// Unknown API paths get structured JSON 404s, not the SPA fallback.
app.get("/api/*", (c) => c.json({ status: "error", error: { code: "NOT_FOUND", message: "Unknown API route." } }, 404));

// Static client (production). Vite outputs to dist/client; `npm start` runs
// from the repo root so relative roots resolve. Missing dir is fine in dev
// (Vite serves the UI there) — serveStatic just passes through.
const clientRoot = "dist/client";
app.use("*", serveStatic({ root: clientRoot }));
// SPA fallback: any non-API GET serves the app shell.
app.get("*", serveStatic({ root: clientRoot, rewriteRequestPath: () => "/index.html" }));

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[apar] listening on http://localhost:${info.port}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
