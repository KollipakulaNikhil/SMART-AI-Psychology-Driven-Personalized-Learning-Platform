"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { VB_H, VB_W, mulberry32 } from "../engine";
import type { QuizGame } from "../useQuizGame";

const STARS = (() => {
  const rand = mulberry32(21);
  return Array.from({ length: 90 }, () => ({
    x: Math.round(rand() * VB_W),
    y: Math.round(rand() * VB_H),
    r: 0.6 + rand() * 1.6,
    delay: rand() * 4,
  }));
})();

/** Where each question's star sits — a gentle wave across the sky with a little scatter. */
function layoutStars(total: number) {
  const rand = mulberry32(total * 31 + 5);
  return Array.from({ length: total }, (_, i) => {
    const t = total === 1 ? 0.5 : i / (total - 1);
    // Kept in the upper ~60% of the sky so no star hides behind the question card.
    return {
      x: Math.round(120 + t * 760),
      y: Math.round(Math.min(360, 250 - Math.sin(t * Math.PI * 1.6 + 0.4) * 105 + (rand() - 0.5) * 50)),
    };
  });
}

/** Where the comet rests once the last star is placed. */
const EXIT = { x: 960, y: 60 };

export function ConstellationScene({ game }: { game: QuizGame }) {
  const { total, results, index, inRound, phase, progress, runId } = game;
  const targets = useMemo(() => layoutStars(total), [total]);

  const cx = useMotionValue(targets[0]?.x ?? 120);
  const cy = useMotionValue(targets[0]?.y ?? 300);
  useEffect(() => {
    cx.set(targets[0]?.x ?? 120);
    cy.set(targets[0]?.y ?? 300);
  }, [targets, runId, cx, cy]);

  useEffect(() => {
    game.registerAdvance(async (from, to, duration) => {
      const a = targets[from] ?? EXIT;
      const b = targets[to] ?? EXIT;
      // A shallow arc rather than a straight shot — comets curve.
      const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 50 };
      const ease = "easeInOut" as const;
      await Promise.all([
        animate(cx, [a.x, mid.x, b.x], { duration, ease }).finished,
        animate(cy, [a.y, mid.y, b.y], { duration, ease }).finished,
      ]);
    });
    return () => game.registerAdvance(null);
  }, [game, targets, cx, cy]);

  const auroraOpacity = useTransform(progress, [0, 1], [0.08, 0.32]);
  const nebulaOpacity = useTransform(progress, [0, 1], [0.35, 0.6]);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05071a" />
          <stop offset="1" stopColor="#141a4a" />
        </linearGradient>
        <radialGradient id="cs-nebula-a" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7c3aed" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cs-nebula-b" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#06b6d4" stopOpacity="0.45" />
          <stop offset="1" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cs-aurora" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#34d399" stopOpacity="0" />
          <stop offset="0.5" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cs-lit" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#fde68a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cs-comet" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.4" stopColor="#a5f3fc" stopOpacity="0.8" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={VB_W} height={VB_H} fill="url(#cs-sky)" />
      <motion.g style={{ opacity: nebulaOpacity }}>
        <circle cx={260} cy={420} r={320} fill="url(#cs-nebula-a)" />
        <circle cx={760} cy={180} r={300} fill="url(#cs-nebula-b)" />
      </motion.g>
      <motion.path
        d="M -50 470 C 200 380, 420 520, 640 420 S 950 330, 1050 400 L 1050 620 L -50 620 Z"
        fill="url(#cs-aurora)"
        style={{ opacity: auroraOpacity }}
      />

      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dbe4ff" className="animate-twinkle" style={{ animationDelay: `${s.delay}s` }} />
      ))}

      {/* Lines between placed stars — bright when earned, faint when missed */}
      {targets.map((p, i) => {
        if (i === 0 || !results[i]) return null;
        const prev = targets[i - 1];
        const good = results[i].correct;
        return (
          <motion.line
            key={`${runId}-line-${i}`}
            x1={prev.x}
            y1={prev.y}
            x2={p.x}
            y2={p.y}
            stroke={good ? "#fde68a" : "#8b8fc7"}
            strokeOpacity={good ? 0.9 : 0.4}
            strokeWidth={good ? 2.5 : 1.5}
            strokeDasharray={good ? undefined : "4 6"}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}

      {/* The question stars */}
      {targets.map((p, i) => {
        const r = results[i];
        const lit = r?.correct === true;
        const missed = r ? !r.correct : false;
        const isCurrent = i === index && inRound;
        return (
          <g key={`${runId}-star-${i}`}>
            {isCurrent && (
              <circle cx={p.x} cy={p.y} r={16} fill="none" stroke="#a5f3fc" strokeWidth={1.5} className="animate-pulse-soft" />
            )}
            {lit && (
              <motion.g style={{ x: p.x, y: p.y }}>
                <motion.g
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 13 }}
                >
                  <circle r={30} fill="url(#cs-lit)" />
                  <path d="M0 -14 L3 -3 L14 0 L3 3 L0 14 L-3 3 L-14 0 L-3 -3 Z" fill="#fffbeb" />
                </motion.g>
              </motion.g>
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={lit ? 3 : 4}
              fill={lit ? "#fff" : missed ? "#2a2550" : "#0b0f2e"}
              stroke={lit ? "#fde68a" : missed ? "#f472b6" : "#a5b4fc"}
              strokeOpacity={lit ? 1 : missed ? 0.8 : 0.6}
              strokeWidth={1.5}
            />
          </g>
        );
      })}

      {/* Comet cursor */}
      <motion.g style={{ x: cx, y: cy }}>
        <ellipse rx={38} ry={7} cx={-22} fill="url(#cs-comet)" opacity={0.6} />
        <circle r={22} fill="url(#cs-comet)" opacity={0.8} />
        <circle r={5} fill="#ffffff" />
      </motion.g>

      <AnimatePresence>
        {phase === "summit" && (
          <motion.rect
            width={VB_W}
            height={VB_H}
            fill="#fef3c7"
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </svg>
  );
}

export function ConstellationPreview() {
  const pts = [
    [25, 80], [55, 45], [95, 62], [130, 30], [170, 50],
  ];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="csp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05071a" />
          <stop offset="1" stopColor="#1b1f5a" />
        </linearGradient>
        <radialGradient id="csp-neb" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7c3aed" stopOpacity="0.5" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={200} height={120} fill="url(#csp-sky)" />
      <circle cx={60} cy={90} r={70} fill="url(#csp-neb)" />
      {[10, 40, 75, 110, 150, 185, 30, 120, 160].map((x, i) => (
        <circle key={i} cx={x} cy={(i * 29) % 110 + 5} r={1} fill="#dbe4ff" opacity={0.8} />
      ))}
      {pts.slice(1).map(([x, y], i) => (
        <line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={x} y2={y} stroke="#fde68a" strokeWidth={1.5} strokeOpacity={0.9} />
      ))}
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={7} fill="#fbbf24" opacity={0.25} />
          <circle cx={x} cy={y} r={2.2} fill="#fff" />
        </g>
      ))}
    </svg>
  );
}
