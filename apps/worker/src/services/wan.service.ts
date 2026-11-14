import fs from "fs";
import crypto from "crypto";
import { env } from "@smart-ai/core/config/env";
import { logger } from "@smart-ai/core/utils/logger";

/**
 * Text-to-video with Wan 2.2 (open weights, Apache-2.0).
 *
 * Wan needs a real GPU (the 5B model wants ~8 GB VRAM even with offloading,
 * the 14B ones far more), so this worker never runs it in-process — it calls
 * out to wherever the model lives:
 *
 *  - "comfyui"   a ComfyUI server with the Wan 2.2 TI2V-5B files installed.
 *                Fully self-hosted: your own GPU box, a rented one, or a
 *                Colab/Kaggle notebook behind a tunnel.
 *  - "replicate" the same open weights on Replicate's hosted GPUs.
 *
 * One call = one ~5 second silent clip written to `outPath`.
 */

const NEGATIVE_PROMPT =
  "text, letters, words, numbers, subtitles, captions, watermark, logo, signature, blurry, low quality, worst quality, jpeg artifacts, overexposed, washed out, static image, frozen frame, distorted, deformed, malformed hands, extra fingers, extra limbs, cluttered background";

const POLL_MS = 3_000;

export function isWanConfigured(): boolean {
  if (env.WAN_PROVIDER === "comfyui") return Boolean(env.WAN_COMFYUI_URL);
  if (env.WAN_PROVIDER === "replicate") return Boolean(env.REPLICATE_API_TOKEN);
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(res: Response, label: string): Promise<any> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} responded ${res.status}: ${text.slice(0, 600)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

async function download(url: string, outPath: string, headers: Record<string, string> = {}): Promise<void> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Clip download failed (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1024) throw new Error(`Clip download was empty (${buffer.length} bytes)`);
  await fs.promises.writeFile(outPath, buffer);
}

// ── ComfyUI ───────────────────────────────────────────────────────────────

/**
 * ComfyUI's official "Wan2.2 TI2V 5B" template (text-to-video branch) in API
 * format. Needs, on the ComfyUI machine:
 *   models/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors
 *   models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
 *   models/vae/wan2.2_vae.safetensors
 */
function defaultWorkflow(prompt: string, seed: number): Record<string, unknown> {
  return {
    "37": { class_type: "UNETLoader", inputs: { unet_name: "wan2.2_ti2v_5B_fp16.safetensors", weight_dtype: "default" } },
    "38": {
      class_type: "CLIPLoader",
      inputs: { clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors", type: "wan", device: "default" },
    },
    "39": { class_type: "VAELoader", inputs: { vae_name: "wan2.2_vae.safetensors" } },
    "48": { class_type: "ModelSamplingSD3", inputs: { model: ["37", 0], shift: 8 } },
    "6": { class_type: "CLIPTextEncode", inputs: { clip: ["38", 0], text: prompt } },
    "7": { class_type: "CLIPTextEncode", inputs: { clip: ["38", 0], text: NEGATIVE_PROMPT } },
    "55": {
      class_type: "Wan22ImageToVideoLatent",
      inputs: { vae: ["39", 0], width: env.WAN_WIDTH, height: env.WAN_HEIGHT, length: env.WAN_FRAMES, batch_size: 1 },
    },
    "3": {
      class_type: "KSampler",
      inputs: {
        model: ["48", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["55", 0],
        seed,
        steps: env.WAN_STEPS,
        cfg: 5,
        sampler_name: "uni_pc",
        scheduler: "simple",
        denoise: 1,
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["39", 0] } },
    "57": { class_type: "CreateVideo", inputs: { images: ["8", 0], fps: env.WAN_FPS } },
    "58": {
      class_type: "SaveVideo",
      // Newer ComfyUI builds make `format` a dynamic combo: its nested choices
      // are sent as dotted keys ("format.codec"), not as sibling inputs.
      inputs: { video: ["57", 0], filename_prefix: "video/smart-ai", format: "auto", "format.codec": "auto" },
    },
  };
}

/** A user-supplied API-format workflow with %PROMPT% / %NEGATIVE% / "%SEED%" placeholders. */
function customWorkflow(prompt: string, seed: number): Record<string, unknown> {
  const raw = fs.readFileSync(env.WAN_COMFYUI_WORKFLOW_PATH, "utf-8");
  const inString = (value: string) => JSON.stringify(value).slice(1, -1);
  // Function replacers: a "$&" inside a prompt must not be read as a replacement pattern.
  const filled = raw
    .replace(/"%SEED%"/g, () => String(seed))
    .replace(/%SEED%/g, () => String(seed))
    .replace(/%PROMPT%/g, () => inString(prompt))
    .replace(/%NEGATIVE%/g, () => inString(NEGATIVE_PROMPT));
  return JSON.parse(filled);
}

interface ComfyFile {
  filename: string;
  subfolder?: string;
  type?: string;
}

/** Output nodes report files under different keys (images/gifs/videos) — take any video file. */
function findVideoOutput(outputs: Record<string, unknown>): ComfyFile | undefined {
  const files: ComfyFile[] = [];
  for (const nodeOutput of Object.values(outputs ?? {})) {
    for (const value of Object.values((nodeOutput as Record<string, unknown>) ?? {})) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (item && typeof item === "object" && typeof (item as ComfyFile).filename === "string") files.push(item as ComfyFile);
      }
    }
  }
  return files.find((f) => /\.(mp4|webm|mov|mkv)$/i.test(f.filename));
}

async function generateWithComfyUI(prompt: string, seed: number, outPath: string, deadline: number): Promise<void> {
  const base = env.WAN_COMFYUI_URL.replace(/\/+$/, "");
  const workflow = env.WAN_COMFYUI_WORKFLOW_PATH ? customWorkflow(prompt, seed) : defaultWorkflow(prompt, seed);

  const queued = await readJson(
    await fetch(`${base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() }),
    }),
    "ComfyUI /prompt"
  );
  const promptId: string | undefined = queued.prompt_id;
  if (!promptId) throw new Error(`ComfyUI did not queue the workflow: ${JSON.stringify(queued).slice(0, 600)}`);

  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const history = await readJson(await fetch(`${base}/history/${promptId}`), "ComfyUI /history");
    const entry = history[promptId];
    if (!entry) continue; // still queued or sampling

    if (entry.status?.status_str === "error") {
      const detail = (entry.status.messages ?? []).find((m: unknown[]) => m[0] === "execution_error")?.[1];
      throw new Error(
        `ComfyUI workflow failed: ${detail?.exception_message ?? JSON.stringify(entry.status).slice(0, 600)}`
      );
    }

    const file = findVideoOutput(entry.outputs);
    if (!file) throw new Error("ComfyUI finished but produced no video file — check the workflow's save node");
    const query = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? "", type: file.type ?? "output" });
    await download(`${base}/view?${query}`, outPath);
    return;
  }

  // Don't leave a doomed job hogging the GPU queue.
  await fetch(`${base}/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delete: [promptId] }),
  }).catch(() => undefined);
  throw new Error(`ComfyUI clip timed out after ${env.WAN_CLIP_TIMEOUT_MIN} min`);
}

// ── Replicate ─────────────────────────────────────────────────────────────

function replicateExtraInput(): Record<string, unknown> {
  if (!env.WAN_REPLICATE_INPUT) return {};
  try {
    const parsed = JSON.parse(env.WAN_REPLICATE_INPUT);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    logger.warn("WAN_REPLICATE_INPUT is not valid JSON — ignoring it");
    return {};
  }
}

async function generateWithReplicate(prompt: string, seed: number, outPath: string, deadline: number): Promise<void> {
  const headers = { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`, "Content-Type": "application/json" };
  let prediction = await readJson(
    await fetch(`https://api.replicate.com/v1/models/${env.WAN_REPLICATE_MODEL}/predictions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { prompt, seed, ...replicateExtraInput() } }),
    }),
    "Replicate"
  );

  while (!["succeeded", "failed", "canceled"].includes(prediction.status)) {
    if (Date.now() > deadline) {
      if (prediction.urls?.cancel) await fetch(prediction.urls.cancel, { method: "POST", headers }).catch(() => undefined);
      throw new Error(`Replicate clip timed out after ${env.WAN_CLIP_TIMEOUT_MIN} min`);
    }
    await sleep(POLL_MS);
    prediction = await readJson(await fetch(prediction.urls.get, { headers }), "Replicate");
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate prediction ${prediction.status}: ${String(prediction.error ?? "no error message").slice(0, 600)}`);
  }
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof output !== "string") throw new Error("Replicate prediction returned no video URL");
  await download(output, outPath);
}

/** Generates one Wan clip for `prompt` and writes it to `outPath` (mp4). */
export async function generateWanClip(prompt: string, seed: number, outPath: string): Promise<void> {
  const deadline = Date.now() + env.WAN_CLIP_TIMEOUT_MIN * 60_000;
  if (env.WAN_PROVIDER === "comfyui") return generateWithComfyUI(prompt, seed, outPath, deadline);
  if (env.WAN_PROVIDER === "replicate") return generateWithReplicate(prompt, seed, outPath, deadline);
  throw new Error("No Wan provider configured (set WAN_PROVIDER)");
}
