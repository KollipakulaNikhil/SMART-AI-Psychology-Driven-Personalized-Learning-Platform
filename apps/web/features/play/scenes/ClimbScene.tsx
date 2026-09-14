"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { VB_H, VB_W, mulberry32, samplePath, smoothPath, type Pt } from "../engine";
import type { QuizGame } from "../useQuizGame";

/**
 * The ridge the trail follows, bottom-left base camp → top-right summit.
 * The lower third is solid mountain so the question card can overlay it.
 */
const RIDGE: Pt[] = [
  [50, 430], [130, 400], [220, 418], [310, 358], [390, 352], [460, 298], [535, 292],
  [605, 232], [685, 226], [750, 168], [820, 160], [880, 112], [930, 78],
];
const TRAIL_D = smoothPath(RIDGE);
const NEAR_MOUNTAIN_D =
  `M 0 ${VB_H} L 0 470 ` + RIDGE.map(([x, y]) => `L ${x} ${y + 14}`).join(" ") + ` L 975 110 L ${VB_W} 150 L ${VB_W} ${VB_H} Z`;
const MID_MOUNTAIN_D =
  "M 0 620 L 0 400 L 90 330 L 170 370 L 260 280 L 340 320 L 430 220 L 520 270 L 600 190 L 680 230 L 770 130 L 850 180 L 940 90 L 1000 130 L 1000 620 Z";
const FAR_MOUNTAIN_D =
  "M 0 620 L 0 330 L 120 250 L 220 300 L 330 200 L 420 250 L 540 150 L 640 210 L 760 110 L 860 170 L 960 80 L 1000 100 L 1000 620 Z";

const STARS = (() => {
  const rand = mulberry32(7);
  return Array.from({ length: 46 }, () => ({
    x: Math.round(rand() * VB_W),
    y: Math.round(rand() * 260),
    r: 0.8 + rand() * 1.5,
    delay: rand() * 3,
  }));
})();

/** Sky gradient stops — night at base camp, golden light at the summit. */
const SKY_STOPS = [0, 0.38, 0.72, 1];
const SKY_TOP = ["#0b0a2a", "#1c1758", "#34348f", "#5b63d9"];
const SKY_BOTTOM = ["#3b2f7a", "#8a4b92", "#f0a173", "#ffe0a8"];

export function ClimbScene({ game }: { game: QuizGame }) {
  const { total, results, inRound, roundSec, progress, timeLeft, runId } = game;

  const trailRef = useRef<SVGPathElement>(null);
  const [waypoints, setWaypoints] = useState<{ x: number; y: number }[]>([]);
  useLayoutEffect(() => {
    const path = trailRef.current;
    if (!path || total === 0) return;
    const len = path.getTotalLength();
    setWaypoints(
      Array.from({ length: total + 1 }, (_, i) => {
        const p = path.getPointAtLength((len * i) / total);
        return { x: p.x, y: p.y };
      })
    );
  }, [total]);

  const tx = useMotionValue(50);
  const ty = useMotionValue(430);
  useEffect(() => {
    if (!waypoints.length) return;
    tx.set(waypoints[0].x);
    ty.set(waypoints[0].y);
  }, [waypoints, runId, tx, ty]);

  useEffect(() => {
    game.registerAdvance(async (from, to, duration) => {
      const path = trailRef.current;
      if (!path) return;
      const { xs, ys } = samplePath(path, from / total, to / total);
      const ease = "easeInOut" as const;
      await Promise.all([animate(tx, xs, { duration, ease }).finished, animate(ty, ys, { duration, ease }).finished]);
    });
    return () => game.registerAdvance(null);
  }, [game, total, tx, ty]);

  const skyTop = useTransform(progress, SKY_STOPS, SKY_TOP);
  const skyBottom = useTransform(progress, SKY_STOPS, SKY_BOTTOM);
  const starOpacity = useTransform(progress, [0, 0.7, 1], [1, 0.5, 0.12]);
  const glowOpacity = useTransform(progress, [0, 1], [0.12, 0.45]);
  const sunX = useTransform(timeLeft, [roundSec, 0], [140, 860]);
  const sunY = useTransform(sunX, (x) => 150 - Math.sin(((x - 140) / 720) * Math.PI) * 95);
  const sunFill = useTransform(timeLeft, [0, roundSec * 0.25, roundSec], ["#fb7185", "#fbbf24", "#fef3c7"]);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="cl-sky" x1="0" y1="0" x2="0" y2="1">
          <motion.stop offset="0" style={{ stopColor: skyTop }} />
          <motion.stop offset="1" style={{ stopColor: skyBottom }} />
        </linearGradient>
        <radialGradient id="cl-orb" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#c7d2fe" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cl-lantern" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f59e0b" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cl-summit" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff7ed" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fdba74" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={VB_W} height={VB_H} fill="url(#cl-sky)" />
      <motion.circle cx={930} cy={78} r={220} fill="url(#cl-summit)" style={{ opacity: glowOpacity }} />

      <motion.g style={{ opacity: starOpacity }}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e0e7ff" className="animate-twinkle" style={{ animationDelay: `${s.delay}s` }} />
        ))}
      </motion.g>

      {/* Round timer as a travelling sun */}
      <motion.g animate={{ opacity: inRound ? 1 : 0 }} transition={{ duration: 0.4 }}>
        <motion.g style={{ x: sunX, y: sunY }}>
          <motion.circle r={26} style={{ fill: sunFill }} opacity={0.18} />
          <motion.circle r={12} style={{ fill: sunFill }} />
        </motion.g>
      </motion.g>

      <g className="animate-drift" opacity={0.16} fill="#ffffff">
        <ellipse cx={230} cy={210} rx={70} ry={16} />
        <ellipse cx={270} cy={200} rx={45} ry={20} />
        <ellipse cx={640} cy={140} rx={80} ry={14} />
        <ellipse cx={680} cy={130} rx={40} ry={18} />
      </g>

      <path d={FAR_MOUNTAIN_D} fill="#6366f1" opacity={0.22} />
      <path d={MID_MOUNTAIN_D} fill="#1e1b4b" opacity={0.6} />
      <path d={NEAR_MOUNTAIN_D} fill="#100e2e" />

      <path ref={trailRef} d={TRAIL_D} fill="none" stroke="#c7d2fe" strokeOpacity={0.3} strokeWidth={2.5} strokeDasharray="6 8" strokeLinecap="round" />
      <motion.path d={TRAIL_D} fill="none" stroke="#fde68a" strokeWidth={3.5} strokeLinecap="round" style={{ pathLength: progress }} />

      {waypoints.map((wp, i) => {
        if (i === 0) return null;
        const r = results[i - 1];
        const lit = r?.correct === true;
        const missed = r ? !r.correct : false;
        const isSummit = i === total;
        return (
          <g key={`${runId}-${i}`}>
            {lit && (
              <motion.g style={{ x: wp.x, y: wp.y }}>
                <motion.circle
                  r={26}
                  fill="url(#cl-lantern)"
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 180, damping: 14 }}
                />
              </motion.g>
            )}
            <circle
              cx={wp.x}
              cy={wp.y}
              r={isSummit ? 7 : 5}
              fill={lit ? "#fde68a" : missed ? "#3f3a66" : "#0b0a2a"}
              stroke={lit ? "#fbbf24" : missed ? "#a78bfa" : "#a5b4fc"}
              strokeOpacity={lit ? 1 : 0.7}
              strokeWidth={2}
            />
            {isSummit && (
              <g transform={`translate(${wp.x} ${wp.y})`}>
                <line x1={0} y1={-6} x2={0} y2={-38} stroke="#fde68a" strokeWidth={2} />
                <path d="M0 -38 L22 -30 L0 -22 Z" fill="#f59e0b" />
              </g>
            )}
          </g>
        );
      })}

      <motion.g style={{ x: tx, y: ty }}>
        <circle r={30} fill="url(#cl-orb)" opacity={0.55} />
        <circle r={9} fill="#ffffff" />
        <circle r={4} cy={-1} fill="#6366f1" />
      </motion.g>
    </svg>
  );
}

export function ClimbPreview() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="clp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14124a" />
          <stop offset="1" stopColor="#8a4b92" />
        </linearGradient>
      </defs>
      <rect width={200} height={120} fill="url(#clp-sky)" />
      {[20, 60, 95, 140, 175, 45, 120].map((x, i) => (
        <circle key={i} cx={x} cy={10 + (i * 13) % 40} r={1.2} fill="#e0e7ff" />
      ))}
      <path d="M0 120 L0 80 L40 55 L75 75 L115 40 L150 60 L190 20 L200 30 L200 120 Z" fill="#6366f1" opacity={0.25} />
      <path d="M0 120 L0 95 L30 78 L70 90 L110 62 L150 72 L185 38 L200 45 L200 120 Z" fill="#100e2e" />
      <path d="M12 92 C 40 88, 55 84, 70 78 S 110 66, 130 58 S 165 45, 182 34" fill="none" stroke="#fde68a" strokeWidth={2} strokeLinecap="round" />
      <circle cx={70} cy={78} r={6} fill="#f59e0b" opacity={0.35} />
      <circle cx={70} cy={78} r={2.5} fill="#fde68a" />
      <circle cx={130} cy={58} r={6} fill="#f59e0b" opacity={0.35} />
      <circle cx={130} cy={58} r={2.5} fill="#fde68a" />
      <circle cx={12} cy={92} r={5} fill="#fff" opacity={0.9} />
      <path d="M182 34 L182 20 L192 24 L182 28" fill="#f59e0b" stroke="#fde68a" strokeWidth={1} />
    </svg>
  );
}
