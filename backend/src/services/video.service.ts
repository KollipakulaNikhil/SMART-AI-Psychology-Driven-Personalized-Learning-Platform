import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/ApiError";
import { DIRS, ensureDir } from "../utils/paths";
import { DEFAULT_LANGUAGE, type LessonLanguage } from "../config/languages";

/* eslint-disable @typescript-eslint/no-var-requires */
const ffmpegStatic: string | null = require("ffmpeg-static");
const ffprobeStatic: { path: string } = require("ffprobe-static");

const FFMPEG = env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const FFPROBE = env.FFPROBE_PATH || ffprobeStatic.path || "ffprobe";

const FADE = 0.4;
/** Breathing room appended after each narration clip — subtitle timing depends on it. */
export const TAIL_PADDING = 0.7;

function runProcess(binary: string, args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(new Error(`${label} failed to start: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

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

interface SegmentSpec {
  imagePath: string;
  /** Narration mp3; omit for silent cover/closing segments. */
  audioPath?: string;
  /** Used when audioPath is absent. */
  silentDurationSec?: number;
  outPath: string;
}

/** Renders one slide segment: still image + narration (or silence), faded in/out. */
async function buildSegment(spec: SegmentSpec): Promise<number> {
  const duration = spec.audioPath
    ? (await probeDurationSec(spec.audioPath)) + TAIL_PADDING
    : (spec.silentDurationSec ?? 3);

  const fadeOutStart = Math.max(0, duration - FADE).toFixed(3);
  const videoFilter = [
    "scale=1920:1080:force_original_aspect_ratio=decrease",
    "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0F172A",
    "format=yuv420p",
    `fade=t=in:st=0:d=${FADE}`,
    `fade=t=out:st=${fadeOutStart}:d=${FADE}`,
  ].join(",");

  const audioInputArgs = spec.audioPath
    ? ["-i", spec.audioPath]
    : ["-f", "lavfi", "-t", duration.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];

  const args = [
    "-y",
    "-loop", "1",
    "-framerate", "30",
    "-i", spec.imagePath,
    ...audioInputArgs,
    "-t", duration.toFixed(3),
    "-vf", videoFilter,
    "-af", `apad=pad_dur=${TAIL_PADDING}`,
    "-c:v", "libx264",
    "-preset", "medium",
    "-tune", "stillimage",
    "-crf", "22",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "44100",
    "-ac", "2",
    "-shortest",
    spec.outPath,
  ];

  await runProcess(FFMPEG, args, `ffmpeg segment ${path.basename(spec.outPath)}`);
  return duration;
}

function ffmpegPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

/**
 * Renders one board segment from an ordered list of reveal frames, timing them
 * evenly across the narration so terms/diagrams appear as the narrator speaks.
 * Falls back to a single-still segment when only one frame is supplied.
 */
async function buildProgressiveSegment(
  frames: string[],
  audioPath: string | undefined,
  silentDurationSec: number,
  outPath: string
): Promise<number> {
  if (frames.length <= 1) {
    return buildSegment({ imagePath: frames[0], audioPath, silentDurationSec, outPath });
  }

  const duration = audioPath ? (await probeDurationSec(audioPath)) + TAIL_PADDING : silentDurationSec;
  const per = duration / frames.length;

  const listPath = outPath.replace(/\.mp4$/, "-frames.txt");
  const lines: string[] = [];
  for (const frame of frames) {
    lines.push(`file '${ffmpegPath(frame)}'`);
    lines.push(`duration ${per.toFixed(3)}`);
  }
  // The concat demuxer ignores the final duration, so repeat the last frame.
  lines.push(`file '${ffmpegPath(frames[frames.length - 1])}'`);
  fs.writeFileSync(listPath, lines.join("\n"), "utf-8");

  const fadeOutStart = Math.max(0, duration - FADE).toFixed(3);
  const videoFilter = `fps=30,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeOutStart}:d=${FADE}`;

  const audioInputArgs = audioPath
    ? ["-i", audioPath]
    : ["-f", "lavfi", "-t", duration.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];

  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    ...audioInputArgs,
    "-t", duration.toFixed(3),
    "-vf", videoFilter,
    ...(audioPath ? ["-af", "apad"] : []),
    "-map", "0:v",
    "-map", "1:a",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "44100",
    "-ac", "2",
    outPath,
  ];

  await runProcess(FFMPEG, args, `ffmpeg board segment ${path.basename(outPath)}`);
  return duration;
}

/** Extracts a 16 kHz mono WAV (what Wav2Lip/SadTalker expect) from a rendered video. */
export async function extractAudioWav(videoPath: string, outWavPath: string): Promise<string> {
  await runProcess(
    FFMPEG,
    ["-y", "-i", videoPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", outWavPath],
    "ffmpeg extract audio"
  );
  return outWavPath;
}

/**
 * Composites a lip-synced presenter clip as a bordered card in the bottom-left
 * (the zone the board renderer keeps clear), preserving the board's audio.
 */
export async function overlayPresenter(
  boardVideoPath: string,
  presenterVideoPath: string,
  outPath: string
): Promise<void> {
  await runProcess(
    FFMPEG,
    [
      "-y",
      "-i", boardVideoPath,
      "-i", presenterVideoPath,
      "-filter_complex",
      "[1:v]scale=348:-1,pad=iw+12:ih+12:6:6:color=0x22D3EE[pip];[0:v][pip]overlay=x=48:y=H-h-48[out]",
      "-map", "[out]",
      "-map", "0:a",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "22",
      "-pix_fmt", "yuv420p",
      "-c:a", "copy",
      outPath,
    ],
    "ffmpeg presenter overlay"
  );
}

/**
 * Escapes a path for use inside an ffmpeg filtergraph option value:
 * forward slashes, and the drive-letter colon escaped for the filter parser.
 */
function filterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/**
 * Burns SRT captions into the video (re-encodes). Styled to sit above the
 * bottom edge in a readable size against the dark board.
 */
/**
 * libass renders with the exact font named here — it does not fall back per
 * glyph the way a browser does, so a Devanagari/Telugu/Tamil caption burned
 * with Segoe UI comes out as tofu boxes. Nirmala UI is the Windows system font
 * that covers those scripts.
 */
function subtitleFontFor(language: LessonLanguage): string {
  switch (language) {
    case "hi":
    case "te":
    case "ta":
      return "Nirmala UI";
    default:
      return "Segoe UI";
  }
}

export async function burnSubtitles(
  videoPath: string,
  srtPath: string,
  outPath: string,
  language: LessonLanguage = DEFAULT_LANGUAGE
): Promise<void> {
  const style =
    `FontName=${subtitleFontFor(language)},FontSize=17,PrimaryColour=&H00FFFFFF,OutlineColour=&HAA000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=28`;
  await runProcess(
    FFMPEG,
    [
      "-y",
      "-i", videoPath,
      "-vf", `subtitles=filename='${filterPath(srtPath)}':force_style='${style}'`,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "22",
      "-pix_fmt", "yuv420p",
      "-c:a", "copy",
      outPath,
    ],
    "ffmpeg subtitle burn-in"
  );
}

function writeConcatList(files: string[], listPath: string): void {
  const content = files.map((f) => `file '${ffmpegPath(f)}'`).join("\n");
  fs.writeFileSync(listPath, content, "utf-8");
}

async function concatWithDemuxer(files: string[], listPath: string, outPath: string): Promise<void> {
  writeConcatList(files, listPath);
  await runProcess(
    FFMPEG,
    ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
    "ffmpeg concat"
  );
}

async function mixBackgroundMusic(videoPath: string, musicPath: string, outPath: string): Promise<void> {
  await runProcess(
    FFMPEG,
    [
      "-y",
      "-i", videoPath,
      "-stream_loop", "-1",
      "-i", musicPath,
      "-filter_complex",
      "[1:a]volume=0.07[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[mixed]",
      "-map", "0:v",
      "-map", "[mixed]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "160k",
      outPath,
    ],
    "ffmpeg background music mix"
  );
}

export interface VideoSlideInput {
  imagePath: string;
  audioPath?: string;
}

export interface VideoBuildResult {
  videoPath: string;
  durationSec: number;
  sizeBytes: number;
}

/**
 * Assembles the final MP4: cover (silent) → narrated slides → closing slide,
 * each faded in/out, concatenated losslessly, with optional background music.
 */
export async function buildLessonVideo(
  presentationId: string,
  slides: VideoSlideInput[]
): Promise<VideoBuildResult> {
  if (slides.length === 0) throw ApiError.unprocessable("No slides available to build a video");

  const workDir = ensureDir(path.join(DIRS.video, presentationId));
  const finalPath = path.join(DIRS.video, `${presentationId}.mp4`);

  const segmentPaths: string[] = [];
  let totalDuration = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (!fs.existsSync(slide.imagePath)) {
      throw ApiError.unprocessable(`Missing rendered slide image for segment ${i + 1}`);
    }
    const outPath = path.join(workDir, `segment-${String(i + 1).padStart(2, "0")}.mp4`);
    const duration = await buildSegment({
      imagePath: slide.imagePath,
      audioPath: slide.audioPath && fs.existsSync(slide.audioPath) ? slide.audioPath : undefined,
      silentDurationSec: 3.2,
      outPath,
    });
    segmentPaths.push(outPath);
    totalDuration += duration;
    logger.debug(`Video segment ${i + 1}/${slides.length} rendered (${duration.toFixed(1)}s)`);
  }

  const concatTarget = path.join(workDir, "concat-output.mp4");
  await concatWithDemuxer(segmentPaths, path.join(workDir, "segments.txt"), concatTarget);

  if (env.BACKGROUND_MUSIC_PATH && fs.existsSync(env.BACKGROUND_MUSIC_PATH)) {
    await mixBackgroundMusic(concatTarget, env.BACKGROUND_MUSIC_PATH, finalPath);
  } else {
    fs.copyFileSync(concatTarget, finalPath);
  }

  // Clean intermediate segments; keep only the final artifact.
  fs.rmSync(workDir, { recursive: true, force: true });

  const sizeBytes = fs.statSync(finalPath).size;
  return { videoPath: finalPath, durationSec: Math.round(totalDuration), sizeBytes };
}

export interface BoardSegmentInput {
  /** Ordered reveal frames for this segment (1 = static cover/closing). */
  frames: string[];
  /** Narration for content segments; omit for silent cover/closing. */
  audioPath?: string;
  silentDurationSec?: number;
}

/**
 * Builds the clean board video (no music yet): cover → progressively-revealed
 * narrated slides → closing, concatenated. Returns the intermediate path so an
 * optional presenter overlay can be composited before finalizing.
 */
export async function buildBoardVideo(
  presentationId: string,
  segments: BoardSegmentInput[]
): Promise<{ boardVideoPath: string; durationSec: number }> {
  if (segments.length === 0) throw ApiError.unprocessable("No board segments available to build a video");

  const workDir = ensureDir(path.join(DIRS.video, `${presentationId}-work`));
  const boardVideoPath = path.join(DIRS.video, `${presentationId}-board.mp4`);

  const segmentPaths: string[] = [];
  let totalDuration = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const usableFrames = segment.frames.filter((f) => fs.existsSync(f));
    if (usableFrames.length === 0) {
      throw ApiError.unprocessable(`Missing rendered board frames for segment ${i + 1}`);
    }
    const outPath = path.join(workDir, `segment-${String(i + 1).padStart(2, "0")}.mp4`);
    const audioPath =
      segment.audioPath && fs.existsSync(segment.audioPath) ? segment.audioPath : undefined;
    const duration = await buildProgressiveSegment(
      usableFrames,
      audioPath,
      segment.silentDurationSec ?? 4,
      outPath
    );
    segmentPaths.push(outPath);
    totalDuration += duration;
    logger.debug(`Board segment ${i + 1}/${segments.length} rendered (${duration.toFixed(1)}s)`);
  }

  await concatWithDemuxer(segmentPaths, path.join(workDir, "segments.txt"), boardVideoPath);
  fs.rmSync(workDir, { recursive: true, force: true });

  return { boardVideoPath, durationSec: Math.round(totalDuration) };
}

/**
 * Produces the final lesson MP4 from a base video (board, or board+presenter):
 * mixes optional background music, writes `<id>.mp4`, and cleans up the base.
 */
export async function finalizeLessonVideo(
  baseVideoPath: string,
  presentationId: string
): Promise<VideoBuildResult> {
  const finalPath = path.join(DIRS.video, `${presentationId}.mp4`);

  if (env.BACKGROUND_MUSIC_PATH && fs.existsSync(env.BACKGROUND_MUSIC_PATH)) {
    await mixBackgroundMusic(baseVideoPath, env.BACKGROUND_MUSIC_PATH, finalPath);
    if (baseVideoPath !== finalPath) fs.rmSync(baseVideoPath, { force: true });
  } else if (baseVideoPath !== finalPath) {
    fs.renameSync(baseVideoPath, finalPath);
  }

  const durationSec = Math.round(await probeDurationSec(finalPath));
  const sizeBytes = fs.statSync(finalPath).size;
  return { videoPath: finalPath, durationSec, sizeBytes };
}

/** Concatenates per-slide narration mp3s into one downloadable lesson audio track. */
export async function concatNarrationAudio(
  presentationId: string,
  audioPaths: string[]
): Promise<string> {
  const existing = audioPaths.filter((p) => fs.existsSync(p));
  if (existing.length === 0) throw ApiError.unprocessable("No narration audio found to combine");

  const dir = ensureDir(path.join(DIRS.audio, presentationId));
  const outPath = path.join(dir, "lesson-full.mp3");
  await concatWithDemuxer(existing, path.join(dir, "audio-list.txt"), outPath);
  return outPath;
}
