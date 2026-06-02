type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, RateLimitBucket>();

function getBucket(key: string, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (current && current.resetAt > now) {
    return current;
  }

  const nextBucket = {
    count: 0,
    resetAt: now + windowMs,
  } satisfies RateLimitBucket;

  buckets.set(key, nextBucket);

  return nextBucket;
}

export function isRateLimited(key: string, options: RateLimitOptions) {
  const bucket = getBucket(key, options.windowMs);
  bucket.count += 1;

  return {
    allowed: bucket.count <= options.limit,
    resetAt: bucket.resetAt,
    remaining: Math.max(0, options.limit - bucket.count),
  };
}

export function getClientIp(req: Request | { headers?: Headers | Record<string, string | string[] | undefined> }) {
  const forwardedFor = req.headers instanceof Headers
    ? req.headers.get("x-forwarded-for")
    : typeof req.headers === "object" && req.headers
      ? (req.headers["x-forwarded-for"] ?? req.headers["X-Forwarded-For"])
      : null;

  const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const ip = typeof raw === "string" ? raw.split(",")[0]?.trim() : "";

  return ip || "unknown";
}