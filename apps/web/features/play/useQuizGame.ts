"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion, type MotionValue } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { checkPlayAnswer, getPlayHint, submitQuizAttempt } from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import type { PresentationDetail, QuizAttemptResult, QuizQuestion } from "@/lib/types";
import {
  SHIELD_STREAK,
  STAGE_SIZE,
  TIME_WARP_SEC,
  TRANSITION_SEC,
  comboMultiplier,
  isBossRound,
  playTone,
  pointsFor,
  roundSecondsFor,
  stageCount,
  stageOf,
  starsFor,
  type ToneKind,
} from "./engine";

export type Phase = "intro" | "question" | "revealed" | "walking" | "summit";

export interface RoundResult {
  answer: number | null;
  correct: boolean;
  correctIndex: number;
  explanation: string;
  points: number;
  /** Boss rounds are worth double. */
  boss: boolean;
  /** A shield absorbed this miss, so the combo survived. */
  shielded: boolean;
}

export interface Lifelines {
  /** 50/50: crosses out two wrong options. */
  fifty: number;
  /** Time Warp: +10 seconds on the open question. */
  warp: number;
}

export interface Floater {
  id: number;
  text: string;
}

/**
 * A scene's transition between two question spots. Receives the question
 * indices and the duration the engine is animating `progress` over, so the
 * scene's cursor lands exactly when the next question appears.
 */
export type AdvanceFn = (from: number, to: number, durationSec: number) => Promise<unknown>;

export interface QuizGame {
  lesson: PresentationDetail;
  questions: QuizQuestion[];
  total: number;
  roundSec: number;
  phase: Phase;
  index: number;
  results: RoundResult[];
  pending: number | null;
  combo: number;
  bestCombo: number;
  score: number;
  correctCount: number;
  secs: number;
  floaters: Floater[];
  muted: boolean;
  attempt: QuizAttemptResult | null;
  lifelines: Lifelines;
  shields: number;
  /** Option indices crossed out by 50/50 on the open question. */
  eliminated: number[];
  hinting: boolean;
  /** The open question is a boss round (double points). */
  boss: boolean;
  stage: number;
  stages: number;
  /** Stars per finished stage, from accuracy. */
  stageStars: number[];
  /** Best score on this lesson before this run, and whether this run beat it. */
  best: number;
  newBest: boolean;
  castFifty: () => Promise<void>;
  castWarp: () => void;
  /** Increments on every (re)start so scenes can reset their cursors. */
  runId: number;
  /** 0 → 1 as questions are answered; animated during transitions. */
  progress: MotionValue<number>;
  /** Seconds left in the open round (counts down at frame rate). */
  timeLeft: MotionValue<number>;
  question: QuizQuestion | undefined;
  current: RoundResult | null;
  inRound: boolean;
  showQuestion: boolean;
  start: () => void;
  submitAnswer: (choice: number | null) => Promise<void>;
  next: () => Promise<void>;
  setMuted: (update: (m: boolean) => boolean) => void;
  registerAdvance: (fn: AdvanceFn | null) => void;
}

const KEYS = ["1", "2", "3", "4"];
const START_LIFELINES: Lifelines = { fifty: 1, warp: 1 };
const MAX_SHIELDS = 2;
const bestKey = (lessonId: string) => `smartai.play.best.${lessonId}`;

/**
 * The game loop shared by every scene: round timer, per-question server
 * grading, scoring/combos, transitions, keyboard, and the final SM-2 submit.
 * Scenes only draw — they read this state and register a transition animation.
 */
export function useQuizGame(lesson: PresentationDetail): QuizGame {
  const questions = lesson.quiz;
  const total = questions.length;
  const roundSec = roundSecondsFor(lesson.profileSnapshot.attentionSpan);
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [pending, setPending] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [muted, setMutedState] = useState(false);
  const [secs, setSecs] = useState(roundSec);
  const [attempt, setAttempt] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runId, setRunId] = useState(0);
  const [lifelines, setLifelines] = useState<Lifelines>(START_LIFELINES);
  const [shields, setShields] = useState(0);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [hinting, setHinting] = useState(false);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  /** Extra seconds from Time Warp on the open question. */
  const bonusRef = useRef(0);

  const score = useMemo(() => results.reduce((sum, r) => sum + r.points, 0), [results]);
  const correctCount = useMemo(() => results.filter((r) => r.correct).length, [results]);

  const progress = useMotionValue(0);
  const timeLeft = useMotionValue(roundSec);
  useMotionValueEvent(timeLeft, "change", (v) => setSecs(Math.ceil(v)));

  const advanceRef = useRef<AdvanceFn | null>(null);
  const registerAdvance = useCallback((fn: AdvanceFn | null) => {
    advanceRef.current = fn;
  }, []);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const sound = useCallback((kind: ToneKind) => {
    if (!mutedRef.current) playTone(kind);
  }, []);

  // ── Answering ─────────────────────────────────────────────────────────────
  const answeringRef = useRef(false);
  const submitAnswer = useCallback(
    async (choice: number | null) => {
      if (phase !== "question" || answeringRef.current) return;
      answeringRef.current = true;
      setPending(choice);
      const remaining = Math.max(0, timeLeft.get());
      try {
        const graded = await checkPlayAnswer(lesson.id, index, choice);
        const boss = isBossRound(index, total);
        const shielded = !graded.correct && shields > 0;
        const nextCombo = graded.correct ? combo + 1 : shielded ? combo : 0;
        const points = graded.correct ? pointsFor(remaining, roundSec + bonusRef.current, nextCombo, boss) : 0;
        setResults((prev) => [...prev, { answer: choice, ...graded, points, boss, shielded }]);
        setCombo(nextCombo);
        setBestCombo((b) => Math.max(b, nextCombo));
        if (shielded) {
          setShields((n) => n - 1);
        } else if (graded.correct && nextCombo % SHIELD_STREAK === 0) {
          setShields((n) => Math.min(MAX_SHIELDS, n + 1));
        }
        setPhase("revealed");
        sound(graded.correct ? "correct" : shielded ? "shield" : "wrong");
        if (graded.correct) {
          const id = Date.now();
          const mult = comboMultiplier(nextCombo);
          setFloaters((f) => [...f, { id, text: `+${points}${mult > 1 ? ` ×${mult}` : ""}` }]);
          setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1100);
        }
      } catch (error) {
        toast.error(toErrorMessage(error));
        answeringRef.current = false;
      } finally {
        setPending(null);
      }
    },
    [phase, lesson.id, index, total, combo, shields, roundSec, timeLeft, sound],
  );
  const submitRef = useRef(submitAnswer);
  submitRef.current = submitAnswer;

  // Countdown: rAF while a question is open; hitting zero answers with null.
  useEffect(() => {
    if (phase !== "question") return;
    answeringRef.current = false;
    bonusRef.current = 0;
    setEliminated([]);
    if (isBossRound(index, total)) sound("boss");
    const startAt = performance.now();
    timeLeft.set(roundSec);
    let raf = 0;
    const tick = (now: number) => {
      const remaining = Math.max(0, roundSec + bonusRef.current - (now - startAt) / 1000);
      timeLeft.set(remaining);
      if (remaining <= 0) {
        void submitRef.current(null);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, index, total, roundSec, timeLeft, sound]);

  // ── Lifelines ────────────────────────────────────────────────────────────
  const castFifty = useCallback(async () => {
    if (phase !== "question" || lifelines.fifty < 1 || eliminated.length > 0 || hinting || answeringRef.current) return;
    setHinting(true);
    try {
      const { eliminate } = await getPlayHint(lesson.id, index);
      setEliminated(eliminate);
      setLifelines((l) => ({ ...l, fifty: l.fifty - 1 }));
      sound("lifeline");
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setHinting(false);
    }
  }, [phase, lifelines.fifty, eliminated.length, hinting, lesson.id, index, sound]);

  const castWarp = useCallback(() => {
    if (phase !== "question" || lifelines.warp < 1 || bonusRef.current > 0 || answeringRef.current) return;
    bonusRef.current += TIME_WARP_SEC;
    setLifelines((l) => ({ ...l, warp: l.warp - 1 }));
    sound("lifeline");
  }, [phase, lifelines.warp, sound]);
  const fiftyRef = useRef(castFifty);
  fiftyRef.current = castFifty;
  const warpRef = useRef(castWarp);
  warpRef.current = castWarp;

  // ── Moving on to the next question ───────────────────────────────────────
  const next = useCallback(async () => {
    if (phase !== "revealed") return;
    const from = index;
    const to = index + 1;
    setPhase("walking");
    sound("step");
    const duration = reduceMotion ? 0 : TRANSITION_SEC;
    await Promise.all([
      animate(progress, to / total, { duration, ease: "easeInOut" }).finished,
      advanceRef.current ? advanceRef.current(from, to, duration) : Promise.resolve(),
    ]);
    if (to >= total) {
      setPhase("summit");
      sound("summit");
    } else {
      // Clearing a stage with 80%+ refuels a lifeline.
      if (to % STAGE_SIZE === 0) {
        const stageResults = results.slice(to - STAGE_SIZE, to);
        if (starsFor(stageResults.filter((r) => r.correct).length, stageResults.length) === 3) {
          setLifelines((l) => (stageOf(from) % 2 === 0 ? { ...l, fifty: l.fifty + 1 } : { ...l, warp: l.warp + 1 }));
          sound("stage");
        }
      }
      setIndex(to);
      setPhase("question");
    }
  }, [phase, index, total, results, reduceMotion, progress, sound]);

  // A correct answer moves on by itself; a miss waits so the explanation is read.
  useEffect(() => {
    if (phase !== "revealed") return;
    const last = results[results.length - 1];
    if (!last?.correct) return;
    const t = setTimeout(() => void next(), 1000);
    return () => clearTimeout(t);
  }, [phase, results, next]);

  const start = useCallback(() => {
    setResults([]);
    setIndex(0);
    setCombo(0);
    setBestCombo(0);
    setAttempt(null);
    setLifelines(START_LIFELINES);
    setShields(0);
    setEliminated([]);
    setNewBest(false);
    progress.set(0);
    setRunId((r) => r + 1);
    setPhase("question");
  }, [progress]);

  // ── Personal best (per lesson, kept in this browser) ────────────────────
  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(bestKey(lesson.id))) || 0);
    } catch {
      /* storage may be unavailable */
    }
  }, [lesson.id]);
  useEffect(() => {
    if (phase !== "summit") return;
    setNewBest(score > best);
    if (score > best) {
      try {
        localStorage.setItem(bestKey(lesson.id), String(score));
      } catch {
        /* ignore */
      }
    }
    // Evaluated once per finished run: `best` holds the pre-run value until then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Finish: record the whole run through the real grader (SM-2 + streak) ─
  useEffect(() => {
    if (phase !== "summit" || attempt || submitting || results.length !== total) return;
    setSubmitting(true);
    const answers = results.map((r, i) => r.answer ?? (r.correctIndex + 1) % Math.max(2, questions[i].options.length));
    submitQuizAttempt(lesson.id, answers)
      .then((res) => {
        setAttempt(res);
        queryClient.invalidateQueries({ queryKey: ["due-reviews"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        queryClient.invalidateQueries({ queryKey: ["courses"] });
      })
      .catch((error) => toast.error(toErrorMessage(error)))
      .finally(() => setSubmitting(false));
  }, [phase, attempt, submitting, results, total, questions, lesson.id, queryClient]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === "question") {
        const k = KEYS.indexOf(e.key);
        if (k >= 0 && k < (questions[index]?.options.length ?? 0)) {
          e.preventDefault();
          if (!eliminated.includes(k)) void submitAnswer(k);
        } else if (e.key.toLowerCase() === "f") {
          void fiftyRef.current();
        } else if (e.key.toLowerCase() === "t") {
          warpRef.current();
        }
      } else if (e.key === "Enter" || e.key === " ") {
        if (phase === "intro" || phase === "summit") {
          e.preventDefault();
          start();
        } else if (phase === "revealed" && !results[results.length - 1]?.correct) {
          e.preventDefault();
          void next();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, index, questions, results, eliminated, submitAnswer, start, next]);

  const setMuted = useCallback((update: (m: boolean) => boolean) => setMutedState(update), []);

  const stageStars = useMemo(() => {
    const out: number[] = [];
    for (let s = 0; s < stageCount(total); s++) {
      const slice = results.slice(s * STAGE_SIZE, (s + 1) * STAGE_SIZE);
      const size = Math.min(STAGE_SIZE, total - s * STAGE_SIZE);
      if (slice.length === size) out.push(starsFor(slice.filter((r) => r.correct).length, size));
    }
    return out;
  }, [results, total]);

  const question = questions[index];
  const current = phase === "revealed" ? (results[results.length - 1] ?? null) : null;

  return {
    lesson,
    questions,
    total,
    roundSec,
    phase,
    index,
    results,
    pending,
    combo,
    bestCombo,
    score,
    correctCount,
    secs,
    floaters,
    muted,
    attempt,
    lifelines,
    shields,
    eliminated,
    hinting,
    boss: isBossRound(index, total),
    stage: stageOf(index),
    stages: stageCount(total),
    stageStars,
    best,
    newBest,
    castFifty,
    castWarp,
    runId,
    progress,
    timeLeft,
    question,
    current,
    inRound: phase === "question",
    showQuestion: phase === "question" || phase === "revealed",
    start,
    submitAnswer,
    next,
    setMuted,
    registerAdvance,
  };
}
