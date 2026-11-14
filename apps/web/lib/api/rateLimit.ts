import { ApiError } from "@smart-ai/core/utils/ApiError";
import { env } from "@smart-ai/core/config/env";
import { logger } from "@smart-ai/core/utils/logger";

/**
 * Fixed-window rate limiting.
 *
 * Counters live in Upstash Redis when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set — that is what makes a limit hold across
 * serverless instances and regions. Without them (local development, or a
 * deployment that hasn't provisioned Redis yet) counters fall back to this
 * process's memory, which only limits traffic that happens to land on the same
 * warm instance. A Redis outage also falls back to memory rather than taking
 * the API down with it.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

interface Verdict {
  allowed: boolean;
  retryAfterSec: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

function hitMemory(key: string, limit: number, windowMs: number): Verdict {
  const now = Date.now();
  // Keep the map bounded: one entry per client would otherwise grow forever.
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
let redisWarned = false;

async function hitRedis(key: string, limit: number, windowMs: number): Promise<Verdict | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        // NX: only the first hit of a window starts its clock.
        ["PEXPIRE", key, windowMs, "NX"],
        ["PTTL", key],
      ]),
      // A slow limiter must never become the slowest part of a request.
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const [incr, , pttl] = (await res.json()) as { result?: number; error?: string }[];
    if (typeof incr?.result !== "number") throw new Error(incr?.error ?? "unexpected reply");
    const ttlMs = typeof pttl?.result === "number" && pttl.result > 0 ? pttl.result : windowMs;
    return { allowed: incr.result <= limit, retryAfterSec: Math.max(1, Math.ceil(ttlMs / 1000)) };
  } catch (error) {
    if (!redisWarned) {
      redisWarned = true;
      logger.warn("Rate-limit store unreachable — falling back to in-memory counters", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

async function enforce(key: string, limit: number, windowMs: number, message: string): Promise<void> {
  const namespaced = `rl:${key}`;
  const verdict = (await hitRedis(namespaced, limit, windowMs)) ?? hitMemory(namespaced, limit, windowMs);
  if (!verdict.allowed) {
    throw new ApiError(429, message, { retryAfterSec: verdict.retryAfterSec });
  }
}

/**
 * The caller's address, bucketing IPv6 by /64 so a client can't dodge limits by
 * rotating within its own block. Platform-set headers are preferred: a plain
 * `x-forwarded-for` can carry values the client typed in themselves.
 */
export function clientIp(req: Request): string {
  const ip =
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return "anonymous";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 4).join(":")}::`;
  return ip;
}

/** Every API request, per address. Applied by `apiHandler`, so no route can forget it. */
export function checkGlobalRateLimit(req: Request): Promise<void> {
  return enforce(
    `global:${clientIp(req)}`,
    env.RATE_LIMIT_MAX,
    env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    "Too many requests. Please slow down and try again shortly."
  );
}

/** Expensive AI/media generation, per account. */
export function checkGenerationRateLimit(req: Request, firebaseUid?: string): Promise<void> {
  return enforce(
    `generation:${firebaseUid ?? clientIp(req)}`,
    env.GENERATION_RATE_LIMIT_MAX,
    60 * 60 * 1000,
    "Generation limit reached for this hour. Please try again later."
  );
}

/** Short AI calls (tutor, crossover, mistake hunt, research explain), per account. */
export function checkChatRateLimit(req: Request, firebaseUid?: string): Promise<void> {
  return enforce(
    `chat:${firebaseUid ?? clientIp(req)}`,
    120,
    60 * 60 * 1000,
    "The tutor needs a short break — try again in a little while."
  );
}

/** Upload authorisations, per address — each one can put 20MB into storage. */
export function checkUploadRateLimit(req: Request): Promise<void> {
  return enforce(`upload:${clientIp(req)}`, 30, 60 * 60 * 1000, "Too many uploads. Please try again later.");
}

/** Requests that fail authentication, per address — slows token guessing and scanners. */
export function checkAuthFailureRateLimit(req: Request): Promise<void> {
  return enforce(
    `authfail:${clientIp(req)}`,
    40,
    15 * 60 * 1000,
    "Too many failed sign-in attempts from this network. Please try again later."
  );
}
