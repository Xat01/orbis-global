// ---------------------------------------------------------------------------
// Minimal in-memory token-bucket rate limiter for API routes (per client IP).
// Sufficient for a local single-process deployment; a reverse proxy with
// proper rate limiting should front this app in any shared deployment.
// ---------------------------------------------------------------------------

const buckets = new Map<string, { tokens: number; last: number }>();

export function enforceRateLimit(
  request: Request,
  opts: { limit?: number; windowMs?: number } = {},
): Response | null {
  const limit = opts.limit ?? 120;
  const windowMs = opts.windowMs ?? 60_000;
  const refillPerMs = limit / windowMs;

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";

  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { tokens: limit, last: now };
    buckets.set(ip, bucket);
  }
  bucket.tokens = Math.min(limit, bucket.tokens + (now - bucket.last) * refillPerMs);
  bucket.last = now;

  // Opportunistic cleanup to bound memory.
  if (buckets.size > 5000) {
    for (const [key, b] of buckets) {
      if (now - b.last > windowMs * 5) buckets.delete(key);
    }
  }

  if (bucket.tokens < 1) {
    return Response.json(
      { error: "rate-limited", retryAfterMs: Math.ceil((1 - bucket.tokens) / refillPerMs) },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }
  bucket.tokens -= 1;
  return null;
}

/** Test helper. */
export function __resetRateLimiter(): void {
  buckets.clear();
}
