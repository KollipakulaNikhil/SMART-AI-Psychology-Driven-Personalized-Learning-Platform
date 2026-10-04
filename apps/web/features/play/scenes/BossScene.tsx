"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, motion, useAnimationControls, useMotionValue, useTransform } from "framer-motion";
import { VB_H, VB_W, mulberry32 } from "../engine";
import type { QuizGame } from "../useQuizGame";

/** Share of the quiz you must get right to finish the boss / the misses the wizard can take. */
const KILL_SHARE = 0.7;
const FAIL_SHARE = 0.4;

const HERO = { x: 190, y: 385 };
const BOSS = { x: 770, y: 205 };

function embers() {
  const rand = mulberry32(77);
  return Array.from({ length: 34 }, () => ({
    x: Math.round(rand() * VB_W),
    y: 300 + Math.round(rand() * 320),
    r: 1 + rand() * 2.2,
    dur: 4 + rand() * 5,
    delay: rand() * 5,
    hue: rand() > 0.5 ? "#fbbf24" : "#fb7185",
  }));
}

function Torch({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-5} y={0} width={10} height={70} rx={3} fill="#3b2f4a" />
      <rect x={-12} y={-6} width={24} height={10} rx={3} fill="#52406a" />
      <circle r={52} cy={-26} fill="url(#bs-torch)" />
      <motion.path
        d="M0 -50 C-14 -32 -12 -14 0 -6 C12 -14 14 -32 0 -50 Z"
        fill="#fb923c"
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
        animate={{ scaleY: [1, 1.18, 0.94, 1.1, 1], scaleX: [1, 0.92, 1.06, 0.96, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.path
        d="M0 -36 C-7 -26 -6 -16 0 -10 C6 -16 7 -26 0 -36 Z"
        fill="#fde68a"
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
        animate={{ scaleY: [1, 1.25, 0.9, 1.15, 1] }}
        transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

export function BossScene({ game }: { game: QuizGame }) {
  const { total, results, runId } = game;
  const killAt = Math.max(1, Math.ceil(total * KILL_SHARE));
  const failAt = Math.max(1, Math.ceil(total * FAIL_SHARE));
  const correct = results.filter((r) => r.correct).length;
  const hits = results.filter((r) => !r.correct && !r.shielded).length;
  const bossHp = Math.max(0, 1 - correct / killAt);
  const heroHp = Math.max(0, 1 - hits / failAt);
  const dead = bossHp <= 0;

  const sparks = useMemo(embers, []);

  // One shot per answered question: a spell from the wizard, or a fireball from the boss.
  const [shot, setShot] = useState<{ id: number; hero: boolean } | null>(null);
  const heroFx = useAnimationControls();
  const bossFx = useAnimationControls();
  const pulse = useMotionValue(0);
  const glow = useTransform(pulse, [0, 1], [0.35, 0.8]);

  useEffect(() => {
    const last = results[results.length - 1];
    if (!last) {
      setShot(null);
      return;
    }
    const id = results.length;
    setShot({ id, hero: last.correct });
    const t = setTimeout(() => {
      if (last.correct)
        void bossFx.start({
          x: [0, 14, -10, 6, 0],
          filter: ["brightness(1)", "brightness(3)", "brightness(1)"],
          transition: { duration: 0.45 },
        });
      else if (!last.shielded)
        void heroFx.start({
          x: [0, -16, 10, -6, 0],
          filter: ["brightness(1)", "brightness(2.4) saturate(2)", "brightness(1)"],
          transition: { duration: 0.45 },
        });
    }, 420);
    return () => clearTimeout(t);
  }, [results, bossFx, heroFx]);

  useEffect(() => {
    game.registerAdvance(async (_from, _to, duration) => {
      await animate(pulse, [0, 1, 0], { duration, ease: "easeInOut" }).finished;
    });
    return () => game.registerAdvance(null);
  }, [game, pulse]);

  const ringRotate = 360;

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="bs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0716" />
          <stop offset="0.65" stopColor="#1d1038" />
          <stop offset="1" stopColor="#2a1450" />
        </linearGradient>
        <radialGradient id="bs-portal" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c084fc" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#7c3aed" stopOpacity="0.35" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bs-torch" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fb923c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bs-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1a4d" />
          <stop offset="1" stopColor="#0d0820" />
        </linearGradient>
        <radialGradient id="bs-body" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.6" stopColor="#4c1d95" />
          <stop offset="1" stopColor="#1e0b3d" />
        </radialGradient>
        <radialGradient id="bs-orb" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ecfeff" />
          <stop offset="0.4" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0891b2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bs-fire" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff7ed" />
          <stop offset="0.35" stopColor="#fb923c" />
          <stop offset="1" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bs-robe" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#312e81" />
        </linearGradient>
      </defs>

      <rect width={VB_W} height={VB_H} fill="url(#bs-sky)" />

      {/* Portal glow behind the boss, pulsing as the fight moves on */}
      <motion.circle cx={BOSS.x} cy={BOSS.y} r={260} fill="url(#bs-portal)" style={{ opacity: glow }} />

      {/* Gothic arches */}
      {[120, 380, 640, 900].map((x) => (
        <path
          key={x}
          d={`M${x - 70} 470 V190 Q${x} 90 ${x + 70} 190 V470`}
          fill="none"
          stroke="#3b2566"
          strokeWidth={6}
          opacity={0.5}
        />
      ))}
      {[250, 510, 770].map((x) => (
        <path key={x} d={`M${x - 55} 470 V230 Q${x} 150 ${x + 55} 230 V470`} fill="#150c2b" opacity={0.55} />
      ))}

      <Torch x={60} y={300} />
      <Torch x={940} y={290} />

      {/* Floor */}
      <rect y={470} width={VB_W} height={VB_H - 470} fill="url(#bs-floor)" />
      <line x1={0} x2={VB_W} y1={470} y2={470} stroke="#7c3aed" strokeOpacity={0.5} strokeWidth={2} />
      {[-300, -150, 0, 150, 300, 450, 600, 750, 900, 1050, 1200, 1350].map((x, i) => (
        <line
          key={i}
          x1={VB_W / 2 + (x - VB_W / 2) * 0.25}
          y1={470}
          x2={x}
          y2={VB_H}
          stroke="#6d28d9"
          strokeOpacity={0.18}
        />
      ))}
      {[500, 535, 580, 640].map((y) => (
        <line key={y} x1={0} x2={VB_W} y1={y} y2={y} stroke="#6d28d9" strokeOpacity={0.15} />
      ))}

      {/* Rising embers */}
      {sparks.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.x}
          r={s.r}
          fill={s.hue}
          initial={{ cy: s.y, opacity: 0 }}
          animate={{ cy: s.y - 260, opacity: [0, 0.9, 0] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "easeOut" }}
        />
      ))}

      {/* ── Boss ─────────────────────────────────────────────────────── */}
      <motion.g
        key={`boss-${runId}`}
        initial={false}
        animate={dead ? { opacity: 0, scale: 0.4, rotate: 25, y: 60 } : { opacity: 1, scale: 1, rotate: 0, y: 0 }}
        transition={{ duration: dead ? 1.1 : 0.4, ease: "easeIn" }}
        style={{ transformBox: "fill-box", transformOrigin: "50% 60%" }}
      >
        <g transform={`translate(${BOSS.x} ${BOSS.y})`}>
          <motion.g animate={bossFx}>
            <motion.g animate={{ y: [0, -14, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
              <ellipse cx={0} cy={250} rx={110} ry={16} fill="#000" opacity={0.35} />
              <motion.ellipse
                cx={0}
                cy={10}
                rx={150}
                ry={38}
                fill="none"
                stroke="#c084fc"
                strokeWidth={2.5}
                strokeDasharray="8 14"
                opacity={0.7}
                animate={{ rotate: ringRotate }}
                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
              {/* horns */}
              <path d="M-62 -70 C-100 -120 -92 -168 -66 -190 C-72 -150 -52 -118 -34 -92 Z" fill="#e9d5ff" />
              <path d="M62 -70 C100 -120 92 -168 66 -190 C72 -150 52 -118 34 -92 Z" fill="#e9d5ff" />
              {/* body */}
              <ellipse
                cx={0}
                cy={0}
                rx={105}
                ry={92}
                fill="url(#bs-body)"
                stroke="#a78bfa"
                strokeOpacity={0.5}
                strokeWidth={2}
              />
              <path d="M-80 30 Q0 70 80 30" fill="none" stroke="#a78bfa" strokeOpacity={0.25} strokeWidth={3} />
              {/* eyes */}
              {[-38, 38].map((x) => (
                <motion.g
                  key={x}
                  animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
                  transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.9, 0.94, 0.98, 1] }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                >
                  <ellipse cx={x} cy={-18} rx={19} ry={14} fill="#fde047" />
                  <ellipse cx={x} cy={-18} rx={19} ry={14} fill="none" stroke="#f59e0b" strokeWidth={2} />
                  <ellipse cx={x + (x < 0 ? 3 : -3)} cy={-18} rx={4.5} ry={11} fill="#1e0b3d" />
                </motion.g>
              ))}
              <path d="M-52 -40 L-20 -30 M52 -40 L20 -30" stroke="#1e0b3d" strokeWidth={6} strokeLinecap="round" />
              {/* maw */}
              <path d="M-48 22 Q0 62 48 22 Q0 40 -48 22 Z" fill="#12061f" />
              {[-34, -17, 0, 17, 34].map((x) => (
                <path
                  key={x}
                  d={`M${x - 6} ${24 + Math.abs(x) * 0.05} L${x} ${38 - Math.abs(x) * 0.12} L${x + 6} ${24 + Math.abs(x) * 0.05} Z`}
                  fill="#f5f3ff"
                />
              ))}
              {/* fists */}
              <motion.circle
                cx={-160}
                cy={56}
                r={30}
                fill="url(#bs-body)"
                stroke="#a78bfa"
                strokeOpacity={0.5}
                strokeWidth={2}
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.circle
                cx={160}
                cy={56}
                r={30}
                fill="url(#bs-body)"
                stroke="#a78bfa"
                strokeOpacity={0.5}
                strokeWidth={2}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.g>
          </motion.g>
        </g>
      </motion.g>

      {/* ── Wizard ───────────────────────────────────────────────────── */}
      <g transform={`translate(${HERO.x} ${HERO.y})`}>
        <ellipse cx={0} cy={92} rx={58} ry={10} fill="#000" opacity={0.4} />
        <motion.g animate={heroFx}>
          <motion.g animate={{ y: [0, -5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
            {/* staff */}
            <line x1={52} y1={-30} x2={60} y2={96} stroke="#92400e" strokeWidth={6} strokeLinecap="round" />
            <motion.circle
              cx={52}
              cy={-38}
              r={26}
              fill="url(#bs-orb)"
              animate={{ scale: [1, 1.18, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <circle cx={52} cy={-38} r={8} fill="#ecfeff" />
            {/* robe + cape */}
            <path d="M-40 92 L-26 -4 Q0 -22 26 -4 L40 92 Z" fill="url(#bs-robe)" />
            <path d="M-26 -4 Q-62 40 -48 92 L-34 92 Z" fill="#4338ca" opacity={0.85} />
            <path d="M-22 40 H22" stroke="#fbbf24" strokeWidth={4} strokeLinecap="round" />
            {/* arm */}
            <path d="M18 8 L50 -14" stroke="#4338ca" strokeWidth={13} strokeLinecap="round" />
            <circle cx={50} cy={-14} r={7} fill="#fcd9b6" />
            {/* head + hat */}
            <circle cx={0} cy={-28} r={20} fill="#fcd9b6" />
            <circle cx={7} cy={-30} r={2.4} fill="#1e1b4b" />
            <circle cx={-3} cy={-30} r={2.4} fill="#1e1b4b" />
            <path d="M-4 -20 Q2 -16 8 -20" stroke="#9a3412" strokeWidth={2} fill="none" strokeLinecap="round" />
            <path d="M-30 -42 H30 L8 -118 Q-4 -122 -30 -42 Z" fill="#4f46e5" />
            <ellipse cx={0} cy={-42} rx={36} ry={8} fill="#6366f1" />
            <circle cx={-2} cy={-62} r={4} fill="#fde68a" />
            <circle cx={8} cy={-84} r={3} fill="#fde68a" />
          </motion.g>
        </motion.g>
      </g>

      {/* ── Shots ────────────────────────────────────────────────────── */}
      {shot && shot.hero && (
        <motion.g
          key={`s${runId}-${shot.id}`}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: BOSS.x - HERO.x - 130, y: BOSS.y - HERO.y + 40, opacity: [1, 1, 0] }}
          transition={{ duration: 0.45, ease: "easeIn" }}
        >
          <circle cx={HERO.x + 52} cy={HERO.y - 38} r={34} fill="url(#bs-orb)" />
          <circle cx={HERO.x + 52} cy={HERO.y - 38} r={10} fill="#fff" />
        </motion.g>
      )}
      {shot && !shot.hero && (
        <motion.g
          key={`f${runId}-${shot.id}`}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: HERO.x - BOSS.x + 40, y: HERO.y - BOSS.y - 10, opacity: [1, 1, 0] }}
          transition={{ duration: 0.45, ease: "easeIn" }}
        >
          <circle cx={BOSS.x} cy={BOSS.y + 30} r={38} fill="url(#bs-fire)" />
          <circle cx={BOSS.x} cy={BOSS.y + 30} r={12} fill="#fff7ed" />
        </motion.g>
      )}

      {/* ── HP bars ──────────────────────────────────────────────────── */}
      <g transform="translate(30 84)">
        <rect width={270} height={14} rx={7} fill="#000" opacity={0.45} />
        <motion.rect
          height={14}
          rx={7}
          fill={heroHpColor(heroHp)}
          initial={false}
          animate={{ width: 270 * heroHp }}
          transition={{ duration: 0.5 }}
        />
        <text x={0} y={-6} fill="#c7d2fe" fontSize={13} fontWeight={700}>
          WIZARD
        </text>
      </g>
      <g transform="translate(560 84)">
        <rect width={400} height={16} rx={8} fill="#000" opacity={0.45} />
        <motion.rect
          height={16}
          rx={8}
          fill="#f43f5e"
          initial={false}
          animate={{ width: 400 * bossHp }}
          transition={{ duration: 0.6 }}
        />
        <text x={400} y={-6} fill="#fda4af" fontSize={13} fontWeight={700} textAnchor="end">
          {dead ? "DEFEATED" : "VOID WARDEN"}
        </text>
      </g>
    </svg>
  );
}

function heroHpColor(hp: number) {
  return hp > 0.5 ? "#34d399" : hp > 0.25 ? "#fbbf24" : "#f87171";
}

export function BossPreview() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="bsp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0716" />
          <stop offset="1" stopColor="#2a1450" />
        </linearGradient>
        <radialGradient id="bsp-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c084fc" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bsp-body" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#1e0b3d" />
        </radialGradient>
      </defs>
      <rect width={200} height={120} fill="url(#bsp-sky)" />
      <circle cx={145} cy={48} r={62} fill="url(#bsp-glow)" />
      <rect y={92} width={200} height={28} fill="#1a0f33" />
      <line x1={0} x2={200} y1={92} y2={92} stroke="#7c3aed" strokeOpacity={0.6} />
      <path
        d="M118 28 C106 14 108 6 114 2 C112 12 120 18 126 24 Z M172 28 C184 14 182 6 176 2 C178 12 170 18 164 24 Z"
        fill="#e9d5ff"
      />
      <ellipse cx={145} cy={48} rx={26} ry={23} fill="url(#bsp-body)" />
      <ellipse cx={135} cy={44} rx={5} ry={4} fill="#fde047" />
      <ellipse cx={155} cy={44} rx={5} ry={4} fill="#fde047" />
      <path d="M133 56 Q145 66 157 56 Q145 60 133 56 Z" fill="#12061f" />
      <path d="M26 92 L32 60 Q40 54 48 60 L54 92 Z" fill="#4f46e5" />
      <circle cx={40} cy={54} r={6} fill="#fcd9b6" />
      <path d="M31 50 H49 L42 30 Q38 29 31 50 Z" fill="#6366f1" />
      <line x1={60} y1={58} x2={62} y2={92} stroke="#92400e" strokeWidth={2} />
      <circle cx={60} cy={55} r={7} fill="#67e8f9" opacity={0.9} />
      <line x1={66} y1={55} x2={118} y2={48} stroke="#67e8f9" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
      <rect x={110} y={8} width={80} height={5} rx={2.5} fill="#000" opacity={0.4} />
      <rect x={110} y={8} width={52} height={5} rx={2.5} fill="#f43f5e" />
    </svg>
  );
}
