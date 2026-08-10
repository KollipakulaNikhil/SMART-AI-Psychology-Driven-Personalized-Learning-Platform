#!/usr/bin/env node
/**
 * Standalone avatar-setup checker. Reads backend/.env and reports whether every
 * talking-head prerequisite is in place — without generating a lesson.
 *
 *   node backend/avatar/check-setup.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(backendDir, ".env");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(envPath);
const engine = env.AVATAR_ENGINE || "wav2lip";

const checks = [];
const enabled = env.AVATAR_ENABLED === "true" || env.AVATAR_ENABLED === "1";
checks.push(["AVATAR_ENABLED is true", enabled]);

const pythonOk = Boolean(env.PYTHON_BIN) && fs.existsSync(env.PYTHON_BIN);
checks.push([`PYTHON_BIN exists (${env.PYTHON_BIN || "unset"})`, pythonOk]);

const repoOk = Boolean(env.AVATAR_REPO_DIR) && fs.existsSync(env.AVATAR_REPO_DIR);
checks.push([`AVATAR_REPO_DIR exists (${env.AVATAR_REPO_DIR || "unset"})`, repoOk]);

const faceOk = Boolean(env.AVATAR_FACE_IMAGE) && fs.existsSync(env.AVATAR_FACE_IMAGE);
checks.push([`AVATAR_FACE_IMAGE exists (${env.AVATAR_FACE_IMAGE || "unset"})`, faceOk]);

if (engine === "wav2lip" && repoOk) {
  const inference = path.join(env.AVATAR_REPO_DIR, "inference.py");
  checks.push(["Wav2Lip inference.py present", fs.existsSync(inference)]);
  const ckpt = path.isAbsolute(env.WAV2LIP_CHECKPOINT || "")
    ? env.WAV2LIP_CHECKPOINT
    : path.join(env.AVATAR_REPO_DIR, env.WAV2LIP_CHECKPOINT || "checkpoints/wav2lip_gan.pth");
  checks.push([`Wav2Lip checkpoint present (${ckpt})`, fs.existsSync(ckpt)]);
}

console.log(`\nTalking-head setup check (engine: ${engine})\n`);
let allOk = true;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? "✓" : "✗"}  ${label}`);
  if (!ok) allOk = false;
}
console.log(
  allOk
    ? "\nAll set — lessons will render with a lip-synced presenter.\n"
    : "\nSome prerequisites are missing — lessons will render board-only until fixed. See backend/avatar/README.md.\n"
);
process.exit(allOk ? 0 : 1);
