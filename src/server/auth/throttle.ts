/**
 * Minimal in-memory login throttle. Self-hosted single-instance scope:
 * keyed by IP, fixed window, no persistence — enough to blunt credential
 * stuffing without infrastructure.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

const failures = new Map<string, number[]>();

function prune(now: number): void {
  for (const [key, stamps] of failures) {
    const alive = stamps.filter((t) => now - t < WINDOW_MS);
    if (alive.length === 0) failures.delete(key);
    else failures.set(key, alive);
  }
}

export function isLockedOut(ip: string): boolean {
  prune(Date.now());
  const stamps = failures.get(ip);
  return stamps !== undefined && stamps.length >= MAX_FAILURES;
}

export function recordFailure(ip: string): void {
  const now = Date.now();
  prune(now);
  const stamps = failures.get(ip) ?? [];
  stamps.push(now);
  failures.set(ip, stamps);
}

export function clearFailures(ip: string): void {
  failures.delete(ip);
}

export function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
