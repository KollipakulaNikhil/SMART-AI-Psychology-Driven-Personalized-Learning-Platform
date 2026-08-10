import rateLimit from "express-rate-limit";
import { env } from "../config/env";

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

/** Buckets IPv6 clients by /64 prefix so a user can't dodge limits by rotating within their block. */
function ipBucket(ip: string | undefined): string {
  if (!ip) return "anonymous";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 4).join(":")}::`;
  return ip;
}

/** Applied to every /api route. */
export const globalRateLimiter = rateLimit({
  windowMs,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down and try again shortly." },
});

/** Stricter limiter for expensive AI generation endpoints. */
export const generationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.GENERATION_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Authenticated key when available; IPv6-safe IP bucketing otherwise.
  keyGenerator: (req) => req.user?.firebaseUid ?? ipBucket(req.ip),
  message: { success: false, message: "Generation limit reached for this hour. Please try again later." },
});

/** Tutor chat: cheaper than generation, chattier than REST — its own bucket. */
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.firebaseUid ?? ipBucket(req.ip),
  message: { success: false, message: "The tutor needs a short break — try again in a little while." },
});
