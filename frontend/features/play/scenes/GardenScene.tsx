"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { VB_H, VB_W, mulberry32, samplePath, smoothPath, type Pt } from "../engine";
import type { QuizGame } from "../useQuizGame";

/**
 * The stem, ground → sky, with a gentle sway so it doesn't read as a ruler.
 * It lives in the left third: the question card overlays the right ~58% on
 * wide screens, and the flower must never grow behind it.
 */
const STEM: Pt[] = [
  [300, 548], [291, 480], [307, 405], [293, 330], [305, 255], [295, 180], [300, 110],
];
const STEM_D = smoothPath(STEM);

const PETALS = ["#f9a8d4", "#fdba74", "#c4b5fd", "#fde68a", "#7dd3fc", "#fda4af", "#a7f3d0", "#f0abfc"];

const GRASS = (() => {
  const rand = mulberry32(3);
  return Array.from({ length: 34 }, () => ({
    x: Math.round(rand() * VB_W),
    y: 552 + Math.round(rand() * 50),
    h: 10 + rand() * 16,
    lean: (rand() - 0.5) * 12,
  }));
})();

const SPARKS = [
  [-38, -30], [34, -40], [-20, -58], [44, 4],
] as const;

export function GardenScene({ game }: { game: QuizGame }) {
  const { total, results, inRound, roundSec, progress, timeLeft, runId, phase } = game;

  const stemRef = useRef<SVGPathElement>(null);
  const [nodes, setNodes] = useState<{ x: number; y: number }[]>([]);
  useLayoutEffect(() => {
    const path = stemRef.current;
    if (!path || total === 0) return;
    const len = path.getTotalLength();
    setNodes(
      Array.from({ length: total + 1 }, (_, i) => {
        const p = path.getPointAtLength((len * i) / total);
        return { x: p.x, y: p.y };
      })
    );
  }, [total]);

  const tipX = useMotionValue(300);
  const tipY = useMotionValue(548);
  useEffect(() => {
    if (!nodes.length) return;
    tipX.set(nodes[0].x);
    tipY.set(nodes[0].y);
  }, [nodes, runId, tipX, tipY]);

  useEffect(() => {
    game.registerAdvance(async (from, to, duration) => {
      const path = stemRef.current;
      if (!path) return;
      const { xs, ys } = samplePath(path, from / total, to / total, 16);
      const ease = "easeInOut" as const;
      await Promise.all([animate(tipX, xs, { duration, ease }).finished, animate(tipY, ys, { duration, ease }).finished]);
    });
    return () => game.registerAdvance(null);
  }, [game, total, tipX, tipY]);

  const skyTop = useTransform(progress, [0, 1], ["#dbeafe", "#93c5fd"]);
  const skyBottom = useTransform(progress, [0, 1], ["#fff1e0", "#fef3c7"]);
  const sunX = useTransform(timeLeft, [roundSec, 0], [140, 860]);
  const sunY = useTransform(sunX, (x) => 170 - Math.sin(((x - 140) / 720) * Math.PI) * 110);
  const sunFill = useTransform(timeLeft, [0, roundSec * 0.25, roundSec], ["#fb7185", "#fbbf24", "#fde047"]);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="gd-sky" x1="0" y1="0" x2="0" y2="1">
          <motion.stop offset="0" style={{ stopColor: skyTop }} />
          <motion.stop offset="1" style={{ stopColor: skyBottom }} />
        </linearGradient>
        <radialGradient id="gd-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde047" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gd-tip" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ecfccb" />
          <stop offset="0.5" stopColor="#a3e635" stopOpacity="0.6" />
          <stop offset="1" stopColor="#65a30d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gd-bloom" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={VB_W} height={VB_H} fill="url(#gd-sky)" />

      {/* Round timer as the sun */}
      <motion.g animate={{ opacity: inRound ? 1 : 0.35 }} transition={{ duration: 0.4 }}>
        <motion.g style={{ x: sunX, y: sunY }}>
          <circle r={70} fill="url(#gd-sun)" />
          <motion.circle r={22} style={{ fill: sunFill }} />
        </motion.g>
      </motion.g>

      <g className="animate-drift" opacity={0.7} fill="#ffffff">
        <ellipse cx={200} cy={150} rx={80} ry={18} />
        <ellipse cx={245} cy={138} rx={50} ry={24} />
        <ellipse cx={760} cy={110} rx={90} ry={16} />
        <ellipse cx={800} cy={98} rx={45} ry={22} />
      </g>

      {/* Hills */}
      <path d="M 0 620 L 0 470 C 150 400, 300 420, 450 460 S 750 520, 1000 440 L 1000 620 Z" fill="#bbf0cf" />
      <path d="M 0 620 L 0 520 C 200 470, 350 500, 520 540 S 820 560, 1000 500 L 1000 620 Z" fill="#8fdcaa" />
      <path d="M 0 620 L 0 560 C 250 540, 500 580, 1000 545 L 1000 620 Z" fill="#5fbf7e" />
      {GRASS.map((g, i) => (
        <path
          key={i}
          d={`M ${g.x} ${g.y} q ${g.lean} ${-g.h / 2} ${g.lean * 1.6} ${-g.h}`}
          stroke="#3f9d61"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      ))}

      {/* Stem: faint guide, then the grown part */}
      <path ref={stemRef} d={STEM_D} fill="none" stroke="#3f9d61" strokeOpacity={0.18} strokeWidth={5} strokeDasharray="5 9" strokeLinecap="round" />
      <motion.path d={STEM_D} fill="none" stroke="#3f9d61" strokeWidth={7} strokeLinecap="round" style={{ pathLength: progress }} />

      {/* Blooms and wilts at each node */}
      {nodes.map((n, i) => {
        if (i === 0) return null;
        const r = results[i - 1];
        if (!r) return null;
        const side = i % 2 === 0 ? 1 : -1;
        if (!r.correct) {
          return (
            <motion.g
              key={`${runId}-wilt-${i}`}
              style={{ x: n.x, y: n.y }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <path d={`M0 0 q ${18 * side} -6 ${26 * side} 10`} stroke="#8a7a4a" strokeWidth={3} fill="none" strokeLinecap="round" />
              <ellipse cx={28 * side} cy={12} rx={9} ry={5} fill="#a3945a" transform={`rotate(${35 * side} ${28 * side} 12)`} />
            </motion.g>
          );
        }
        const color = PETALS[(i - 1) % PETALS.length];
        return (
          <motion.g key={`${runId}-bloom-${i}`} style={{ x: n.x, y: n.y }}>
            {/* leaf */}
            <motion.ellipse
              cx={22 * side}
              cy={6}
              rx={16}
              ry={7}
              fill="#4ade80"
              transform={`rotate(${-28 * side} ${22 * side} 6)`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 220, damping: 16 }}
            />
            <motion.g
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 13 }}
            >
              <circle r={34} fill="url(#gd-bloom)" />
              {Array.from({ length: 6 }, (_, k) => (
                <ellipse key={k} cx={0} cy={-15} rx={8} ry={15} fill={color} transform={`rotate(${k * 60})`} />
              ))}
              <circle r={6.5} fill="#fbbf24" />
            </motion.g>
          </motion.g>
        );
      })}

      {/* Growth tip */}
      <motion.g style={{ x: tipX, y: tipY }}>
        <circle r={26} fill="url(#gd-tip)" opacity={0.8} />
        <ellipse cx={-9} cy={-2} rx={9} ry={4} fill="#65a30d" transform="rotate(-30 -9 -2)" />
        <ellipse cx={9} cy={-2} rx={9} ry={4} fill="#65a30d" transform="rotate(30 9 -2)" />
        <circle r={5} fill="#ecfccb" stroke="#4d7c0f" strokeWidth={2} />
      </motion.g>

      {/* Full-bloom sparkles at the top */}
      {phase === "summit" &&
        nodes[total] &&
        SPARKS.map(([dx, dy], k) => (
          <motion.path
            key={`${runId}-spark-${k}`}
            d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z"
            fill="#fff7ed"
            style={{ x: nodes[total].x + dx, y: nodes[total].y + dy }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 0.9], opacity: [0, 1, 0.9] }}
            transition={{ delay: 0.15 * k, duration: 0.7 }}
          />
        ))}
    </svg>
  );
}

export function GardenPreview() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="gdp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#fff1e0" />
        </linearGradient>
      </defs>
      <rect width={200} height={120} fill="url(#gdp-sky)" />
      <circle cx={160} cy={28} r={14} fill="#fde047" />
      <path d="M0 120 L0 88 C 50 70, 100 78, 200 70 L200 120 Z" fill="#8fdcaa" />
      <path d="M0 120 L0 104 C 60 98, 140 110, 200 100 L200 120 Z" fill="#5fbf7e" />
      <path d="M100 106 C 98 90, 103 74, 100 40" stroke="#3f9d61" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <ellipse cx={90} cy={88} rx={9} ry={4} fill="#4ade80" transform="rotate(-25 90 88)" />
      <ellipse cx={110} cy={68} rx={9} ry={4} fill="#4ade80" transform="rotate(25 110 68)" />
      <g transform="translate(100 40)">
        {Array.from({ length: 6 }, (_, k) => (
          <ellipse key={k} cx={0} cy={-8} rx={4.5} ry={8} fill="#f9a8d4" transform={`rotate(${k * 60})`} />
        ))}
        <circle r={3.5} fill="#fbbf24" />
      </g>
      <g transform="translate(118 70)">
        {Array.from({ length: 6 }, (_, k) => (
          <ellipse key={k} cx={0} cy={-5} rx={3} ry={5} fill="#c4b5fd" transform={`rotate(${k * 60})`} />
        ))}
        <circle r={2.2} fill="#fbbf24" />
      </g>
    </svg>
  );
}
