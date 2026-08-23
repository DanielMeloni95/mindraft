import "server-only";

/**
 * Small in-process limiter for expensive operations (AI calls, exports).
 *
 * It is the first line only: the durable limit is the credit ledger in
 * Postgres, which is atomic and shared across instances. This one exists
 * to stop a single tab from hammering the provider, and it is
 * intentionally simple — a fixed window per user and feature.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_KEYS = 5_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size > MAX_KEYS) windows.clear();
    windows.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: options.limit - existing.count,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimits(): void {
  windows.clear();
}
