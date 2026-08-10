import axios from "axios";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import type { LearnerTraits } from "../models/LearningProfile";
import type { GenerationOptions } from "../prompts/profileBuilder";
import { runContentGeneration, type LessonGenerationResult } from "../prompts/promptEngine";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GroqRateLimitInfo {
  /** True only for the per-minute token bucket, which refills within a minute. */
  isTransient: boolean;
  waitMs: number;
  /** True when the free tier's tokens-per-DAY budget is spent (hours away from resetting). */
  isDailyCap: boolean;
  /** Human-readable reset hint straight from Groq, e.g. "1h38m41.856s". */
  retryAfter?: string;
}

/**
 * Groq's 429 body states which budget was hit and when it resets, e.g.
 * "on tokens per day (TPD): Limit 100000, Used 93893 … try again in 1h38m41s".
 *
 * Telling the two apart matters: a per-minute limit is worth waiting out, but a
 * daily cap is HOURS away — waiting 20s and retrying just burns a minute per
 * request and reports a misleading "try again in a minute" to the user.
 */
function parseGroqRateLimit(error: unknown): GroqRateLimitInfo | undefined {
  if (!axios.isAxiosError(error) || error.response?.status !== 429) return undefined;
  const body = error.response.data?.error as { message?: string; type?: string } | undefined;
  const message = body?.message ?? "";
  const isDailyCap = /per day|\bTPD\b|\bRPD\b/i.test(message);
  // Only a bare seconds value is a per-minute window; "1h38m41.856s" is not.
  const secondsMatch = message.match(/try again in ([\d.]+)s\b/i);
  // Groq writes durations as "1h38m41.856s" / "46m4.056s" / "12.5s" — capture the
  // whole token, then drop the fractional seconds so it reads as a human hint.
  const retryAfter = message
    .match(/try again in ((?:\d+h)?(?:\d+m)?(?:[\d.]+s)?)/i)?.[1]
    ?.replace(/(\d+)\.\d+s/, "$1s");
  const waitSeconds = secondsMatch ? parseFloat(secondsMatch[1]) : 20;
  return {
    isTransient: body?.type === "tokens" && !isDailyCap && Boolean(secondsMatch),
    // Allow up to ~65s so a full per-minute TPM window can actually clear.
    waitMs: Math.min(65_000, Math.ceil(waitSeconds * 1000) + 750),
    isDailyCap,
    retryAfter,
  };
}

/** A daily cap can't be worked around by any model swap — say so plainly. */
function dailyCapError(info: GroqRateLimitInfo): ApiError {
  const when = info.retryAfter ? ` It resets in about ${info.retryAfter}.` : "";
  return ApiError.serviceUnavailable(
    `Groq's free-tier daily token limit is used up.${when} Add a Gemini API key with quota, or upgrade the Groq plan, to keep generating today.`
  );
}

/** The smaller fallback model caps completion tokens lower than the 70B. */
const FALLBACK_MAX_TOKENS = 4000;

/**
 * Retry only on genuinely transient failures: a token-bucket 429, a 5xx, or a
 * network error. Permanent 4xx (413 too-large, 400, 401) will never self-heal.
 */
function groqShouldRetry(error: unknown): boolean {
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    if (status === 429) return parseGroqRateLimit(error)?.isTransient ?? false;
    if (status >= 400 && status < 500) return false;
    return true;
  }
  return true;
}

async function requestGroq(prompt: string, model: string, maxTokens: number): Promise<string> {
  const { data } = await axios.post(
    GROQ_CHAT_URL,
    {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    },
    {
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 60_000,
    }
  );
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response");
  return text;
}

/**
 * Calls one Groq model with retry + a single wait-and-retry on a transient
 * per-minute token limit. Throws the raw error so the caller can decide
 * whether to fall back to a different model.
 */
async function callGroqModel(prompt: string, model: string, maxTokens: number): Promise<string> {
  try {
    return await withRetry(() => requestGroq(prompt, model, maxTokens), {
      attempts: 3,
      label: `Groq ${model}`,
      shouldRetry: groqShouldRetry,
    });
  } catch (error) {
    const rateLimit = parseGroqRateLimit(error);
    // Never sit through a wait for a daily cap — it's hours away, not seconds.
    if (rateLimit?.isDailyCap) throw dailyCapError(rateLimit);
    if (rateLimit?.isTransient) {
      logger.warn(`Groq ${model} token limit hit, waiting ${rateLimit.waitMs}ms before one more try`);
      await sleep(rateLimit.waitMs);
      return requestGroq(prompt, model, maxTokens);
    }
    throw error;
  }
}

/**
 * Primary Groq model first; on a persistent rate limit (or the daily cap on
 * the big model), automatically retry with the smaller GROQ_FALLBACK_MODEL,
 * which has a much larger free-tier tokens-per-minute budget. This keeps
 * generation working on the free tier even when the 70B model is saturated.
 */
export async function callGroq(prompt: string, maxTokens = 8000): Promise<string> {
  try {
    return await callGroqModel(prompt, env.GROQ_MODEL, maxTokens);
  } catch (primaryError) {
    const rateLimit = parseGroqRateLimit(primaryError);
    // The daily budget is per-organization, so the smaller model is out too.
    if (rateLimit?.isDailyCap) throw dailyCapError(rateLimit);
    const canFallback =
      Boolean(rateLimit) && env.GROQ_FALLBACK_MODEL && env.GROQ_FALLBACK_MODEL !== env.GROQ_MODEL;

    if (!canFallback) {
      if (rateLimit) {
        throw ApiError.serviceUnavailable(
          "The Groq API is rate-limited right now. Please try again in a minute, or add a Gemini API key with quota."
        );
      }
      throw primaryError;
    }

    logger.warn(`Groq ${env.GROQ_MODEL} rate-limited — falling back to ${env.GROQ_FALLBACK_MODEL}`);
    try {
      // The smaller model caps completion tokens lower — clamp to avoid a 413.
      return await callGroqModel(prompt, env.GROQ_FALLBACK_MODEL, Math.min(maxTokens, FALLBACK_MAX_TOKENS));
    } catch (fallbackError) {
      logger.error("Both Groq models are rate-limited", {
        message: axios.isAxiosError(fallbackError)
          ? JSON.stringify(fallbackError.response?.data)
          : String(fallbackError),
      });
      throw ApiError.serviceUnavailable(
        "Groq's free tier is saturated on both models right now. Please wait a minute and retry, or add a Gemini API key with quota for higher limits."
      );
    }
  }
}

/**
 * The primary (large) model ONLY — never the small fallback.
 *
 * Use for work the small model cannot do correctly. Measured: asked to render
 * Telugu, `llama-3.1-8b-instant` emits sequences of valid Telugu codepoints
 * that are not real words, while `llama-3.3-70b-versatile` translates properly.
 * Since `callGroq` silently drops to the small model when the large one is
 * rate-limited, translation must opt out of that — failing (and keeping the
 * English original) is far better than shipping a lesson full of gibberish.
 */
export async function callGroqStrong(prompt: string, maxTokens = 8000): Promise<string> {
  return callGroqModel(prompt, env.GROQ_MODEL, maxTokens);
}

/** Plain-text generation (tutor chat) — no JSON mode, smaller token budget. */
async function requestGroqText(prompt: string, model: string): Promise<string> {
  const { data } = await axios.post(
    GROQ_CHAT_URL,
    { model, messages: [{ role: "user", content: prompt }], temperature: 0.6, max_tokens: 1024 },
    {
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      timeout: 45_000,
    }
  );
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response");
  return text;
}

export async function callGroqText(prompt: string): Promise<string> {
  const attempt = (model: string) =>
    withRetry(() => requestGroqText(prompt, model), {
      attempts: 2,
      label: `Groq text ${model}`,
      shouldRetry: (error) => parseGroqRateLimit(error)?.isTransient ?? true,
    });

  try {
    return await attempt(env.GROQ_MODEL);
  } catch (error) {
    // The tutor should stay responsive: fall back to the higher-limit model.
    if (parseGroqRateLimit(error) && env.GROQ_FALLBACK_MODEL !== env.GROQ_MODEL) {
      try {
        return await attempt(env.GROQ_FALLBACK_MODEL);
      } catch {
        throw ApiError.serviceUnavailable("The AI tutor is rate-limited right now — try again in a minute.");
      }
    }
    if (parseGroqRateLimit(error)) {
      throw ApiError.serviceUnavailable("The AI tutor is rate-limited right now — try again in a minute.");
    }
    throw error;
  }
}

/**
 * Generates a complete profile-adapted lesson via Groq (OpenAI-compatible
 * chat completions). Used as a fallback when Gemini is unavailable or out
 * of quota — the prompt and validation contract are identical either way.
 */
export async function generateLessonContentGroq(
  topic: string,
  traits: LearnerTraits,
  focus?: string,
  options?: GenerationOptions
): Promise<LessonGenerationResult> {
  return runContentGeneration(callGroq, topic, traits, focus, "Groq", options);
}
