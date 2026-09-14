"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock3, Gauge, Layers } from "lucide-react";
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex rounded-full border border-border bg-elevated p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-sm transition-colors",
              value === option.value ? "text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {value === option.value && (
              <motion.span
                layoutId={`dial-${label}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-brand-gradient"
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
    quiz: attention === "short" ? 3 : 5,
    narration: level === "advanced" ? "Brisk, respects your time" : "Measured, room to absorb",
  };
}

export function TryItLive() {
  const [style, setStyle] = useState<Style>("visual");
  const [attention, setAttention] = useState<Attention>("short");
  const [level, setLevel] = useState<Level>("beginner");

  const plan = useMemo(() => derivePlan(style, attention, level), [style, attention, level]);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
      {/* the dials */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-7">
        <p className="text-h3">Set the learner</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This is what the 20-question assessment works out about you. Move it and watch the plan
          on the right change.
        </p>

        <div className="mt-7 space-y-5">
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

        <div className="mt-7 rounded-xl bg-elevated p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Topic asked for</p>
          <p className="mt-1 font-medium">“Explain quantum computing”</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Same three words, every time — only the learner changes.
          </p>
        </div>
      </div>

      {/* the resulting lesson */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-7">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
        <p className="eyebrow">Your lesson would be</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { icon: Layers, value: plan.slides, suffix: "", label: "slides", decimals: 0 },
            { icon: Clock3, value: plan.minutes, suffix: " min", label: "long", decimals: 0 },
            { icon: Gauge, value: plan.speed, suffix: "×", label: "narration", decimals: 1 },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-elevated p-3.5 text-center">
              <stat.icon className="mx-auto h-4 w-4 text-accent" />
              <p className="mt-2 font-display text-2xl font-bold tabular-nums">
                <AnimatedNumber value={stat.value} decimals={stat.decimals} />
                {stat.suffix}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* a miniature of the deck, so density is felt and not just stated */}
        <div className="mt-5 rounded-xl border border-border bg-elevated/60 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">A slide looks like</p>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-2.5 w-2/3 rounded-full bg-foreground/35" />
              <AnimatePresence mode="popLayout">
                {Array.from({ length: plan.bullets }).map((_, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.22, delay: i * 0.03 }}
                    // Light enough to read as placeholder text, dark enough to
                    // actually see — at /12 these were invisible on the card.
                    className="h-1.5 rounded-full bg-foreground/20"
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
              className="shrink-0 rounded-lg bg-gradient-to-br from-primary/45 to-accent/45"
            />
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          {[
            ["Imagery", plan.imagery],
            ["Examples", plan.examples],
            ["Delivery", plan.narration],
            ["Quiz", `${plan.quiz} questions at the end`],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
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
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
