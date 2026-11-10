import "server-only";

/**
 * A small fixed-window limiter, held in this process.
 *
 * One app container runs the site, so per-process counting is the real
 * thing here rather than an approximation. Two honest limits: the counts
 * reset if the container restarts, and a second container would double the
 * allowance. Move this to Postgres or Redis before scaling out.
 *
 * It exists because `/api/account/find` takes a mobile number and an order
 * number, and order numbers come from a sequence starting at 1001 — so
 * without a limit, anyone holding a phone number could walk the range and
 * land on that customer's address.
 */
type Hit = { n: number; resetAt: number };

const buckets = new Map<string, Hit>();

/** Keeps the map from growing without bound on a long-lived process. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export type Limit = { ok: boolean; retryAfter: number };

export function rateLimit(key: string, max: number, windowMs: number): Limit {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  hit.n += 1;
  if (hit.n > max) return { ok: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

/** Forgets a key — call after a success, so a real guest isn't punished for typos. */
export function rateLimitClear(key: string) {
  buckets.delete(key);
}

/**
 * Best-effort client address. Behind Caddy the real one is in
 * `x-forwarded-for`; the left-most entry is the client, the rest are proxies.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
