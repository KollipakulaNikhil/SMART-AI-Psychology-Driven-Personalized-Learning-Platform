"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { AudioLines, BrainCircuit, ListChecks, Sliders } from "lucide-react";

const STATS = [
  { icon: BrainCircuit, value: 20, suffix: "", label: "Assessment questions, no wrong answers" },
  { icon: Sliders, value: 8, suffix: "", label: "Generation knobs tuned to your profile" },
  { icon: ListChecks, value: 6, suffix: "", label: "Pipeline stages, fully automated" },
  { icon: AudioLines, value: 5, suffix: "", label: "Languages narrated natively" },
];

function useCountUp(target: number, active: boolean, duration = 1100) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    const startedAt = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration]);

  return value;
}

function StatTile({ icon: Icon, value, suffix, label, index }: (typeof STATS)[number] & { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const shown = useCountUp(value, inView);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="font-display text-4xl font-bold tabular-nums text-white">
        {shown}
        {suffix}
      </p>
      <p className="max-w-[16ch] text-sm text-white/70">{label}</p>
    </motion.div>
  );
}

export function StatsStrip() {
  return (
    <section className="py-16 sm:py-20">
      <div className="container">
        <div className="grain relative overflow-hidden rounded-[2rem] bg-[#100D24] px-6 py-12 shadow-float sm:px-12">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(129,140,248,0.25),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(251,191,36,0.18),transparent_55%)]"
          />
          <div className="relative grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 sm:gap-8">
            {STATS.map((stat, index) => (
              <StatTile key={stat.label} {...stat} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
