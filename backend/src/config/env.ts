import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),

    // At least one AI content provider is required — see the cross-field check below.
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

    ELEVENLABS_API_KEY: z.string().optional().default(""),
    ELEVENLABS_MODEL_ID: z.string().default("eleven_multilingual_v2"),
    ELEVENLABS_VOICE_FRIENDLY: z.string().default("EXAVITQu4vr4xnSDxMaL"),
    ELEVENLABS_VOICE_PROFESSIONAL: z.string().default("ErXwobaYiN019PkySvjV"),
    ELEVENLABS_VOICE_ACADEMIC: z.string().default("onwK4e9ZLuTAKqWW03F9"),

    FFMPEG_PATH: z.string().optional().default(""),
    FFPROBE_PATH: z.string().optional().default(""),
    BACKGROUND_MUSIC_PATH: z.string().optional().default(""),

    // ── Talking-head avatar (optional, open-source Wav2Lip/SadTalker) ─────
    // Explicit string→bool so "false" is actually false (z.coerce.boolean isn't).
    AVATAR_ENABLED: z
      .string()
      .optional()
      .default("false")
      .transform((v) => v === "true" || v === "1"),
    AVATAR_ENGINE: z.enum(["wav2lip", "sadtalker"]).default("wav2lip"),
    PYTHON_BIN: z.string().optional().default(""),
    AVATAR_REPO_DIR: z.string().optional().default(""),
    WAV2LIP_CHECKPOINT: z.string().optional().default("checkpoints/wav2lip_gan.pth"),
    AVATAR_FACE_IMAGE: z.string().optional().default(""),
    AVATAR_TIMEOUT_MIN: z.coerce.number().positive().default(40),
    // Downscale the face before lip-sync — the presenter is a small corner PiP,
    // so downscaling is invisible in the final video.
    AVATAR_RESIZE_FACTOR: z.coerce.number().int().min(1).max(4).default(2),

    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
    RATE_LIMIT_MAX: z.coerce.number().positive().default(300),
    GENERATION_RATE_LIMIT_MAX: z.coerce.number().positive().default(30),
  })
  .refine((data) => Boolean(data.GEMINI_API_KEY) || Boolean(data.GROQ_API_KEY), {
    message: "Set at least one AI content provider key: GEMINI_API_KEY and/or GROQ_API_KEY",
    path: ["GEMINI_API_KEY"],
  });

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
