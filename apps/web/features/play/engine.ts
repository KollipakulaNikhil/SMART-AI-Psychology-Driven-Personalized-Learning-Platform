/**
 * Shared, framework-free helpers for the quiz games: scene geometry utilities,
 * scoring, and tiny synthesized sound cues. Nothing here touches React.
 */

import type { AttentionSpan } from "@/lib/types";

/** Every scene draws into the same 1000×620 viewBox. */
export const VB_W = 1000;
export const VB_H = 620;

/** Seconds a scene takes to move from one question's spot to the next. */
export const TRANSITION_SEC = 1.1;

export type Pt = readonly [number, number];

/** Catmull-Rom through the points, emitted as cubic Béziers. */
export function smoothPath(points: Pt[]): string {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Points along a path between two fractions of its length — keyframes for a cursor. */
export function samplePath(path: SVGPathElement, fromFrac: number, toFrac: number, steps = 28) {
  const len = path.getTotalLength();
  const xs: number[] = [];
  const ys: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const p = path.getPointAtLength(len * (fromFrac + (toFrac - fromFrac) * (k / steps)));
    xs.push(p.x);
    ys.push(p.y);
  }
  return { xs, ys };
}

/** Deterministic PRNG so decorative scatter (stars, grass) is stable across renders. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export const BASE_POINTS = 100;
export const TIME_BONUS_MAX = 50;

/** Round length follows attention span — short-attention learners get brisker rounds. */
export function roundSecondsFor(attention: AttentionSpan): number {
  return attention === "low" ? 15 : attention === "high" ? 25 : 20;
}

/** Questions per stage; the last question of each stage (and of the quiz) is a boss round. */
export const STAGE_SIZE = 5;
export const BOSS_MULTIPLIER = 2;
/** Seconds the Time Warp lifeline adds to the open round. */
export const TIME_WARP_SEC = 10;
/** Correct answers in a row that earn a shield (absorbs one miss, keeps the combo). */
export const SHIELD_STREAK = 4;

export const stageOf = (index: number) => Math.floor(index / STAGE_SIZE);
export const stageCount = (total: number) => Math.ceil(total / STAGE_SIZE);
export const isBossRound = (index: number, total: number) => (index + 1) % STAGE_SIZE === 0 || index === total - 1;

/** Stars for a stage from its accuracy: 3 ≥ 80%, 2 ≥ 60%, 1 ≥ 30%. */
export function starsFor(correct: number, count: number): number {
  const r = count === 0 ? 0 : correct / count;
  return r >= 0.8 ? 3 : r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0;
}

export function comboMultiplier(combo: number): number {
  return combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
}

export function pointsFor(timeLeftSec: number, roundSec: number, combo: number, boss = false): number {
  const bonus = Math.round(TIME_BONUS_MAX * Math.min(1, timeLeftSec / roundSec));
  return Math.round((BASE_POINTS + bonus) * comboMultiplier(combo) * (boss ? BOSS_MULTIPLIER : 1));
}

// ── Sound (tiny synthesized cues; no assets, no network) ────────────────────

export type ToneKind = "correct" | "wrong" | "step" | "summit" | "lifeline" | "boss" | "shield" | "stage";

let audioCtx: AudioContext | null = null;

function beep(ctx: AudioContext, freq: number, at: number, dur: number, gain = 0.08, type: OscillatorType = "sine") {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export function playTone(kind: ToneKind) {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t = audioCtx.currentTime;
    switch (kind) {
      case "correct":
        beep(audioCtx, 660, t, 0.12);
        beep(audioCtx, 990, t + 0.09, 0.18);
        break;
      case "wrong":
        beep(audioCtx, 196, t, 0.22, 0.07, "triangle");
        break;
      case "step":
        beep(audioCtx, 520, t, 0.05, 0.03);
        break;
      case "lifeline":
        beep(audioCtx, 880, t, 0.08, 0.06, "square");
        beep(audioCtx, 1320, t + 0.07, 0.14, 0.05, "square");
        break;
      case "shield":
        beep(audioCtx, 392, t, 0.1, 0.07, "triangle");
        beep(audioCtx, 587, t + 0.08, 0.2, 0.07, "triangle");
        break;
      case "boss":
        beep(audioCtx, 110, t, 0.35, 0.09, "sawtooth");
        beep(audioCtx, 165, t + 0.18, 0.4, 0.07, "sawtooth");
        break;
      case "stage":
        [440, 554, 659].forEach((f, i) => beep(audioCtx!, f, t + i * 0.09, 0.22, 0.06));
        break;
      case "summit":
        [523, 659, 784, 1047].forEach((f, i) => beep(audioCtx!, f, t + i * 0.11, 0.3, 0.07));
        break;
    }
  } catch {
    // Audio is decoration — never let it break the game.
  }
}
