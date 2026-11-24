"use client";

import { createContext, useContext } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { ArrowUp, Check, Play } from "lucide-react";
import { LogoMark } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

/**
 * What the phone in the story shows at each step. Each screen is a small mock
 * of a real SMART AI surface, drawn in the app's own paper palette.
 *
 * Screens are built by scroll: a 0..1 "build" value comes from the story via
 * BuildProvider, and every piece of a screen is a Beat that appears at its own
 * point. So a screen starts blank and fills in one item at a time as you
 * scroll — and empties again if you scroll back. Without a provider everything
 * is shown.
 */

const BuildContext = createContext<MotionValue<number> | null>(null);
export const BuildProvider = BuildContext.Provider;

function useBuild() {
  const fallback = useMotionValue(1);
  return useContext(BuildContext) ?? fallback;
}

/** A 0..1 value that runs from `from` to `to` of the build. */
function useBuildRange(from: number, to: number) {
  return useTransform(useBuild(), [from, to], [0, 1]);
}

/** Fades and slides in as the build passes `at`. */
function Beat({
  at,
  className,
  children,
  slide = 8,
}: {
  at: number;
  className?: string;
  children?: React.ReactNode;
  slide?: number;
}) {
  const build = useBuild();
  const opacity = useTransform(build, [at, at + 0.1], [0, 1]);
  const y = useTransform(build, [at, at + 0.1], [slide, 0]);
  return (
    <motion.div style={{ opacity, y }} className={className}>
      {children}
    </motion.div>
  );
}

function Bubble({ from, at, children }: { from: "app" | "me"; at: number; children: React.ReactNode }) {
  return (
    <Beat
      at={at}
      className={cn(
        "max-w-[78%] rounded-2xl px-3 py-2 text-[11.5px] leading-snug",
        from === "me"
          ? "ml-auto rounded-br-md bg-foreground text-background"
          : "rounded-bl-md border border-foreground/10 bg-card text-foreground"
      )}
    >
      {children}
    </Beat>
  );
}

function LearnsScreen() {
  return (
    <div className="flex h-full flex-col">
      <Beat at={0} className="flex flex-col items-center pt-6">
        <LogoMark className="h-12 w-12 rounded-xl" />
        <p className="mt-2 font-display text-sm">SMART AI</p>
      </Beat>
      <div className="mt-auto space-y-2 px-3 pb-2">
        <Beat
          at={0.1}
          className="mx-auto w-fit rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[9px] text-muted-foreground"
        >
          Today 9:41 AM
        </Beat>
        <Bubble from="app" at={0.22}>What do you want to learn?</Bubble>
        <Bubble from="me" at={0.4}>Photosynthesis. My exam is on Friday.</Bubble>
        <Bubble from="me" at={0.58}>Long text loses me — show me instead.</Bubble>
        <Bubble from="app" at={0.76}>Visual, quick pace, exam focus. Got it.</Bubble>
        <Beat at={0.88} className="text-right text-[9px] text-muted-foreground">
          Delivered
        </Beat>
      </div>
      <Beat at={0} slide={0}>
        <Composer />
      </Beat>
    </div>
  );
}

function Composer() {
  return (
    <div className="flex items-center gap-2 px-3 pb-3">
      <div className="h-8 flex-1 rounded-full border border-foreground/15 bg-card px-3 text-[11px] leading-8 text-muted-foreground">
        Message
      </div>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background">
        <ArrowUp className="h-4 w-4" aria-hidden />
      </span>
    </div>
  );
}

const SLIDES: [string, "written" | "writing" | "queued"][] = [
  ["Why plants need light", "written"],
  ["Inside the chloroplast", "written"],
  ["The light reactions", "written"],
  ["The Calvin cycle", "writing"],
  ["Sugar, stored and spent", "queued"],
  ["Exam traps to avoid", "queued"],
];

function WritesScreen() {
  return (
    <div className="flex h-full flex-col px-3 pt-3">
      <Beat at={0} className="flex items-end justify-between border-b border-foreground/10 pb-2">
        <div>
          <p className="text-[12px] font-semibold">Photosynthesis</p>
          <p className="text-[9.5px] text-muted-foreground">Writing for a visual learner</p>
        </div>
        <p className="font-display text-2xl leading-none">
          6<span className="ml-1 font-sans text-[9px] text-muted-foreground">slides</span>
        </p>
      </Beat>
      <div className="mt-2 space-y-1.5">
        {SLIDES.map(([title, state], i) => (
          <Beat
            key={title}
            at={0.15 + i * 0.13}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-foreground/10 bg-card px-2.5 py-2",
              state === "queued" && "[&>*]:opacity-50"
            )}
          >
            <span className="nums font-mono text-[9px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1 truncate text-[11px] font-medium">{title}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[8.5px] font-medium",
                state === "written" && "bg-secondary/15 text-secondary",
                state === "writing" && "animate-pulse-soft bg-amber/20 text-amber",
                state === "queued" && "bg-foreground/[0.06] text-muted-foreground"
              )}
            >
              {state}
            </span>
          </Beat>
        ))}
      </div>
    </div>
  );
}

function ExplainsScreen() {
  const played = useBuildRange(0.2, 0.95);
  const width = useTransform(played, (v) => `${8 + v * 80}%`);
  return (
    <div className="flex h-full flex-col px-3 pt-3">
      <Beat
        at={0}
        slide={0}
        className="relative aspect-[9/12] overflow-hidden rounded-2xl border border-foreground/10 bg-[#EFE7D3] text-[#2A2A26]"
      >
        <p className="pt-4 text-center font-display text-[11px] font-bold tracking-wide">HOW PLANTS MAKE FOOD</p>
        <div className="mx-3 mt-3 rounded-lg border border-[#7FAE86] p-2">
          <p className="text-center font-display text-[7px] font-bold tracking-[0.2em]">KEY IDEAS</p>
          {["Light is captured", "Water is split", "Sugar is built"].map((t, i) => (
            <Beat key={t} at={0.2 + i * 0.17} slide={4} className="mt-1 flex items-center gap-1.5 font-hand text-[11px]">
              <span className={cn("h-1.5 w-1.5 rounded-full", i % 2 ? "bg-[#6AA6CF]" : "bg-[#EE8F4A]")} />
              {t}
            </Beat>
          ))}
        </div>
        <Beat at={0.72} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <p className="-rotate-1 whitespace-nowrap bg-[#E8DEC1] px-3 py-1 font-hand text-[13px] shadow-sm">
            sunlight becomes sugar
          </p>
        </Beat>
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
          <Play className="h-3 w-3 fill-current" aria-hidden />
          <span className="h-0.5 flex-1 rounded bg-[#2A2A26]/20">
            <motion.span className="block h-full rounded bg-[#2A2A26]" style={{ width }} />
          </span>
        </div>
      </Beat>
      <Beat at={0.85} className="mt-3 flex flex-wrap gap-1">
        {["English", "हिन्दी", "తెలుగు", "தமிழ்", "Español"].map((lang, i) => (
          <span
            key={lang}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[9.5px]",
              i === 1 ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card"
            )}
          >
            {lang}
          </span>
        ))}
      </Beat>
    </div>
  );
}

/** A handwritten line that writes itself left to right as the build passes it. */
function Written({ from, to, children }: { from: number; to: number; children: React.ReactNode }) {
  const v = useBuildRange(from, to);
  const clipPath = useTransform(v, (x) => `inset(0 ${Math.round((1 - x) * 100)}% 0 0)`);
  return (
    <motion.p style={{ clipPath }} className="font-hand text-[17px]">
      {children}
    </motion.p>
  );
}

function DrawsScreen() {
  const terms = ["chlorophyll", "light reaction", "glucose"];
  const flow = ["Sunlight", "Leaf", "Sugar"];
  const underline = useBuildRange(0.04, 0.14);
  return (
    <div className="flex h-full flex-col px-3 pt-4">
      <Beat at={0} className="font-display text-sm">
        The light reactions
      </Beat>
      <motion.span style={{ scaleX: underline }} className="mt-1 block h-0.5 w-16 origin-left rounded bg-mark" />
      <div className="mt-4 space-y-2">
        {terms.map((t, i) => (
          <Written key={t} from={0.16 + i * 0.16} to={0.28 + i * 0.16}>
            • {t}
          </Written>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        {flow.map((node, i) => (
          <Beat key={node} at={0.66 + i * 0.1} className="flex items-center">
            <span className="rounded-lg border-2 border-secondary/60 bg-card px-2 py-1.5 font-hand text-[11px]">{node}</span>
            {i < flow.length - 1 && <span className="ml-1.5 text-muted-foreground">→</span>}
          </Beat>
        ))}
      </div>
      <Beat at={0.9} className="mt-auto pb-4 text-center text-[9.5px] text-muted-foreground">
        Tap a term to ask the tutor
      </Beat>
    </div>
  );
}

function QuizzesScreen() {
  const options = ["In the roots", "In the chloroplasts", "In the stem", "In the soil"];
  const answered = useBuildRange(0.78, 0.86);
  const bar = useTransform(useBuildRange(0.78, 0.9), (v) => `${50 + v * 17}%`);
  return (
    <div className="flex h-full flex-col px-3 pt-3">
      <Beat at={0} className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Boss Battle · 4 / 6</span>
        <span className="font-semibold text-amber">🔥 3 streak</span>
      </Beat>
      <Beat at={0} slide={0} className="mt-2 h-1.5 rounded-full bg-foreground/10">
        <motion.div style={{ width: bar }} className="h-full rounded-full bg-secondary" />
      </Beat>
      <Beat at={0.12} className="mt-5 font-display text-[15px] leading-snug">
        Where does photosynthesis happen?
      </Beat>
      <div className="mt-4 space-y-2">
        {options.map((option, i) => (
          <Beat key={option} at={0.26 + i * 0.12} className="relative">
            <div className="flex items-center justify-between rounded-xl border border-foreground/10 bg-card px-3 py-2.5 text-[11.5px]">
              {option}
            </div>
            {i === 1 && (
              <motion.div
                style={{ opacity: answered }}
                className="absolute inset-0 flex items-center justify-between overflow-hidden rounded-xl border border-secondary bg-card px-3 text-[11.5px] font-medium"
              >
                <span aria-hidden className="absolute inset-0 bg-secondary/10" />
                <span className="relative">{option}</span>
                <Check className="relative h-3.5 w-3.5 text-secondary" aria-hidden />
              </motion.div>
            )}
          </Beat>
        ))}
      </div>
    </div>
  );
}

const REVIEWS: [string, string, boolean][] = [
  ["Photosynthesis", "Due tomorrow · 3 questions", true],
  ["Cell division", "In 3 days", false],
  ["Newton's laws", "In 6 days", false],
  ["The French Revolution", "Next week", false],
];

function RemembersScreen() {
  return (
    <div className="flex h-full flex-col px-3 pt-3">
      <Beat at={0}>
        <p className="text-[12px] font-semibold">Review</p>
        <p className="text-[9.5px] text-muted-foreground">Just before you would forget</p>
      </Beat>
      <div className="mt-3 space-y-1.5">
        {REVIEWS.map(([topic, when, due], i) => (
          <Beat
            key={topic}
            at={0.18 + i * 0.17}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
              due ? "border-foreground bg-card shadow-lift" : "border-foreground/10 bg-card/70"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", due ? "bg-mark" : "bg-foreground/20")} />
            <span className="flex-1">
              <span className="block text-[11px] font-medium">{topic}</span>
              <span className="block text-[9px] text-muted-foreground">{when}</span>
            </span>
            {due && <span className="rounded-full bg-foreground px-2 py-0.5 text-[8.5px] text-background">Start</span>}
          </Beat>
        ))}
      </div>
    </div>
  );
}

export const PHONE_SCREENS = [LearnsScreen, WritesScreen, ExplainsScreen, DrawsScreen, QuizzesScreen, RemembersScreen];

/** The phone body; `children` is the current screen. */
export function Phone({ children, status = "online" }: { children: React.ReactNode; status?: string }) {
  return (
    <div className="relative h-[560px] w-[272px] rounded-[46px] border-[9px] border-[#24221E] bg-background shadow-[0_40px_80px_-40px_rgba(40,30,10,0.45)] dark:border-[#3a3833]">
      <span aria-hidden className="absolute -left-[12px] top-24 h-10 w-[3px] rounded-l bg-[#24221E]" />
      <span aria-hidden className="absolute -left-[12px] top-36 h-10 w-[3px] rounded-l bg-[#24221E]" />
      <span aria-hidden className="absolute -right-[12px] top-28 h-16 w-[3px] rounded-r bg-[#24221E]" />
      <div className="flex h-full flex-col overflow-hidden rounded-[37px]">
        <div className="relative flex h-9 shrink-0 items-center justify-between px-6 text-[10px] font-semibold">
          <span>9:41</span>
          <span aria-hidden className="absolute left-1/2 top-2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-[#111]" />
          <span aria-hidden className="flex gap-1">
            <span className="h-2 w-3 rounded-sm bg-foreground" />
            <span className="h-2 w-4 rounded-sm bg-foreground/70" />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-b border-foreground/10 px-3 pb-2">
          <span className="relative">
            <LogoMark className="h-7 w-7" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-secondary" />
          </span>
          <span className="leading-tight">
            <span className="block text-[11px] font-semibold">SMART AI</span>
            <span className="block text-[9px] text-muted-foreground">{status}</span>
          </span>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
        <span aria-hidden className="mx-auto mb-1.5 h-1 w-24 shrink-0 rounded-full bg-foreground/80" />
      </div>
    </div>
  );
}
