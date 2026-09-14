import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { env } from "../../config/env";

/* eslint-disable @typescript-eslint/no-var-requires */
const ffprobeStatic: { path: string } = require("ffprobe-static");

const FFPROBE = env.FFPROBE_PATH || ffprobeStatic.path || "ffprobe";

/** Probes the duration (seconds) of a media file already on local disk. */
export async function probeDurationSec(mediaPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      FFPROBE,
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mediaPath],
      { windowsHide: true }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      const duration = parseFloat(stdout.trim());
      if (code === 0 && Number.isFinite(duration)) resolve(duration);
      else reject(new Error(`ffprobe failed for ${mediaPath}: ${stderr.slice(-400)}`));
    });
  });
}

/**
 * Probes an in-memory media buffer — writes it to Vercel's/the OS's writable
 * `/tmp` just long enough for ffprobe to read it, then cleans up. Used by the
 * web app's audio stage, which uploads narration straight to Blob instead of
 * keeping a local file around.
 */
export async function probeDurationSecFromBuffer(buffer: Buffer, extension: string): Promise<number> {
  const tmpPath = path.join(os.tmpdir(), `smart-ai-probe-${crypto.randomUUID()}.${extension}`);
  await fs.promises.writeFile(tmpPath, buffer);
  try {
    return await probeDurationSec(tmpPath);
  } finally {
    await fs.promises.rm(tmpPath, { force: true });
  }
}
