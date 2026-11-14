import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { env } from "@smart-ai/core/config/env";
import { logger } from "@smart-ai/core/utils/logger";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { probeDurationSec } from "@smart-ai/core/services/media/ffprobe";
import { uploadArtifact, fetchArtifactBuffer } from "@smart-ai/core/storage/blob";
import { DEFAULT_LANGUAGE, type LessonLanguage } from "@smart-ai/core/config/languages";
import { createRequire } from "node:module";
import { scratchDir, scratchPath, removeScratch } from "../utils/scratch";

const require = createRequire(import.meta.url);
const ffmpegStatic: string | null = require("ffmpeg-static");
const FFMPEG = env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";

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

function ffmpegPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

/**
 * Renders one board segment from an ordered list of local reveal-frame PNGs
 * (already rendered to scratch disk by boardRenderer.service.ts) plus a
 * narration audio buffer, timing frames evenly across the narration so
 * terms/diagrams appear as the narrator speaks.
 */
async function buildProgressiveSegment(
  frames: string[],
  audioLocalPath: string | undefined,
  silentDurationSec: number,
  outPath: string
): Promise<number> {
  if (frames.length <= 1) {
    return buildSegment({ imagePath: frames[0], audioLocalPath, silentDurationSec, outPath });
  }

  const duration = audioLocalPath ? (await probeDurationSec(audioLocalPath)) + TAIL_PADDING : silentDurationSec;
  const per = duration / frames.length;

  const listPath = outPath.replace(/\.mp4$/, "-frames.txt");
  const lines: string[] = [];
  for (const frame of frames) {
    lines.push(`file '${ffmpegPath(frame)}'`);
    lines.push(`duration ${per.toFixed(3)}`);
  }
  lines.push(`file '${ffmpegPath(frames[frames.length - 1])}'`);
  fs.writeFileSync(listPath, lines.join("\n"), "utf-8");

  const fadeOutStart = Math.max(0, duration - FADE).toFixed(3);
  const videoFilter = `fps=30,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeOutStart}:d=${FADE}`;

  const audioInputArgs = audioLocalPath
    ? ["-i", audioLocalPath]
    : ["-f", "lavfi", "-t", duration.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];

  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    ...audioInputArgs,
    "-t", duration.toFixed(3),
    "-vf", videoFilter,
    ...(audioLocalPath ? ["-af", "apad"] : []),
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

/**
 * Normalises one AI-generated clip to the lesson's frame (1920x1080, 30fps)
 * and appends its own reverse, giving a seamless "ping-pong" loop: a ~5s Wan
 * clip can then be repeated under a much longer narration without the visible
 * jump a plain loop has where the last frame cuts back to the first.
 */
async function buildPingPongLoop(clipPath: string): Promise<string> {
  // Keyed by the clip, not the segment: the teacher clip appears in every
  // segment and only needs converting once per job.
  const outPath = clipPath.replace(/\.mp4$/i, "") + "-loop.mp4";
  if (fs.existsSync(outPath)) return outPath;
  const tmpPath = outPath.replace(/\.mp4$/, ".tmp.mp4");
  await runProcess(
    FFMPEG,
    [
      "-y",
      "-i", clipPath,
      "-filter_complex",
      "[0:v]fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,split[fwd][tmp];[tmp]reverse[rev];[fwd][rev]concat=n=2:v=1:a=0[v]",
      "-map", "[v]",
      "-an",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      tmpPath,
    ],
    `ffmpeg ping-pong ${path.basename(outPath)}`
  );
  fs.renameSync(tmpPath, outPath);
  return outPath;
}

/** The teacher shown talking in a round bubble over a concept animation. */
export interface TeacherBubble {
  clipPath: string;
  /** White-on-black circle PNG, BUBBLE_SIZE square — becomes the bubble's alpha. */
  maskPath: string;
}

export const BUBBLE_SIZE = 300;
/** Top-left corner of the bubble: bottom-right of the frame, clear of the centred captions. */
export const BUBBLE_POS = { x: 1560, y: 670 };

/**
 * Renders one AI-animated segment: the slide's Wan clips share the narration
 * time equally (each looping for its share), the title/key-term overlay is
 * composited on top, and the narration is muxed in. Encoded with the same
 * parameters as the board segments so everything still concat-copies.
 */
async function buildAnimatedSegment(
  clips: string[],
  overlayPath: string | undefined,
  audioLocalPath: string | undefined,
  silentDurationSec: number,
  outPath: string,
  bubble?: TeacherBubble
): Promise<number> {
  const duration = audioLocalPath ? (await probeDurationSec(audioLocalPath)) + TAIL_PADDING : silentDurationSec;
  const share = duration / clips.length;

  const args: string[] = ["-y"];
  for (let i = 0; i < clips.length; i++) {
    const loopPath = await buildPingPongLoop(clips[i]);
    // A hair over the share so rounding can never leave the last frames empty.
    args.push("-stream_loop", "-1", "-t", (share + 0.1).toFixed(3), "-i", loopPath);
  }
  let nextInput = clips.length;
  let bubbleIndex = -1;
  if (bubble) {
    const teacherLoop = await buildPingPongLoop(bubble.clipPath);
    bubbleIndex = nextInput;
    args.push("-stream_loop", "-1", "-t", (duration + 0.1).toFixed(3), "-i", teacherLoop);
    args.push("-loop", "1", "-framerate", "30", "-i", bubble.maskPath);
    nextInput += 2;
  }
  const overlayIndex = nextInput;
  if (overlayPath) args.push("-loop", "1", "-framerate", "30", "-i", overlayPath);
  const audioIndex = overlayIndex + (overlayPath ? 1 : 0);
  args.push(
    ...(audioLocalPath
      ? ["-i", audioLocalPath]
      : ["-f", "lavfi", "-t", duration.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"])
  );

  const fadeOutStart = Math.max(0, duration - FADE).toFixed(3);
  const chain: string[] = [];
  let current = "0:v";
  if (clips.length > 1) {
    chain.push(`${clips.map((_, i) => `[${i}:v]`).join("")}concat=n=${clips.length}:v=1:a=0[base]`);
    current = "base";
  }
  if (bubble) {
    chain.push(
      `[${bubbleIndex}:v]crop=ih:ih,scale=${BUBBLE_SIZE}:${BUBBLE_SIZE},format=yuv420p[tface]`,
      `[${bubbleIndex + 1}:v]scale=${BUBBLE_SIZE}:${BUBBLE_SIZE},format=gray[tmask]`,
      `[tface][tmask]alphamerge[tbubble]`,
      `[${current}][tbubble]overlay=${BUBBLE_POS.x}:${BUBBLE_POS.y}[withteacher]`
    );
    current = "withteacher";
  }
  if (overlayPath) {
    chain.push(`[${current}][${overlayIndex}:v]overlay=0:0[titled]`);
    current = "titled";
  }
  chain.push(`[${current}]fps=30,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeOutStart}:d=${FADE}[v]`);

  args.push(
    "-filter_complex", chain.join(";"),
    "-map", "[v]",
    "-map", `${audioIndex}:a`,
    "-t", duration.toFixed(3),
    ...(audioLocalPath ? ["-af", "apad"] : []),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "44100",
    "-ac", "2",
    outPath
  );

  await runProcess(FFMPEG, args, `ffmpeg animated segment ${path.basename(outPath)}`);
  return duration;
}

interface SegmentSpec {
  imagePath: string;
  audioLocalPath?: string;
  silentDurationSec?: number;
  outPath: string;
}

async function buildSegment(spec: SegmentSpec): Promise<number> {
  const duration = spec.audioLocalPath
    ? (await probeDurationSec(spec.audioLocalPath)) + TAIL_PADDING
    : (spec.silentDurationSec ?? 3);

  const fadeOutStart = Math.max(0, duration - FADE).toFixed(3);
  const videoFilter = [
    "scale=1920:1080:force_original_aspect_ratio=decrease",
    "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0F172A",
    "format=yuv420p",
    `fade=t=in:st=0:d=${FADE}`,
    `fade=t=out:st=${fadeOutStart}:d=${FADE}`,
  ].join(",");

  const audioInputArgs = spec.audioLocalPath
    ? ["-i", spec.audioLocalPath]
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

/**
 * Burns SRT captions into the video (re-encodes). Styled to sit above the
 * bottom edge in a readable size against the dark board.
 *
 * libass renders with the exact font named here — it does not fall back per
 * glyph the way a browser does, so a Devanagari/Telugu/Tamil caption burned
 * with Segoe UI comes out as tofu boxes. Nirmala UI is bundled on the worker
 * image alongside Segoe UI for that reason (see worker deployment notes).
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

function filterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export async function burnSubtitles(
  videoPath: string,
  srtPath: string,
  outPath: string,
  language: LessonLanguage = DEFAULT_LANGUAGE
): Promise<void> {
  const style = `FontName=${subtitleFontFor(language)},FontSize=17,PrimaryColour=&H00FFFFFF,OutlineColour=&HAA000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=28`;
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
  await runProcess(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath], "ffmpeg concat");
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

export interface BoardSegmentInput {
  /** Ordered reveal frames for this segment (local scratch paths; 1 = static cover/closing). */
  frames: string[];
  /** Narration Blob URL for content segments; omit for silent cover/closing. */
  audioUrl?: string;
  silentDurationSec?: number;
  /**
   * AI-generated clips (local scratch paths) to show instead of the board
   * frames. The frames stay as the fallback if the animated render fails.
   */
  clips?: string[];
  /** Transparent title/key-term PNG composited over the clips. */
  overlayPath?: string;
  /** The teacher, talking in a corner bubble over the clips. */
  bubble?: TeacherBubble;
}

/**
 * Builds the clean board video (no music yet): cover → progressively-revealed
 * narrated slides → closing, concatenated. Narration clips are downloaded
 * from Blob to scratch disk first since ffmpeg needs real file paths.
 */
export async function buildBoardVideo(
  presentationId: string,
  segments: BoardSegmentInput[]
): Promise<{ boardVideoPath: string; durationSec: number }> {
  if (segments.length === 0) throw ApiError.unprocessable("No board segments available to build a video");

  const workDir = scratchDir(presentationId, "video-work");
  const boardVideoPath = scratchPath(presentationId, "video", "board.mp4");
  fs.mkdirSync(path.dirname(boardVideoPath), { recursive: true });

  const segmentPaths: string[] = [];
  let totalDuration = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const usableFrames = segment.frames.filter((f) => fs.existsSync(f));
    if (usableFrames.length === 0) {
      throw ApiError.unprocessable(`Missing rendered board frames for segment ${i + 1}`);
    }

    let audioLocalPath: string | undefined;
    if (segment.audioUrl) {
      audioLocalPath = path.join(workDir, `audio-${String(i + 1).padStart(2, "0")}.mp3`);
      const buffer = await fetchArtifactBuffer(segment.audioUrl);
      fs.writeFileSync(audioLocalPath, buffer);
    }

    const outPath = path.join(workDir, `segment-${String(i + 1).padStart(2, "0")}.mp4`);
    const silentSec = segment.silentDurationSec ?? 4;
    const clips = (segment.clips ?? []).filter((c) => fs.existsSync(c));
    let duration: number | undefined;
    if (clips.length > 0) {
      try {
        const bubble = segment.bubble && fs.existsSync(segment.bubble.clipPath) ? segment.bubble : undefined;
        duration = await buildAnimatedSegment(clips, segment.overlayPath, audioLocalPath, silentSec, outPath, bubble);
      } catch (error) {
        logger.warn(`Animated segment ${i + 1} failed — falling back to the board frames`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    duration ??= await buildProgressiveSegment(usableFrames, audioLocalPath, silentSec, outPath);
    segmentPaths.push(outPath);
    totalDuration += duration;
    logger.debug(`Board segment ${i + 1}/${segments.length} rendered (${duration.toFixed(1)}s)`);
  }

  await concatWithDemuxer(segmentPaths, path.join(workDir, "segments.txt"), boardVideoPath);

  return { boardVideoPath, durationSec: Math.round(totalDuration) };
}

export interface VideoBuildResult {
  url: string;
  durationSec: number;
  sizeBytes: number;
}

/**
 * Produces the final lesson MP4 from a base video (the board render, possibly
 * with subtitles burned in): mixes optional background music, uploads the
 * result to Blob storage, and cleans up this job's scratch directory.
 */
export async function finalizeLessonVideo(baseVideoPath: string, presentationId: string): Promise<VideoBuildResult> {
  const workDir = scratchDir(presentationId, "video-work");
  const finalLocalPath = path.join(workDir, "final.mp4");

  if (env.BACKGROUND_MUSIC_PATH && fs.existsSync(env.BACKGROUND_MUSIC_PATH)) {
    await mixBackgroundMusic(baseVideoPath, env.BACKGROUND_MUSIC_PATH, finalLocalPath);
  } else if (baseVideoPath !== finalLocalPath) {
    fs.copyFileSync(baseVideoPath, finalLocalPath);
  }

  const durationSec = Math.round(await probeDurationSec(finalLocalPath));
  const sizeBytes = fs.statSync(finalLocalPath).size;
  const buffer = await fs.promises.readFile(finalLocalPath);
  const uploaded = await uploadArtifact("video", presentationId, "lesson.mp4", buffer, { contentType: "video/mp4" });

  removeScratch(presentationId);

  return { url: uploaded.url, durationSec, sizeBytes };
}
