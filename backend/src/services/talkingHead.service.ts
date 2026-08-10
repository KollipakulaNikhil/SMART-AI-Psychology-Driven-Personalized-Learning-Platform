import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { DIRS, ensureDir } from "../utils/paths";

/* eslint-disable @typescript-eslint/no-var-requires */
const ffmpegStatic: string | null = require("ffmpeg-static");

/**
 * Optional lip-synced talking-head presenter via an open-source engine
 * (Wav2Lip by default, SadTalker supported). This is a gated enhancement:
 * when the local Python environment isn't set up, {@link isAvatarAvailable}
 * returns false and the video pipeline silently produces a board-only lesson.
 *
 * Setup is documented in backend/avatar/README.md. Nothing here downloads
 * models or touches the network — it only shells out to a preinstalled repo.
 */

export interface AvatarAvailability {
  available: boolean;
  reason?: string;
}

function checkpointPath(): string {
  return path.isAbsolute(env.WAV2LIP_CHECKPOINT)
    ? env.WAV2LIP_CHECKPOINT
    : path.join(env.AVATAR_REPO_DIR, env.WAV2LIP_CHECKPOINT);
}

/** Verifies every prerequisite for the configured engine is present on disk. */
export function isAvatarAvailable(): AvatarAvailability {
  if (!env.AVATAR_ENABLED) return { available: false, reason: "AVATAR_ENABLED is false" };
  if (!env.PYTHON_BIN) return { available: false, reason: "PYTHON_BIN not set" };
  if (!env.AVATAR_REPO_DIR || !fs.existsSync(env.AVATAR_REPO_DIR)) {
    return { available: false, reason: "AVATAR_REPO_DIR missing" };
  }
  if (!env.AVATAR_FACE_IMAGE || !fs.existsSync(env.AVATAR_FACE_IMAGE)) {
    return { available: false, reason: "AVATAR_FACE_IMAGE missing" };
  }
  if (env.AVATAR_ENGINE === "wav2lip") {
    const inference = path.join(env.AVATAR_REPO_DIR, "inference.py");
    if (!fs.existsSync(inference)) return { available: false, reason: "Wav2Lip inference.py not found" };
    if (!fs.existsSync(checkpointPath())) return { available: false, reason: "Wav2Lip checkpoint not found" };
  }
  return { available: true };
}

function runPython(args: string[], cwd: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info(`Talking-head: ${env.PYTHON_BIN} ${args.join(" ")}`);
    // Wav2Lip's final step shells out to a bare `ffmpeg` to mux frames+audio.
    // Prepend our bundled ffmpeg-static directory so no system install is needed.
    const childEnv = { ...process.env };
    const ffmpegDir = env.FFMPEG_PATH ? path.dirname(env.FFMPEG_PATH) : ffmpegStatic ? path.dirname(ffmpegStatic) : "";
    if (ffmpegDir) childEnv.PATH = `${ffmpegDir}${path.delimiter}${childEnv.PATH ?? ""}`;
    const child = spawn(env.PYTHON_BIN, args, { cwd, windowsHide: true, env: childEnv });

    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Talking-head generation timed out after ${Math.round(timeoutMs / 60000)} min`));
    }, timeoutMs);

    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.stdout.on("data", (c) => logger.debug(`wav2lip: ${c.toString().trim()}`));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start Python for talking head: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Talking-head engine exited with code ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

/**
 * Runs the configured engine to lip-sync the presenter face image to the given
 * audio track. Returns the presenter video path, or null if the engine isn't
 * available (caller falls back to a board-only video).
 */
export async function generateTalkingHead(
  presentationId: string,
  audioWavPath: string
): Promise<string | null> {
  const availability = isAvatarAvailable();
  if (!availability.available) {
    logger.info(`Talking-head skipped: ${availability.reason}`);
    return null;
  }

  const outDir = ensureDir(path.join(DIRS.video, `${presentationId}-avatar`));
  const finalOut = path.join(outDir, "presenter.mp4");
  const timeoutMs = env.AVATAR_TIMEOUT_MIN * 60 * 1000;

  // Wav2Lip/SadTalker build their internal ffmpeg command as an UNQUOTED
  // string, so any space in a path (e.g. "Persnal Project") breaks the mux.
  // Stage everything in a space-free scratch dir inside the repo, then copy
  // the result back to our generated/ tree ourselves.
  const stageDir = ensureDir(path.join(env.AVATAR_REPO_DIR, "smartai_stage"));
  const stagedAudio = path.join(stageDir, "input.wav");
  const stagedOut = path.join(stageDir, "out.mp4");
  const hasSpace = (p: string) => /\s/.test(p);

  try {
    // Wav2Lip writes an intermediate temp/result.avi in its repo dir and fails
    // with an OpenCV error if that folder is missing — guarantee it exists.
    ensureDir(path.join(env.AVATAR_REPO_DIR, "temp"));
    fs.copyFileSync(audioWavPath, stagedAudio);
    // The face image path may itself contain spaces; stage it too if so.
    let faceArg = env.AVATAR_FACE_IMAGE;
    if (hasSpace(faceArg)) {
      const stagedFace = path.join(stageDir, `face${path.extname(faceArg) || ".jpg"}`);
      fs.copyFileSync(faceArg, stagedFace);
      faceArg = stagedFace;
    }

    if (env.AVATAR_ENGINE === "wav2lip") {
      await runPython(
        [
          "inference.py",
          "--checkpoint_path", checkpointPath(),
          "--face", faceArg,
          "--audio", stagedAudio,
          "--outfile", stagedOut,
          "--nosmooth",
          // Downscale for CPU speed — invisible in the small corner overlay.
          "--resize_factor", String(env.AVATAR_RESIZE_FACTOR),
        ],
        env.AVATAR_REPO_DIR,
        timeoutMs
      );
      if (!fs.existsSync(stagedOut)) {
        throw new Error("Wav2Lip reported success but no output file was written");
      }
      fs.copyFileSync(stagedOut, finalOut);
    } else {
      // SadTalker writes into a result dir; stage it space-free too.
      const stagedResultDir = ensureDir(path.join(stageDir, "result"));
      await runPython(
        [
          "inference.py",
          "--driven_audio", stagedAudio,
          "--source_image", faceArg,
          "--result_dir", stagedResultDir,
          "--still",
          "--preprocess", "full",
        ],
        env.AVATAR_REPO_DIR,
        timeoutMs
      );
      const produced = fs
        .readdirSync(stagedResultDir)
        .filter((f) => f.endsWith(".mp4"))
        .map((f) => path.join(stagedResultDir, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
      if (!produced) throw new Error("SadTalker produced no mp4 output");
      fs.copyFileSync(produced, finalOut);
    }

    return finalOut;
  } catch (error) {
    // Never fail the whole lesson because the optional avatar failed.
    logger.warn("Talking-head generation failed; falling back to board-only video", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
}
