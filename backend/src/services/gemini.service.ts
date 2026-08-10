import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import type { LearnerTraits } from "../models/LearningProfile";
import type { GenerationOptions } from "../prompts/profileBuilder";
import { runContentGeneration, type LessonGenerationResult } from "../prompts/promptEngine";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/** The @google/genai SDK throws its own ApiError with a numeric `.status`. */
function geminiStatus(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;
}

export async function callGemini(prompt: string): Promise<string> {
  try {
    return await withRetry(
      async () => {
        const response = await ai.models.generateContent({
          model: env.GEMINI_MODEL,
          contents: prompt,
          config: {
            temperature: 0.7,
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
          },
        });
        const text = response.text;
        if (!text) throw new Error("Gemini returned an empty response");
        return text;
      },
      {
        attempts: 3,
        label: "Gemini generateContent",
        // A 429 with a free-tier quota of 0 cannot self-resolve within a
        // few-second backoff window — fail fast instead of burning attempts.
        shouldRetry: (error) => geminiStatus(error) !== 429,
      }
    );
  } catch (error) {
    if (geminiStatus(error) === 429) {
      logger.error("Gemini quota/rate limit exceeded", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw ApiError.serviceUnavailable(
        "The AI content engine has hit its Gemini API quota. If this is a free-tier key, link a billing account to the Google Cloud project (no charges within free limits) or generate a fresh key, then try again."
      );
    }
    throw error;
  }
}

/** Plain-text generation (tutor chat) — same retry/quota handling, no JSON mode. */
export async function callGeminiText(prompt: string): Promise<string> {
  try {
    return await withRetry(
      async () => {
        const response = await ai.models.generateContent({
          model: env.GEMINI_MODEL,
          contents: prompt,
          config: { temperature: 0.6, maxOutputTokens: 1024 },
        });
        const text = response.text;
        if (!text) throw new Error("Gemini returned an empty response");
        return text;
      },
      {
        attempts: 2,
        label: "Gemini text generation",
        shouldRetry: (error) => geminiStatus(error) !== 429,
      }
    );
  } catch (error) {
    if (geminiStatus(error) === 429) {
      throw ApiError.serviceUnavailable("The AI tutor has hit its Gemini API quota.");
    }
    throw error;
  }
}

/**
 * Generates a complete profile-adapted lesson via Gemini. If the first
 * response fails schema validation, sends one structured repair round
 * before giving up.
 */
export async function generateLessonContentGemini(
  topic: string,
  traits: LearnerTraits,
  focus?: string,
  options?: GenerationOptions
): Promise<LessonGenerationResult> {
  return runContentGeneration(callGemini, topic, traits, focus, "Gemini", options);
}
