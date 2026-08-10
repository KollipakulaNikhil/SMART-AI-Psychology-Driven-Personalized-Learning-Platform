import fs from "fs";
import path from "path";
import { DIRS, ensureDir } from "../utils/paths";
import type { SlideContent } from "../models/Presentation";

/**
 * Generates SRT + WebVTT captions for a lesson video from the narration
 * scripts and the *measured* per-slide audio durations, so cues line up with
 * the exact video the pipeline assembled (cover → narrated slides → closing).
 * Within a slide, the narration time is distributed across sentences
 * proportionally to their length.
 */

interface Cue {
  startSec: number;
  endSec: number;
  text: string;
}

/** Splits a script into speakable cue chunks (sentences; long ones halved). */
function toCueChunks(script: string): string[] {
  const sentences = script
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .filter((s) => s.length > 0);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= 95) {
      chunks.push(sentence);
      continue;
    }
    // Split an overlong sentence near its midpoint at a word boundary.
    const words = sentence.split(" ");
    const mid = Math.ceil(words.length / 2);
    chunks.push(words.slice(0, mid).join(" "), words.slice(mid).join(" "));
  }
  return chunks;
}

function formatTimestamp(totalSec: number, separator: "," | "."): string {
  const clamped = Math.max(0, totalSec);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(millis, 3)}`;
}

export interface SubtitleTimingInput {
  slides: SlideContent[];
  /** Silent cover segment length (seconds). */
  coverSec: number;
  /** Padding appended after each slide's narration in the video. */
  tailPaddingSec: number;
}

function buildCues({ slides, coverSec, tailPaddingSec }: SubtitleTimingInput): Cue[] {
  const cues: Cue[] = [];
  let cursor = coverSec;

  for (const slide of slides) {
    const narrationSec = slide.audioDurationSec ?? 0;
    if (narrationSec <= 0 || !slide.script) {
      cursor += narrationSec + tailPaddingSec;
      continue;
    }

    const chunks = toCueChunks(slide.script);
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0) || 1;

    let within = 0;
    for (const chunk of chunks) {
      const share = (chunk.length / totalChars) * narrationSec;
      cues.push({
        startSec: cursor + within,
        endSec: cursor + Math.min(narrationSec, within + share),
        text: chunk,
      });
      within += share;
    }
    cursor += narrationSec + tailPaddingSec;
  }
  return cues;
}

export interface SubtitleFiles {
  srtPath: string;
  vttPath: string;
}

export function buildLessonSubtitles(
  presentationId: string,
  timing: SubtitleTimingInput
): SubtitleFiles {
  const cues = buildCues(timing);
  const dir = ensureDir(DIRS.subtitles);

  const srt = cues
    .map(
      (cue, i) =>
        `${i + 1}\n${formatTimestamp(cue.startSec, ",")} --> ${formatTimestamp(cue.endSec, ",")}\n${cue.text}\n`
    )
    .join("\n");
  const srtPath = path.join(dir, `${presentationId}.srt`);
  fs.writeFileSync(srtPath, srt, "utf-8");

  const vtt =
    "WEBVTT\n\n" +
    cues
      .map(
        (cue) =>
          `${formatTimestamp(cue.startSec, ".")} --> ${formatTimestamp(cue.endSec, ".")}\n${cue.text}\n`
      )
      .join("\n");
  const vttPath = path.join(dir, `${presentationId}.vtt`);
  fs.writeFileSync(vttPath, vtt, "utf-8");

  return { srtPath, vttPath };
}
