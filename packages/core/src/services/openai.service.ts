import axios from "axios";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import type { LearnerTraits } from "../models/LearningProfile";
import type { GenerationOptions } from "../prompts/profileBuilder";
import { runContentGeneration, type LessonGenerationResult } from "../prompts/promptEngine";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Tried first in the provider chain (see aiContent.service.ts). Uses the
 * standard Chat Completions API with JSON mode — the same shape Groq's
 * OpenAI-compatible endpoint uses, so this mirrors groq.service.ts closely.
 *
 * `OPENAI_MODEL` (default "gpt-5.6-luna") is a reasoning-tier model that
 * rejects any non-default `temperature`/`top_p` — same restriction as
 * OpenAI's o1/o3/gpt-5 reasoning models — so this deliberately omits both
 * and lets the API use its default. If a future model swap needs custom
 * sampling params back, check `error.response.data.error` first; that's
 * surfaced below instead of a bare status code specifically so this class
 * of "unsupported_value" rejection doesn't have to be diagnosed blind again.
 */
function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true;
  if (status === 429) return true;
  return status >= 500;
}

function describeOpenAIError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: { message?: string; code?: string } } | undefined;
    if (body?.error?.message) return `${body.error.code ?? "error"}: ${body.error.message}`;
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

async function requestOpenAI(prompt: string, jsonMode: boolean, maxTokens: number): Promise<string> {
  const { data } = await axios.post(
    OPENAI_CHAT_URL,
    {
      model: env.OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 90_000,
    }
  );
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response");
  return text;
}

/** JSON-mode generation (lesson content, course plans, any structured output). */
export async function callOpenAI(prompt: string, maxTokens = 8000): Promise<string> {
  try {
    return await withRetry(() => requestOpenAI(prompt, true, maxTokens), {
      attempts: 3,
      label: `OpenAI ${env.OPENAI_MODEL}`,
      shouldRetry: (error) => isRetryableStatus(axios.isAxiosError(error) ? error.response?.status : undefined),
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      logger.error("OpenAI rate limit/quota exceeded", { message: describeOpenAIError(error) });
      throw ApiError.serviceUnavailable(
        "The AI content engine has hit its OpenAI API quota. Check your OpenAI billing/usage, or wait and try again."
      );
    }
    logger.warn("OpenAI request failed", { message: describeOpenAIError(error) });
    throw error;
  }
}

/** Plain-text generation (tutor chat) — no JSON mode, smaller token budget. */
export async function callOpenAIText(prompt: string): Promise<string> {
  return withRetry(() => requestOpenAI(prompt, false, 1024), {
    attempts: 2,
    label: `OpenAI text ${env.OPENAI_MODEL}`,
    shouldRetry: (error) => isRetryableStatus(axios.isAxiosError(error) ? error.response?.status : undefined),
  });
}

/** Generates a complete profile-adapted lesson via OpenAI. */
export async function generateLessonContentOpenAI(
  topic: string,
  traits: LearnerTraits,
  focus?: string,
  options?: GenerationOptions
): Promise<LessonGenerationResult> {
  return runContentGeneration(callOpenAI, topic, traits, focus, "OpenAI", options);
}
