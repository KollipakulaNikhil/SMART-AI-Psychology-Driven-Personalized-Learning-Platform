"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The USP, made playable.
 *
 * "One topic, taught differently for every mind" is a claim until the visitor
 * can move the dials themselves and watch the lesson plan change underneath.
 * The mapping below is a faithful (if simplified) mirror of what
 * `profileBuilder.deriveGenerationParams` actually does on the server — the
 * numbers move for the same reasons a real profile moves them, so this is a
 * demo of the product rather than a decorative animation.
 */

type Style = "visual" | "reading";
type Attention = "short" | "long";
type Level = "beginner" | "advanced";

interface Dial<T extends string> {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}

function DialRow<T extends string>({ label, value, onChange, options }: Dial<T>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/20 py-3.5">
      <span className="text-[15px] font-medium">{label}</span>
      <div role="group" aria-label={label} className="flex rounded-md border border-foreground p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "relative min-h-11 rounded-[3px] px-3.5 text-sm font-medium transition-colors",
              value === option.value ? "text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {value === option.value && (
              <motion.span
                layoutId={`dial-${label}`}
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
                className="absolute inset-0 rounded-[3px] bg-foreground"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Counts to a new value instead of snapping, so a change is impossible to miss. */
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const startedAt = performance.now();
    const DURATION = 420;
    const tick = () => {
      const t = Math.min(1, (performance.now() - startedAt) / DURATION);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value]);

  return <>{shown.toFixed(decimals)}</>;
}

interface Plan {
  slides: number;
  minutes: number;
  speed: number;
  bullets: number;
  imagery: string;
  examples: string;
  quiz: number;
  narration: string;
}

/** Mirrors the server's parameter derivation closely enough to be honest. */
function derivePlan(style: Style, attention: Attention, level: Level): Plan {
  const slides = (attention === "short" ? 6 : 13) + (level === "advanced" ? 2 : 0);
  const minutes = attention === "short" ? 4 : 12;
  return {
    slides,
    minutes,
    speed: level === "advanced" ? 1.1 : 0.9,
    bullets: style === "visual" ? 3 : 5,
    imagery:
      style === "visual"
        ? "Image-led — a diagram or photo on nearly every slide"
        : "Text-rich — diagrams only where they earn their place",
    examples:
      level === "advanced"
        ? "Precise terminology, formal definitions first"
        : "Everyday analogies before any jargon",
    quiz: attention === "short" ? 8 : 12,
    narration: level === "advanced" ? "Brisk, respects your time" : "Measured, room to absorb",
  };
}

export function TryItLive() {
  const [style, setStyle] = useState<Style>("visual");
  const [attention, setAttention] = useState<Attention>("short");
  const [level, setLevel] = useState<Level>("beginner");

  const plan = useMemo(() => derivePlan(style, attention, level), [style, attention, level]);

  return (
    <div className="grid border-2 border-foreground bg-card lg:grid-cols-[0.9fr_1.1fr]">
      {/* the dials */}
      <div className="p-5 sm:p-8">
        <p className="label-mono">
          <span className="text-primary">A</span> The learner
        </p>
        <p className="text-h3 mt-3 font-display">Set the learner</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This is what the learning discovery works out about you. Change it and watch the plan
          alongside change.
        </p>

        <div className="mt-6 border-t border-foreground">
          <DialRow
            label="Learns best from"
            value={style}
            onChange={setStyle}
            options={[
              { value: "visual", label: "Pictures" },
              { value: "reading", label: "Text" },
            ]}
          />
          <DialRow
            label="Attention span"
            value={attention}
            onChange={setAttention}
            options={[
              { value: "short", label: "Short" },
              { value: "long", label: "Long" },
            ]}
          />
          <DialRow
            label="Starting level"
            value={level}
            onChange={setLevel}
            options={[
              { value: "beginner", label: "Beginner" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </div>

        <div className="mt-7 border-l-2 border-mark pl-4">
          <p className="label-mono">Topic asked for</p>
          <p className="mt-1.5 font-display text-2xl italic leading-tight">“Explain quantum computing”</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Same three words, every time — only the learner changes.
          </p>
        </div>
      </div>

      {/* the resulting lesson */}
      <div className="border-t-2 border-foreground p-5 sm:p-8 lg:border-l-2 lg:border-t-0">
        <p className="label-mono">
          <span className="text-primary">B</span> Your lesson would be
        </p>

        <div className="mt-4 grid grid-cols-3 border-y border-foreground">
          {[
            { value: plan.slides, suffix: "", label: "slides", decimals: 0 },
            { value: plan.minutes, suffix: " min", label: "long", decimals: 0 },
            { value: plan.speed, suffix: "×", label: "narration", decimals: 1 },
          ].map((stat, index) => (
            <div key={stat.label} className={cn("py-4", index > 0 && "border-l border-foreground/20 pl-3 sm:pl-5")}>
              <p className="nums font-display text-3xl leading-none sm:text-4xl">
                <AnimatedNumber value={stat.value} decimals={stat.decimals} />
                <span className="text-xl sm:text-2xl">{stat.suffix}</span>
              </p>
              <p className="label-mono mt-2">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* a miniature of the deck, so density is felt and not just stated */}
        <div className="mt-5 rounded-md border border-foreground/30 bg-background p-4">
          <p className="label-mono">A slide looks like</p>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-2.5 w-2/3 bg-foreground/60" />
              <AnimatePresence mode="popLayout">
                {Array.from({ length: plan.bullets }).map((_, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.22, delay: i * 0.03 }}
                    className="h-1.5 bg-foreground/25"
                    style={{ width: `${90 - i * 8}%` }}
                  />
                ))}
              </AnimatePresence>
            </div>
            <motion.div
              layout
              animate={{
                width: style === "visual" ? 104 : 56,
                height: style === "visual" ? 78 : 52,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="shrink-0 rounded-sm border border-foreground/60 bg-accent/20"
            >
              {/* a crossed box — the draughtsman's placeholder for "picture here" */}
              <svg aria-hidden viewBox="0 0 10 10" preserveAspectRatio="none" className="h-full w-full text-foreground/40">
                <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
            </motion.div>
          </div>
        </div>

        <dl className="mt-5 border-t border-foreground text-sm">
          {[
            ["Imagery", plan.imagery],
            ["Examples", plan.examples],
            ["Delivery", plan.narration],
            ["Quiz", `${plan.quiz} questions at the end`],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3 border-b border-foreground/20 py-2.5">
              <dt className="label-mono w-20 shrink-0 pt-0.5">{label}</dt>
              <AnimatePresence mode="wait">
                <motion.dd
                  key={value}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="font-medium"
                >
                  {value}
                </motion.dd>
              </AnimatePresence>
            </div>
          ))}
        </dl>

        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "gradient" }), "group mt-6 w-full")}
        >
          Get my real profile
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
