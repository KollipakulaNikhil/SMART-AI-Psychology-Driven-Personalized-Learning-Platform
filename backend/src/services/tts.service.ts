import fs from "fs";
import path from "path";
import axios from "axios";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import { DIRS, ensureDir } from "../utils/paths";
import { DEFAULT_LANGUAGE, languageDefinition, type LessonLanguage } from "../config/languages";
import type { LearnerTraits } from "../models/LearningProfile";

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

/** Edge reports boundary offsets in 100-nanosecond ticks. */
const TICKS_PER_SECOND = 10_000_000;

/**
 * When each word is actually spoken. This is what lets the board write a term at
 * the exact moment the narrator says it, instead of guessing from element counts.
 */
export interface WordTiming {
  word: string;
  /** Seconds from the start of this slide's audio. */
  start: number;
  end: number;
}

export interface NarrationResult {
  audioPath: string;
  /**
   * Real per-word timings when the voice reports them (Edge does), empty when it
   * doesn't (ElevenLabs). Callers must treat empty as "estimate from duration" —
   * never as "no words".
   */
  wordTimings: WordTiming[];
}

interface EdgeBoundary {
  Type?: string;
  Data?: {
    Offset?: number;
    Duration?: number;
    text?: { Text?: string; BoundaryType?: string };
  };
}

/**
 * Edge streams one JSON envelope per boundary event. Anything malformed is
 * skipped rather than thrown: losing a word timing degrades the board's sync
 * slightly, but failing here would cost the learner the whole narration.
 */
function parseWordTimings(chunks: string[]): WordTiming[] {
  const timings: WordTiming[] = [];
  for (const chunk of chunks) {
    let parsed: { Metadata?: EdgeBoundary[] };
    try {
      parsed = JSON.parse(chunk);
    } catch {
      continue;
    }
    for (const item of parsed.Metadata ?? []) {
      if (item.Type !== "WordBoundary") continue;
      const word = item.Data?.text?.Text;
      const offset = item.Data?.Offset;
      const duration = item.Data?.Duration;
      if (!word || typeof offset !== "number") continue;
      const start = offset / TICKS_PER_SECOND;
      timings.push({
        word,
        start,
        end: start + (typeof duration === "number" ? duration : 0) / TICKS_PER_SECOND,
      });
    }
  }
  return timings.sort((a, b) => a.start - b.start);
}

/** Voice character follows the learner's preferred tone. */
function voiceIdForTone(tone: LearnerTraits["tone"]): string {
  switch (tone) {
    case "friendly":
      return env.ELEVENLABS_VOICE_FRIENDLY;
    case "academic":
      return env.ELEVENLABS_VOICE_ACADEMIC;
    case "professional":
    default:
      return env.ELEVENLABS_VOICE_PROFESSIONAL;
  }
}

/**
 * Free Microsoft Edge neural voice for the lesson's language and the learner's
 * tone — the no-key, no-quota narrator. This is what makes multilingual
 * lessons free: every supported language has native neural voices here.
 */
function edgeVoiceFor(tone: LearnerTraits["tone"], language: LessonLanguage): string {
  const { edgeVoices } = languageDefinition(language);
  switch (tone) {
    case "friendly":
      return edgeVoices.friendly;
    case "academic":
      return edgeVoices.academic;
    case "professional":
    default:
      return edgeVoices.professional;
  }
}

/**
 * Free, high-quality neural narration via Microsoft Edge's TTS (no API key, no
 * monthly quota). Runs server-side so — unlike the browser voice — it bakes
 * into the downloadable video. This is the fallback when ElevenLabs is
 * unavailable or out of quota.
 */
async function synthesizeWithEdge(
  text: string,
  tone: LearnerTraits["tone"],
  speed: number,
  outPath: string,
  language: LessonLanguage
): Promise<WordTiming[]> {
  const voice = edgeVoiceFor(tone, language);
  // Edge rate as a percentage string, e.g. 0.9 → "-10%", 1.1 → "+10%".
  const ratePct = Math.round((Math.min(1.2, Math.max(0.8, speed)) - 1) * 100);
  const rate = `${ratePct >= 0 ? "+" : ""}${ratePct}%`;

  return withRetry(
    async () => {
      const tts = new MsEdgeTTS();
      // Word boundaries are what the board timeline is built from. They arrive
      // interleaved with the audio on the same socket, so they are complete by
      // the time the audio stream ends.
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        wordBoundaryEnabled: true,
      });
      const { audioStream, metadataStream } = tts.toStream(text, { rate });
      const chunks: Buffer[] = [];
      const metaChunks: string[] = [];
      metadataStream?.on("data", (c: Buffer | string) => metaChunks.push(c.toString()));
      // A metadata failure must never fail the narration — timings are an
      // enhancement, the audio is the product.
      metadataStream?.on("error", () => undefined);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Edge TTS timed out")), 60_000);
        audioStream.on("data", (c: Buffer) => chunks.push(c));
        audioStream.on("end", () => {
          clearTimeout(timer);
          resolve();
        });
        audioStream.on("error", (e: Error) => {
          clearTimeout(timer);
          reject(e);
        });
      });
      if (chunks.length === 0) throw new Error("Edge TTS returned no audio");
      fs.writeFileSync(outPath, Buffer.concat(chunks));
      return parseWordTimings(metaChunks);
    },
    { attempts: 3, baseDelayMs: 1000, label: "Edge TTS" }
  );
}

export interface NarrationRequest {
  presentationId: string;
  slideIndex: number;
  text: string;
  traits: LearnerTraits;
  /** 0.9 slow · 1.0 moderate · 1.1 fast — derived from the learner's pace. */
  speed: number;
  /** Tail of the previous slide's script — keeps prosody continuous across slides. */
  previousText?: string;
  /** Head of the next slide's script — lets the voice "lean into" what follows. */
  nextText?: string;
  /** Language the script is written in; selects the neural voice. */
  language?: LessonLanguage;
}

interface ElevenLabsErrorDetail {
  code?: string;
  message?: string;
  status?: string;
}

/**
 * The request uses `responseType: "arraybuffer"` (for the audio itself), so
 * axios does NOT auto-parse error bodies — they arrive as raw bytes too.
 * Decode and extract ElevenLabs' actual error detail instead of surfacing a
 * bare status code.
 */
function parseElevenLabsError(error: unknown): ElevenLabsErrorDetail | undefined {
  if (!axios.isAxiosError(error) || !error.response) return undefined;
  try {
    const raw = Buffer.isBuffer(error.response.data)
      ? error.response.data.toString("utf-8")
      : Buffer.from(error.response.data as ArrayBuffer).toString("utf-8");
    const parsed = JSON.parse(raw);
    return parsed?.detail;
  } catch {
    return undefined;
  }
}

function elevenLabsErrorMessage(status: number, detail: ElevenLabsErrorDetail | undefined): string {
  if (detail?.code === "quota_exceeded") {
    return `ElevenLabs character quota is exhausted (${detail.message ?? "0 credits remaining"}). Free tier resets monthly — upgrade your plan or wait for the reset, then try again.`;
  }
  if (detail?.code === "paid_plan_required") {
    return `The configured voice requires a paid ElevenLabs plan (${detail.message ?? "library voice restricted on the free tier"}). Choose a different voice ID or upgrade your plan.`;
  }
  if (detail?.message) {
    return `ElevenLabs rejected the narration request: ${detail.message}`;
  }
  return `ElevenLabs narration request failed with status ${status}.`;
}

/**
 * Nudges the narration toward natural human delivery. ElevenLabs honours
 * ellipses and em-dashes as micro-pauses, so we clean stray markdown/symbols
 * the model may have leaked and ensure sentences breathe.
 */
function humanizeForSpeech(text: string): string {
  return text
    .replace(/[*_#`>|]/g, "") // strip any leaked markdown
    .replace(/\s*\n+\s*/g, " ") // collapse line breaks into spoken flow
    .replace(/\s{2,}/g, " ")
    .replace(/([.!?])\s+/g, "$1  ") // a touch more breath between sentences
    .trim();
}

/**
 * Synthesizes one slide's narration. Prefers premium ElevenLabs when a key and
 * quota are available; otherwise (or on any failure) falls back to the FREE
 * Microsoft Edge neural voice — so narration always succeeds and always bakes
 * into the downloadable video, with no key or quota required.
 */
export async function synthesizeNarration(request: NarrationRequest): Promise<NarrationResult> {
  const { presentationId, slideIndex, text, traits, speed, previousText, nextText } = request;
  const language = request.language ?? DEFAULT_LANGUAGE;
  const dir = ensureDir(path.join(DIRS.audio, presentationId));
  const outPath = path.join(dir, `slide-${slideIndex + 1}.mp3`);
  const voiceId = voiceIdForTone(traits.tone);
  const spokenText = humanizeForSpeech(text);

  // Free Edge voice when there's no ElevenLabs key, and for every non-English
  // lesson — multilingual narration is deliberately on the free tier, so we
  // don't spend a paid quota on languages it may not even cover.
  if (!env.ELEVENLABS_API_KEY || !languageDefinition(language).preferElevenLabs) {
    const wordTimings = await synthesizeWithEdge(spokenText, traits.tone, speed, outPath, language);
    return { audioPath: outPath, wordTimings };
  }

  const requestSpeech = async (includeSpeed: boolean): Promise<Buffer> => {
    // Lower stability + higher style = more expressive, less flat/robotic; the
    // friendly tone gets the most expressiveness, academic the most composure.
    const voiceSettings: Record<string, number | boolean> = {
      stability: traits.tone === "academic" ? 0.5 : traits.tone === "professional" ? 0.42 : 0.35,
      similarity_boost: 0.8,
      style: traits.tone === "friendly" ? 0.55 : traits.tone === "professional" ? 0.4 : 0.3,
      use_speaker_boost: true,
    };
    if (includeSpeed) voiceSettings.speed = Math.min(1.2, Math.max(0.7, speed));

    const body: Record<string, unknown> = {
      text: spokenText,
      model_id: env.ELEVENLABS_MODEL_ID,
      voice_settings: voiceSettings,
    };
    // Prosody continuity: the model shapes intonation as one continuous
    // lecture instead of restarting cold on every slide.
    if (previousText) body.previous_text = humanizeForSpeech(previousText).slice(-280);
    if (nextText) body.next_text = humanizeForSpeech(nextText).slice(0, 280);

    const { data } = await axios.post<ArrayBuffer>(
      `${ELEVENLABS_TTS_URL}/${voiceId}`,
      body,
      {
        headers: {
          "xi-api-key": env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        params: { output_format: "mp3_44100_128" },
        responseType: "arraybuffer",
        timeout: 120_000,
      }
    );
    return Buffer.from(data);
  };

  let audio: Buffer;
  try {
    audio = await withRetry(
      async () => {
        try {
          return await requestSpeech(true);
        } catch (error) {
          // Some plans/models reject the speed setting — fall back to natural pace
          // rather than failing the whole lesson.
          if (axios.isAxiosError(error) && error.response?.status === 422) {
            logger.warn(`ElevenLabs rejected voice speed for slide ${slideIndex + 1}, retrying without it`);
            return requestSpeech(false);
          }
          throw error;
        }
      },
      {
        attempts: 3,
        baseDelayMs: 1500,
        label: `ElevenLabs TTS slide ${slideIndex + 1}`,
        shouldRetry: (error) => {
          // Never retry auth/quota/payment failures — they will not fix themselves.
          if (axios.isAxiosError(error) && error.response) {
            return ![401, 402, 403, 422].includes(error.response.status);
          }
          return true;
        },
      }
    );
  } catch (error) {
    // ElevenLabs failed (quota, auth, outage) — fall back to the free Edge voice
    // so the learner still gets narration instead of silence.
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const detail = parseElevenLabsError(error);
    logger.warn(
      `ElevenLabs narration failed for slide ${slideIndex + 1} (${status ? elevenLabsErrorMessage(status, detail) : "error"}); using free Edge voice`
    );
    const wordTimings = await synthesizeWithEdge(spokenText, traits.tone, speed, outPath, language);
    return { audioPath: outPath, wordTimings };
  }

  fs.writeFileSync(outPath, audio);
  // ElevenLabs' standard endpoint returns no alignment data, so the board
  // timeline falls back to distributing words across the measured duration.
  return { audioPath: outPath, wordTimings: [] };
}
