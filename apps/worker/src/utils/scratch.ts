import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.join(os.tmpdir(), "smart-ai-worker");

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** A local scratch directory for one job's intermediate files (ffmpeg/sharp need real paths). */
export function scratchDir(...segments: string[]): string {
  return ensureDir(path.join(ROOT, ...segments));
}

export function scratchPath(...segments: string[]): string {
  return path.join(ROOT, ...segments);
}

export function removeScratch(...segments: string[]): void {
  fs.rmSync(path.join(ROOT, ...segments), { recursive: true, force: true });
}
