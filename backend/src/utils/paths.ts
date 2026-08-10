import fs from "fs";
import path from "path";

/** Backend root (parent of src/ in dev, of dist/ in prod). */
export const APP_ROOT = path.resolve(__dirname, "..", "..");

export const DIRS = {
  uploads: path.join(APP_ROOT, "uploads"),
  uploadImages: path.join(APP_ROOT, "uploads", "images"),
  generated: path.join(APP_ROOT, "generated"),
  ppt: path.join(APP_ROOT, "generated", "ppt"),
  pdf: path.join(APP_ROOT, "generated", "pdf"),
  audio: path.join(APP_ROOT, "generated", "audio"),
  video: path.join(APP_ROOT, "generated", "video"),
  slides: path.join(APP_ROOT, "generated", "slides"),
  subtitles: path.join(APP_ROOT, "generated", "subtitles"),
  logs: path.join(APP_ROOT, "logs"),
} as const;

export function ensureRuntimeDirs(): void {
  Object.values(DIRS).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Converts an absolute path under APP_ROOT into a web path served by /static. */
export function toPublicUrl(absolutePath: string | undefined | null): string | null {
  if (!absolutePath) return null;
  const relative = path.relative(APP_ROOT, absolutePath);
  if (relative.startsWith("..")) return null;
  return `/static/${relative.split(path.sep).join("/")}`;
}
