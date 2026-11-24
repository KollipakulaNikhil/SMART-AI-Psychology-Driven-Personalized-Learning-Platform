"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, BookOpen, Check, FileText, Mic, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The left half of the welcome screen: a frosted panel that tells the product
 * story in short scenes, one after another, on a loop. Purely decorative — the
 * whole panel is aria-hidden and the page works without it.
 */

const SCENE_MS = 3800;

function Headline({ dark, light }: { dark: string; light?: string }) {
  return (
    <p className="text-center text-[22px] font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
      {dark} {light && <span className="text-neutral-400 dark:text-neutral-500">{light}</span>}
    </p>
  );
}

const chip =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[13px] text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";
const darkChip =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-900 px-3 py-1.5 text-[13px] text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)] dark:bg-neutral-100 dark:text-neutral-900";

function AskScene() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Headline dark="What are we learning today?" />
      <div className="w-[420px] rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.25)] dark:border-neutral-700 dark:bg-neutral-900">
        <p className="px-1 text-[14px] text-neutral-400">
          Message SMART AI<span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-neutral-700" />
        </p>
        <div className="mt-4 flex items-center gap-1.5">
          <span className={cn(chip, "px-2.5 py-1 text-[12px]")}><Sparkles className="h-3 w-3" />Make a lesson</span>
          <span className={cn(chip, "px-2.5 py-1 text-[12px]")}><FileText className="h-3 w-3" />From my PDF</span>
          <span className={cn(chip, "px-2.5 py-1 text-[12px]")}><Check className="h-3 w-3" />Quiz me</span>
          <Mic className="ml-auto h-4 w-4 text-neutral-400" />
          <span className="grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
            <ArrowUp className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function GoogleScene() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Headline dark="One tap" light="to begin." />
      <motion.div
        initial={{ scale: 0.94 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.3 }}
        className={cn(darkChip, "gap-3 rounded-xl py-2.5 pl-3 pr-2 text-[14px]")}
      >
        <span className="grid h-5 w-5 place-items-center rounded bg-white text-[11px] font-bold text-neutral-900">G</span>
        Continue with Google
        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wider text-neutral-900">RECOMMENDED</span>
      </motion.div>
    </div>
  );
}

const TRAITS = ["Visual", "Quick pace", "Beginner", "Short sessions", "Examples first", "Exam focus"];

function DiscoveryScene() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Headline dark="Three minutes" light="of discovery." />
      <span className={cn(darkChip, "rounded-xl px-4 py-2.5 text-[14px]")}>
        <BookOpen className="h-4 w-4" /> Discovery complete
        <span className="ml-3 grid h-5 w-5 place-items-center rounded-full bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white">
          <Check className="h-3 w-3" />
        </span>
      </span>
      <div className="flex max-w-[380px] flex-wrap justify-center gap-2">
        {TRAITS.map((t, i) => (
          <motion.span
            key={t}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.12 }}
            className={i % 3 === 0 ? darkChip : chip}
          >
            {t}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function LessonCard({ subject, title, tags, blurb, faded }: { subject: string; title: string; tags: string[]; blurb: string; faded?: boolean }) {
  return (
    <div
      className={cn(
        "w-[250px] rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900",
        faded ? "scale-90 opacity-60 blur-[1px]" : "shadow-[0_24px_50px_-24px_rgba(0,0,0,0.35)]"
      )}
    >
      <p className="flex items-center gap-2 text-[12px] text-neutral-500">
        <span className="grid h-5 w-5 place-items-center rounded border border-neutral-300 text-[10px] font-semibold text-neutral-800 dark:text-neutral-200">
          {subject[0]}
        </span>
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{subject}</span> Grade 10
      </p>
      <p className="mt-2 text-[17px] font-semibold text-neutral-900 dark:text-neutral-50">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className={cn(darkChip, "rounded-md px-2 py-0.5 text-[11.5px]")}>
            {t}
          </span>
        ))}
      </div>
      <p className="mt-2 truncate text-[12px] text-neutral-500">{blurb}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className={cn(darkChip, "rounded-md px-2 py-0.5 text-[11.5px]")}>Made for you</span>
        <span className={cn(darkChip, "rounded-lg px-3 py-1 text-[12px]")}>Open lesson</span>
      </div>
    </div>
  );
}

function LessonScene() {
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-[13px] text-neutral-500">
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">smart ai.</span> Your lesson, written in 40 seconds.
      </p>
      <div className="relative flex items-center">
        <div className="-mr-32">
          <LessonCard faded subject="Physics" title="Newton's laws" tags={["Video"]} blurb="Why a push keeps going…" />
        </div>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="relative z-10">
          <LessonCard
            subject="Biology"
            title="Photosynthesis"
            tags={["6 slides", "Hindi", "8 min"]}
            blurb="How plants turn sunlight into sugar, step by step."
          />
        </motion.div>
        <div className="-ml-32">
          <LessonCard faded subject="Chemistry" title="Atoms" tags={["Board"]} blurb="What everything is built from…" />
        </div>
      </div>
    </div>
  );
}

const INBOX: [string, string, string][] = [
  ["Review today", "Photosynthesis · 3 questions", "Fri"],
  ["Nothing due", "You're all caught up. Back tomorrow.", "Thu"],
  ["Review today", "Cell division · 2 questions", "Wed"],
];

function ReviewScene() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Headline dark="Some days," light="a review." />
      <div className="w-[340px] rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.25)] dark:border-neutral-700 dark:bg-neutral-900">
        <p className="flex justify-between px-1 text-[12px]">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Review</span>
          <span className="text-neutral-400">from SMART AI</span>
        </p>
        {INBOX.map(([title, line, day], i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className={cn(
              "mt-1.5 flex items-center gap-3 rounded-xl px-2 py-2",
              i === 0 && "bg-neutral-50 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700"
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-[9px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
              ai
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium text-neutral-900 dark:text-neutral-100">{title}</span>
              <span className="block truncate text-[11px] text-neutral-500">{line}</span>
            </span>
            <span className="text-[11px] text-neutral-400">{day}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SetupScene() {
  const formats: [string, boolean][] = [["Video", true], ["Board", false], ["Quiz", true]];
  const langs: [string, boolean][] = [["English", false], ["हिन्दी", true], ["Español", false]];
  return (
    <div className="flex flex-col items-center gap-3">
      {[formats, langs].map((row, r) => (
        <div key={r} className="flex gap-2">
          {row.map(([label, on]) => (
            <span key={label} className={on ? darkChip : chip}>
              {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {label}
            </span>
          ))}
        </div>
      ))}
      <div className="mt-2 w-[340px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.25)] dark:border-neutral-700 dark:bg-neutral-900">
        <p className="flex items-baseline justify-between text-[13px] text-neutral-500">
          Lesson length
          <span>
            <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">8</span> min
          </span>
        </p>
        <div className="relative mt-3 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-neutral-900 dark:bg-neutral-100"
            initial={{ width: "20%" }}
            animate={{ width: "48%" }}
            transition={{ duration: 1.2, delay: 0.3 }}
          />
          <motion.span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-900 bg-white dark:border-neutral-100 dark:bg-neutral-900"
            initial={{ left: "20%" }}
            animate={{ left: "48%" }}
            transition={{ duration: 1.2, delay: 0.3 }}
          />
        </div>
      </div>
      <span className={cn(darkChip, "mt-3 rounded-xl px-5 py-2.5 text-[14px]")}>Start learning</span>
    </div>
  );
}

const SCENES = [AskScene, GoogleScene, DiscoveryScene, LessonScene, ReviewScene, SetupScene];

export function WelcomeStory() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => window.clearInterval(id);
  }, []);

  const Scene = SCENES[index];
  return (
    <div
      aria-hidden
      className="relative h-full min-h-[520px] overflow-hidden rounded-[28px] bg-neutral-100 dark:bg-neutral-900/60"
    >
      {/* ghost rows: a blurred feed behind the scene, like the app at a distance */}
      <div className="absolute inset-0 opacity-70 blur-[3px]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="mx-6 mt-7 flex gap-3">
            <span className="h-2 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <span className="h-2 flex-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800/70" />
            <span className="h-2 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          </div>
        ))}
      </div>
      {/* soft frosted edge */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(245,245,245,0.95)_80%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(23,23,23,0.95)_80%)]" />

      <div className="relative grid h-full place-items-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(10px)", scale: 0.97 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(10px)", scale: 1.02 }}
            transition={{ duration: 0.45 }}
          >
            <Scene />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
