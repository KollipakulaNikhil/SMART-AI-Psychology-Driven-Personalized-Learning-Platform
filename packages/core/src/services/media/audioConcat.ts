import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";

/* eslint-disable @typescript-eslint/no-var-requires */
const ffmpegStatic: string | null = require("ffmpeg-static");
const FFMPEG = env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";

function runProcess(binary: string, args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => reject(new Error(`${label} failed to start: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

function ffmpegPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

/**
 * Concatenates per-slide narration mp3 buffers into one downloadable lesson
 * audio track — a lossless demuxer concat, same as the old
 * `video.service.ts#concatNarrationAudio`, but working against Vercel's
 * writable `/tmp` scratch space instead of a persistent local directory,
 * since the source clips now live in Blob storage rather than on disk.
 */
export async function concatNarrationAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw ApiError.unprocessable("No narration audio found to combine");

  const workDir = path.join(os.tmpdir(), `smart-ai-audio-concat-${crypto.randomUUID()}`);
  await fs.promises.mkdir(workDir, { recursive: true });

  try {
    const clipPaths = await Promise.all(
      buffers.map(async (buffer, index) => {
        const clipPath = path.join(workDir, `slide-${index + 1}.mp3`);
        await fs.promises.writeFile(clipPath, buffer);
        return clipPath;
      })
    );

    const listPath = path.join(workDir, "audio-list.txt");
    const outPath = path.join(workDir, "lesson-full.mp3");
    await fs.promises.writeFile(listPath, clipPaths.map((p) => `file '${ffmpegPath(p)}'`).join("\n"), "utf-8");

    await runProcess(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath], "ffmpeg concat");

    return await fs.promises.readFile(outPath);
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}
