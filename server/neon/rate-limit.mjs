// Fixed-window rate limits stored in Neon (contract §3.2 rate_limits).
//
// One statement per hit: the upsert increments the window's counter and
// returns it, so concurrent requests never lose a count. Windows are aligned
// to multiples of windowSeconds since the epoch.

export async function hitRateLimit(db, { bucket, limit, windowSeconds, nowMs } = {}) {
  if (typeof bucket !== 'string' || !bucket || bucket.length > 128) throw new TypeError('rate-limit bucket must be 1-128 characters');
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('rate-limit limit must be a positive integer');
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) throw new TypeError('rate-limit window must be a positive integer');
  const now = Number(nowMs);
  if (!Number.isFinite(now)) throw new TypeError('rate-limit nowMs must be a number');
  const nowSeconds = Math.floor(now / 1000);
  const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const rows = await db.query(
    `INSERT INTO rate_limits (bucket, window_start, hits)
     VALUES ($1, to_timestamp($2::double precision), 1)
     ON CONFLICT (bucket, window_start) DO UPDATE SET hits = rate_limits.hits + 1
     RETURNING hits::int AS hits`,
    [bucket, String(windowStart)],
  );
  const hits = Number(rows[0]?.hits ?? 0);
  const ok = hits <= limit;
  const retryAfterSeconds = ok ? 0 : Math.max(1, windowStart + windowSeconds - nowSeconds);
  return { ok, hits, retryAfterSeconds };
}

export function rateLimitedResult(retryAfterSeconds) {
  const seconds = Math.max(1, Math.ceil(Number(retryAfterSeconds) || 1));
  return {
    status: 429,
    body: { ok: false, error: 'rate-limited' },
    headers: { 'Cache-Control': 'no-store', 'Retry-After': String(seconds) },
  };
}
