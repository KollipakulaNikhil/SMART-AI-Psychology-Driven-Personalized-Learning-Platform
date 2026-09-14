"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion, type MotionValue } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { checkPlayAnswer, submitQuizAttempt } from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import type { PresentationDetail, QuizAttemptResult, QuizQuestion } from "@/lib/types";
import { TRANSITION_SEC, comboMultiplier, playTone, pointsFor, roundSecondsFor, type ToneKind } from "./engine";

export type Phase = "intro" | "question" | "revealed" | "walking" | "summit";

export interface RoundResult {
  answer: number | null;
  correct: boolean;
  correctIndex: number;
  explanation: string;
  points: number;
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
        const nextCombo = graded.correct ? combo + 1 : 0;
        const points = graded.correct ? pointsFor(remaining, roundSec, nextCombo) : 0;
        setResults((prev) => [...prev, { answer: choice, ...graded, points }]);
        setCombo(nextCombo);
        setBestCombo((b) => Math.max(b, nextCombo));
        setPhase("revealed");
        sound(graded.correct ? "correct" : "wrong");
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
    [phase, lesson.id, index, combo, roundSec, timeLeft, sound]
  );
  const submitRef = useRef(submitAnswer);
  submitRef.current = submitAnswer;

  // Countdown: rAF while a question is open; hitting zero answers with null.
  useEffect(() => {
    if (phase !== "question") return;
    answeringRef.current = false;
    const startAt = performance.now();
    timeLeft.set(roundSec);
    let raf = 0;
    const tick = (now: number) => {
      const remaining = Math.max(0, roundSec - (now - startAt) / 1000);
      timeLeft.set(remaining);
      if (remaining <= 0) {
        void submitRef.current(null);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, index, roundSec, timeLeft]);

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
      setIndex(to);
      setPhase("question");
    }
  }, [phase, index, total, reduceMotion, progress, sound]);

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
    progress.set(0);
    setRunId((r) => r + 1);
    setPhase("question");
  }, [progress]);

  // ── Finish: record the whole run through the real grader (SM-2 + streak) ─
  useEffect(() => {
    if (phase !== "summit" || attempt || submitting || results.length !== total) return;
    setSubmitting(true);
    const answers = results.map((r, i) =>
      r.answer ?? (r.correctIndex + 1) % Math.max(2, questions[i].options.length)
    );
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
          void submitAnswer(k);
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
  }, [phase, index, questions, results, submitAnswer, start, next]);

  const setMuted = useCallback((update: (m: boolean) => boolean) => setMutedState(update), []);

  const question = questions[index];
  const current = phase === "revealed" ? results[results.length - 1] ?? null : null;

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
