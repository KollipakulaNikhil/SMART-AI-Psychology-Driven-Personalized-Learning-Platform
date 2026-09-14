"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BrainCircuit, Compass, Sparkles } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Sparkles, text: "20 questions map how you actually learn" },
  { icon: BrainCircuit, text: "Every lesson is rebuilt around your profile" },
  { icon: Compass, text: "Pace, tone and depth adapt as you go" },
];

interface Particle {
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  hue: "primary" | "secondary" | "amber";
}

function useParticles(count: number): Particle[] {
  return useMemo(() => {
    const hues: Particle["hue"][] = ["primary", "secondary", "amber"];
    return Array.from({ length: count }, (_, i) => ({
      left: `${(i * 37 + 8) % 100}%`,
      top: `${(i * 53 + 12) % 100}%`,
      size: 3 + ((i * 7) % 5),
      duration: 10 + ((i * 5) % 12),
      delay: (i % 6) * 0.7,
      hue: hues[i % hues.length],
    }));
  }, [count]);
}

const HUE_CLASS: Record<Particle["hue"], string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  amber: "bg-amber",
};

/**
 * A calmer, CSS/Framer-Motion cousin of the landing hero's particle field —
 * no Three.js here, just drifting orbs + dots, capped and reduced-motion-safe.
 */
export function AuthAccentPanel() {
  const reduceMotion = useReducedMotion();
  const particles = useParticles(18);

  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-[#0B0A17] lg:block">
      {/* Base gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#151233] via-[#1B1440] to-[#0B0A17]" />

      {/* Slow-drifting orbs */}
      <motion.div
        aria-hidden
        className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-primary/30 blur-[100px]"
        animate={reduceMotion ? undefined : { x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -right-16 top-1/2 h-96 w-96 rounded-full bg-secondary/25 blur-[110px]"
        animate={reduceMotion ? undefined : { x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber/20 blur-[100px]"
        animate={reduceMotion ? undefined : { x: [0, 24, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Dot grid, faded toward the edges */}
      <div
        aria-hidden
        className="absolute inset-0 bg-grid opacity-[0.08] mask-fade-b"
        style={{ backgroundSize: "42px 42px" }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <motion.span
          key={i}
          aria-hidden
          className={`absolute rounded-full ${HUE_CLASS[p.hue]}`}
          style={{ left: p.left, top: p.top, width: p.size, height: p.size, opacity: 0.5 }}
          animate={reduceMotion ? undefined : { y: [0, -16, 0], opacity: [0.25, 0.6, 0.25] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Content */}
      <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="eyebrow text-white/70">Psychology-driven learning</span>
          <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
            Learning that finally moves at{" "}
            <span className="text-gradient bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text">
              your
            </span>{" "}
            pace.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            One topic, rendered differently for every mind. SMART AI studies how you think before
            it teaches you anything.
          </p>
        </motion.div>

        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } } }}
          className="space-y-4"
        >
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <motion.li
              key={text}
              variants={{
                hidden: { opacity: 0, x: -12 },
                show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="flex items-center gap-3 text-sm text-white/75"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-sm">
                <Icon className="h-4 w-4 text-white/80" aria-hidden />
              </span>
              {text}
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </div>
  );
}
