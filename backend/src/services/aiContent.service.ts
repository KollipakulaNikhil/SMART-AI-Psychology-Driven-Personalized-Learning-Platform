import { z } from "zod";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import type { LearnerTraits } from "../models/LearningProfile";
import type { GenerationOptions } from "../prompts/profileBuilder";
import { runStructuredGeneration, type LessonGenerationResult } from "../prompts/promptEngine";
import { callGemini, callGeminiText, generateLessonContentGemini } from "./gemini.service";
import { callGroq, callGroqStrong, callGroqText, generateLessonContentGroq } from "./groq.service";

type Provider = "gemini" | "groq";

const PROVIDER_RUNNERS: Record<Provider, typeof generateLessonContentGemini> = {
  gemini: generateLessonContentGemini,
  groq: generateLessonContentGroq,
};

const RAW_CALLERS: Record<Provider, (prompt: string) => Promise<string>> = {
  gemini: callGemini,
  groq: callGroq,
};

const TEXT_CALLERS: Record<Provider, (prompt: string) => Promise<string>> = {
  gemini: callGeminiText,
  groq: callGroqText,
};

/**
 * For work the small fallback model gets WRONG rather than just slower —
 * notably translating into non-Latin scripts. Groq stays on its large model
 * and is allowed to fail; Gemini has no small tier so it reuses the normal caller.
 */
const STRONG_CALLERS: Record<Provider, (prompt: string) => Promise<string>> = {
  gemini: callGemini,
  groq: callGroqStrong,
};

/** Plain-text generation (tutor chat) with the same Gemini→Groq fallback. */
export async function generateText(prompt: string, label: string): Promise<string> {
  const providers = configuredProviders();
  if (providers.length === 0) {
    throw ApiError.serviceUnavailable(
      "No AI content provider is configured. Set GEMINI_API_KEY and/or GROQ_API_KEY."
    );
  }

  let lastError: unknown;
  for (const [index, provider] of providers.entries()) {
    try {
      return await TEXT_CALLERS[provider](prompt);
    } catch (error) {
      lastError = error;
      noteProviderFailure(provider, error);
      const hasNext = index < providers.length - 1;
      logger.warn(
        `${provider} ${label} failed${hasNext ? ", falling back to next provider" : ""}`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  throw wrapProviderFailure(lastError, label);
}

/**
 * Circuit breaker for a provider whose quota is exhausted.
 *
 * A depleted key fails on EVERY call, and a multi-call job (translating a
 * 10-slide lesson is a dozen calls) then burns a wasted round-trip each time —
 * that alone added ~35s to a generation when Gemini's credits ran out. After a
 * quota failure we stop calling that provider for a few minutes and go straight
 * to the fallback, then let it back in to check whether quota has returned.
 */
/** A depleted key / daily cap won't recover soon; a per-minute bucket refills within one. */
const HARD_QUOTA_COOLDOWN_MS = 5 * 60 * 1000;
const PER_MINUTE_COOLDOWN_MS = 60 * 1000;
const providerCooldownUntil = new Map<Provider, number>();

/**
 * How long to bench a provider after a failure, or 0 to keep using it.
 *
 * The distinction matters: a *depleted* key fails identically forever, so
 * benching it saves a wasted round-trip on every subsequent call. A
 * *tokens-per-minute* limit is transient — benching it for minutes would throw
 * away a provider that is fine again seconds later.
 */
function cooldownForError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (/tokens per minute|TPM|try again in [\d.]+s|saturated/i.test(message)) {
    return PER_MINUTE_COOLDOWN_MS;
  }
  const status = (error as { status?: number } | null)?.status;
  if (status === 429 || /quota|RESOURCE_EXHAUSTED|credits are depleted|rate.?limit/i.test(message)) {
    return HARD_QUOTA_COOLDOWN_MS;
  }
  return 0;
}

function noteProviderFailure(provider: Provider, error: unknown): void {
  const cooldown = cooldownForError(error);
  if (cooldown === 0) return;
  if ((providerCooldownUntil.get(provider) ?? 0) > Date.now()) return;
  providerCooldownUntil.set(provider, Date.now() + cooldown);
  logger.warn(
    `${provider} is rate-limited — skipping it for ${Math.round(cooldown / 1000)}s so multi-call jobs don't pay a failed round-trip each time`
  );
}

/**
 * Turns whatever the last provider threw into a message a learner can actually
 * act on. Left as-is, a raw Node/SDK error ("getaddrinfo ENOTFOUND
 * api.groq.com", a bare fetch failure, a Gemini SDK internals string) surfaces
 * straight into the generation UI — which reads exactly like the feature is
 * broken, when it's really a transient network/quota blip on the AI provider.
 */
function wrapProviderFailure(lastError: unknown, label: string): ApiError {
  if (lastError instanceof ApiError) return lastError;
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  const isNetwork = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|network/i.test(message);
  const isRateLimit = /quota|rate.?limit|429|RESOURCE_EXHAUSTED|tokens per minute|TPM/i.test(message);
  const friendly = isNetwork
    ? `Couldn't reach the AI service to ${label} — this is usually a brief network hiccup, not a problem with what you submitted. Please try again in a moment.`
    : isRateLimit
      ? `The AI service is rate-limited right now. Please wait a minute and try again.`
      : `The AI service couldn't ${label} right now. Please try again.`;
  return ApiError.serviceUnavailable(friendly);
}

/** Gemini first (higher quality), Groq as the fallback — only providers with a configured key are tried. */
function configuredProviders(): Provider[] {
  const all: Provider[] = [];
  if (env.GEMINI_API_KEY) all.push("gemini");
  if (env.GROQ_API_KEY) all.push("groq");

  const now = Date.now();
  const available = all.filter((provider) => (providerCooldownUntil.get(provider) ?? 0) <= now);
  // If every provider is cooling down, try them all anyway rather than failing
  // outright — the cooldown is an optimization, not a hard gate.
  return available.length > 0 ? available : all;
}

/**
 * Tries each configured AI provider in order so an outage or exhausted
 * quota on one provider doesn't block lesson generation entirely.
 */
export async function generateLessonContent(
  topic: string,
  traits: LearnerTraits,
  focus?: string,
  options?: GenerationOptions
): Promise<LessonGenerationResult> {
  const providers = configuredProviders();
  if (providers.length === 0) {
    throw ApiError.serviceUnavailable(
      "No AI content provider is configured. Set GEMINI_API_KEY and/or GROQ_API_KEY."
    );
  }

  let lastError: unknown;
  for (const [index, provider] of providers.entries()) {
    try {
      return await PROVIDER_RUNNERS[provider](topic, traits, focus, options);
    } catch (error) {
      lastError = error;
      noteProviderFailure(provider, error);
      const hasNext = index < providers.length - 1;
      logger.warn(
        `${provider} content generation failed${hasNext ? ", falling back to next provider" : ""}`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  throw wrapProviderFailure(lastError, "generate your lesson");
}

/**
 * Provider-fallback wrapper for any strict-JSON generation (e.g. course
 * syllabi): Gemini first, Groq next, identical validation contract.
 */
export async function generateStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  label: string,
  /** `requireStrongModel` forbids Groq's small-model fallback — see STRONG_CALLERS. */
  options: { requireStrongModel?: boolean } = {}
): Promise<T> {
  const providers = configuredProviders();
  if (providers.length === 0) {
    throw ApiError.serviceUnavailable(
      "No AI content provider is configured. Set GEMINI_API_KEY and/or GROQ_API_KEY."
    );
  }

  const callers = options.requireStrongModel ? STRONG_CALLERS : RAW_CALLERS;

  let lastError: unknown;
  for (const [index, provider] of providers.entries()) {
    try {
      return await runStructuredGeneration(callers[provider], prompt, schema, provider);
    } catch (error) {
      lastError = error;
      noteProviderFailure(provider, error);
      const hasNext = index < providers.length - 1;
      logger.warn(
        `${provider} ${label} generation failed${hasNext ? ", falling back to next provider" : ""}`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  throw wrapProviderFailure(lastError, `generate your ${label}`);
}
