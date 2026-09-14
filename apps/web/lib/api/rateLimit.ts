import { ApiError } from "@smart-ai/core/utils/ApiError";
import { env } from "@smart-ai/core/config/env";

/**
 * In-memory stopgap limiter — per-warm-instance only, not durable across
 * cold starts or multiple regions. Matches the old express-rate-limit
 * buckets/messages; swap for Upstash Redis (see migration plan Phase 6)
 * once real distributed limiting matters.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Buckets IPv6 clients by /64 prefix so a user can't dodge limits by rotating within their block. */
function ipBucket(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  if (!ip) return "anonymous";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 4).join(":")}::`;
  return ip;
}

export function checkGlobalRateLimit(req: Request): void {
  const key = `global:${ipBucket(req)}`;
  const ok = hit(key, env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  if (!ok) throw ApiError.tooManyRequests("Too many requests. Please slow down and try again shortly.");
}

export function checkGenerationRateLimit(req: Request, firebaseUid?: string): void {
  const key = `generation:${firebaseUid ?? ipBucket(req)}`;
  const ok = hit(key, env.GENERATION_RATE_LIMIT_MAX, 60 * 60 * 1000);
  if (!ok) throw ApiError.tooManyRequests("Generation limit reached for this hour. Please try again later.");
}

export function checkChatRateLimit(req: Request, firebaseUid?: string): void {
  const key = `chat:${firebaseUid ?? ipBucket(req)}`;
  const ok = hit(key, 120, 60 * 60 * 1000);
  if (!ok) throw ApiError.tooManyRequests("The tutor needs a short break — try again in a little while.");
}
