import dotenv from "dotenv";
import { z } from "zod";

// Next.js loads apps/web's .env.local itself; the worker has no such magic,
// so load it explicitly here. dotenv never overrides a var already set in
// process.env, so .env.local takes precedence over a plain .env fallback —
// same precedence Next.js uses.
dotenv.config({ path: ".env.local" });
dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

    BLOB_READ_WRITE_TOKEN: z.string().optional().default(""),

    FIREBASE_PROJECT_ID: z.string().optional().default(""),
    FIREBASE_CLIENT_EMAIL: z.string().optional().default(""),
    FIREBASE_PRIVATE_KEY: z.string().optional().default(""),

    // At least one AI content provider is required — see the cross-field check below.
    // OpenAI is tried FIRST when configured, ahead of Gemini/Groq — see
    // aiContent.service.ts's configuredProviders().
    OPENAI_API_KEY: z.string().optional().default(""),
    OPENAI_MODEL: z.string().default("gpt-5.6-luna"),

    GEMINI_API_KEY: z.string().optional().default(""),
    GEMINI_MODEL: z.string().default("gemini-3.5-flash"),

    GROQ_API_KEY: z.string().optional().default(""),
    // llama-3.3-70b-versatile / llama-3.1-8b-instant were retired from Groq's
    // catalog (calls now 404 "model not found") — defaults point at Groq's
    // current text models instead. Verify against `GET /openai/v1/models`
    // before assuming these are still current if this ever breaks again.
    GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
    // Smaller, faster model with a much larger free-tier tokens-per-minute
    // budget — used automatically when the primary model is rate-limited.
    GROQ_FALLBACK_MODEL: z.string().default("openai/gpt-oss-20b"),

    PEXELS_API_KEY: z.string().optional().default(""),

    // ── Research Lab (prior-art search) — all optional, every source is free ─
    // Semantic Scholar works without a key but shares a small anonymous
    // rate-limit pool; a free key lifts it. https://www.semanticscholar.org/product/api
    SEMANTIC_SCHOLAR_API_KEY: z.string().optional().default(""),
    // USPTO PatentSearch API (free key) — an extra patent source alongside
    // Google Patents. https://patentsview.org/apis/keyrequest
    PATENTSVIEW_API_KEY: z.string().optional().default(""),
    // Contact address sent in User-Agent / OpenAlex "mailto" — public APIs
    // route identified clients to their faster "polite" pools.
    RESEARCH_CONTACT_EMAIL: z.string().optional().default(""),

    ELEVENLABS_API_KEY: z.string().optional().default(""),
    ELEVENLABS_MODEL_ID: z.string().default("eleven_multilingual_v2"),
    ELEVENLABS_VOICE_FRIENDLY: z.string().default("EXAVITQu4vr4xnSDxMaL"),
    ELEVENLABS_VOICE_PROFESSIONAL: z.string().default("ErXwobaYiN019PkySvjV"),
    ELEVENLABS_VOICE_ACADEMIC: z.string().default("onwK4e9ZLuTAKqWW03F9"),

    // Worker-only (ffmpeg video pipeline); harmless no-ops for apps/web.
    FFMPEG_PATH: z.string().optional().default(""),
    FFPROBE_PATH: z.string().optional().default(""),
    BACKGROUND_MUSIC_PATH: z.string().optional().default(""),

    // ── AI-animated lesson video (Wan 2.2, open weights) — worker-only ────────
    // Empty = keep rendering the classic board video. "comfyui" talks to a
    // ComfyUI server that has the Wan 2.2 models installed (your own GPU box,
    // a rented one, or a tunnel to Colab/Kaggle); "replicate" runs the same
    // open weights on Replicate's hosted GPUs.
    WAN_PROVIDER: z.enum(["", "comfyui", "replicate"]).default(""),
    WAN_COMFYUI_URL: z.string().default("http://127.0.0.1:8188"),
    // Optional API-format workflow JSON to use instead of the built-in
    // Wan 2.2 TI2V-5B graph. Placeholders: %PROMPT% %NEGATIVE% and "%SEED%".
    WAN_COMFYUI_WORKFLOW_PATH: z.string().optional().default(""),
    WAN_WIDTH: z.coerce.number().int().positive().default(1280),
    WAN_HEIGHT: z.coerce.number().int().positive().default(704),
    WAN_FRAMES: z.coerce.number().int().positive().default(121),
    WAN_FPS: z.coerce.number().int().positive().default(24),
    WAN_STEPS: z.coerce.number().int().positive().default(20),
    REPLICATE_API_TOKEN: z.string().optional().default(""),
    WAN_REPLICATE_MODEL: z.string().default("wan-video/wan-2.2-t2v-fast"),
    // Extra model inputs as a JSON object, merged over { prompt } — input
    // names differ between Replicate's Wan models, so they are not hardcoded.
    WAN_REPLICATE_INPUT: z.string().optional().default(""),
    // Each clip is ~5s of GPU work; these cap what one lesson can spend.
    WAN_MAX_CLIPS_PER_SLIDE: z.coerce.number().int().positive().default(2),
    WAN_MAX_CLIPS_PER_LESSON: z.coerce.number().int().positive().default(12),
    WAN_CLIP_TIMEOUT_MIN: z.coerce.number().positive().default(20),

    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
    RATE_LIMIT_MAX: z.coerce.number().positive().default(300),
    GENERATION_RATE_LIMIT_MAX: z.coerce.number().positive().default(30),
  })
  .refine(
    (data) => Boolean(data.OPENAI_API_KEY) || Boolean(data.GEMINI_API_KEY) || Boolean(data.GROQ_API_KEY),
    {
      message: "Set at least one AI content provider key: OPENAI_API_KEY, GEMINI_API_KEY and/or GROQ_API_KEY",
      path: ["OPENAI_API_KEY"],
    }
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
