"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * The hero picture: an isometric study desk in ink line-art over a watercolour
 * wash. Drawn from simple 3D boxes projected to the page, so every edge sits
 * on the same grid. On load the ink draws itself in; small cards then take
 * turns popping up over the scene.
 */

const K = 1.3;
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const OX = 262;
const OY = 232;

type P3 = [number, number, number];

function iso([x, y, z]: P3): [number, number] {
  return [OX + (x - y) * COS * K, OY + (x + y) * SIN * K - z * K];
}

function poly(points: P3[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${iso(p).map((n) => n.toFixed(1)).join(" ")}`).join(" ") + " Z";
}

/** The three faces you can see of an axis-aligned box: top, right (+x) and left (+y). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): string[] {
  return [
    poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]),
    poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]),
    poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]),
  ];
}

/** A vertical cylinder: side silhouette + top ellipse. */
function cylinder(cx: number, cy: number, r: number, z0: number, z1: number): string[] {
  const ring = (z: number) =>
    Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a), z] as P3;
    });
  const top = ring(z1);
  const bottom = ring(z0);
  // Silhouette: the half of each ring that faces the viewer. In this projection
  // "towards the viewer" is +x+y, i.e. 45° — so the front half runs -45°..135°.
  const isFront = (i: number) => {
    const deg = (i / 24) * 360;
    return deg >= 315 || deg <= 135;
  };
  const order = Array.from({ length: 24 }, (_, i) => (i + 21) % 24).filter(isFront); // -45° → 135°
  const front = order.map((i) => bottom[i]);
  const frontTop = order.map((i) => top[i]).reverse();
  return [poly([...front, ...frontTop]), poly(top)];
}

/**
 * An SVG matrix that lays flat text onto the desk-top plane at (x, y, z),
 * running along the x axis — so a label reads like it is printed on paper.
 */
function onTop(x: number, y: number, z: number, along: "x" | "y" = "x"): string {
  const [e, f] = iso([x, y, z]);
  return along === "x"
    ? `matrix(${COS} ${SIN} ${-COS} ${SIN} ${e} ${f})`
    : `matrix(${COS} ${-SIN} ${COS} ${SIN} ${e} ${f})`;
}

/** Text on the laptop screen, which faces the viewer's left (+y). */
function onScreen(x: number, y: number, z: number): string {
  const [e, f] = iso([x, y, z]);
  return `matrix(${COS} ${SIN} 0 1 ${e} ${f})`;
}

/* ------------------------------------------------------------- the scene --- */

const DESK = { x0: 0, y0: 0, x1: 190, y1: 105, z: 74, t: 5 };

const SHAPES: { d: string; fill?: string }[] = [];
const add = (paths: string[], fill = "var(--ill-paper)") => paths.forEach((d) => SHAPES.push({ d, fill }));

// papers on the floor, back left
add(box(-62, 30, 0, -22, 62, 3));
add(box(-58, 34, 3, -20, 64, 5));
add(box(-63, 28, 5, -26, 58, 7));
// desk legs (back ones first)
add(box(2, 2, 0, 7, 7, DESK.z));
add(box(DESK.x1 - 7, 2, 0, DESK.x1 - 2, 7, DESK.z));
add(box(2, DESK.y1 - 7, 0, 7, DESK.y1 - 2, DESK.z));
add(box(DESK.x1 - 7, DESK.y1 - 7, 0, DESK.x1 - 2, DESK.y1 - 2, DESK.z));
// desk top
add(box(DESK.x0, DESK.y0, DESK.z, DESK.x1, DESK.y1, DESK.z + DESK.t));
const TOP = DESK.z + DESK.t;
// books, stacked a little askew
add(box(132, 10, TOP, 176, 40, TOP + 6));
add(box(135, 12, TOP + 6, 172, 38, TOP + 11), "var(--ill-wash)");
add(box(131, 9, TOP + 11, 170, 36, TOP + 16));
// laptop base and lid
add(box(28, 26, TOP, 98, 74, TOP + 3));
SHAPES.push({ d: poly([[28, 26, TOP + 3], [98, 26, TOP + 3], [98, 20, TOP + 56], [28, 20, TOP + 56]]), fill: "var(--ill-paper)" });
SHAPES.push({ d: poly([[32, 26.3, TOP + 7], [94, 26.3, TOP + 7], [94, 21, TOP + 52], [32, 21, TOP + 52]]), fill: "var(--ill-screen)" });
// sticky note + loose sheets
add([poly([[44, 82, TOP + 0.5], [72, 82, TOP + 0.5], [72, 100, TOP + 0.5], [44, 100, TOP + 0.5]])], "var(--ill-note)");
add([poly([[104, 56, TOP + 0.5], [138, 52, TOP + 0.5], [142, 92, TOP + 0.5], [108, 96, TOP + 0.5]])]);
add([poly([[108, 60, TOP + 1], [140, 60, TOP + 1], [140, 98, TOP + 1], [108, 98, TOP + 1]])]);
// mug
add(cylinder(165, 78, 9, TOP, TOP + 17));
// pencil
SHAPES.push({ d: poly([[78, 88, TOP + 1], [100, 80, TOP + 1], [101, 82, TOP + 1], [79, 90, TOP + 1]]), fill: "var(--ill-wash)" });
// chair: back legs, seat, front legs, backrest
add(box(112, 128, 0, 116, 132, 42));
add(box(150, 128, 0, 154, 132, 42));
add(box(108, 126, 42, 158, 166, 46));
add(box(112, 160, 0, 116, 164, 42));
add(box(150, 160, 0, 154, 164, 42));
add(box(108, 162, 46, 158, 166, 98));

/* ------------------------------------------------------------ the cards --- */

const CARDS = [
  { kicker: "lesson 4", title: "Photosynthesis", badge: "Made for you", meta: "Visual · 8 min", quote: "Diagrams first, like you asked.", pos: "right-0 top-2" },
  { kicker: "review", title: "Cell division", badge: "Due today", meta: "3 questions", quote: "Just before you'd forget it.", pos: "left-0 top-20" },
  { kicker: "tutor", title: "What is chlorophyll?", badge: "Answered", meta: "From slide 2", quote: "The green pigment that catches light.", pos: "right-4 bottom-24" },
];

function FloatingCards() {
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    const first = window.setTimeout(() => setIndex(0), 2600);
    const id = window.setInterval(() => setIndex((i) => (i + 1) % CARDS.length), 4200);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  const card = index >= 0 ? CARDS[index] : undefined;
  return (
    <AnimatePresence mode="wait">
      {card && (
        <motion.div
          key={card.kicker}
          initial={{ opacity: 0, y: 10, scale: 0.96, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, scale: 0.98, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute ${card.pos} hidden w-[238px] sm:block rounded-2xl border border-foreground/10 bg-card/95 p-4 shadow-float backdrop-blur`}
        >
          <p className="text-[12px] font-medium text-amber">{card.kicker}</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold leading-tight">{card.title}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{card.meta}</p>
            </div>
            <span className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
              {card.badge}
            </span>
          </div>
          <p className="mt-3 border-t border-foreground/10 pt-2.5 font-display text-[15px] italic leading-snug">{card.quote}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function HeroIllustration() {
  const reduce = useReducedMotion();
  const draw = (i: number) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, fillOpacity: 0 },
          animate: { pathLength: 1, fillOpacity: 1 },
          transition: {
            pathLength: { duration: 0.9, delay: 0.15 + i * 0.035, ease: "easeInOut" as const },
            fillOpacity: { duration: 0.4, delay: 0.55 + i * 0.035 },
          },
        };

  return (
    <div
      className="relative mx-auto aspect-[560/480] w-full max-w-[560px] [--ill-ink:#2A2722] [--ill-note:#F6D98A] [--ill-paper:#FFFDF7] [--ill-screen:#F3EEE2] [--ill-wash:#F2C46B] dark:[--ill-ink:#E9E2D2] dark:[--ill-note:#8A6A24] dark:[--ill-paper:#26241F] dark:[--ill-screen:#1D1B17] dark:[--ill-wash:#8A6A24]"
    >
      <svg viewBox="0 0 560 480" className="h-full w-full overflow-visible" role="img" aria-label="A study desk with a laptop showing a lesson, books, notes and a mug">
        <defs>
          <filter id="wc" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="90" />
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="wcGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="9" />
            <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.3  0 0 0 0 0.05  0 0 0 0.18 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        {/* watercolour wash */}
        <motion.g
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "290px 250px" }}
          className="dark:opacity-60"
        >
          <g filter="url(#wc)">
            <ellipse cx="290" cy="240" rx="200" ry="185" fill="#F6C96A" opacity="0.75" />
            <ellipse cx="300" cy="300" rx="140" ry="120" fill="#EE9A3C" opacity="0.7" />
            <ellipse cx="250" cy="190" rx="110" ry="90" fill="#F4B654" opacity="0.6" />
            <ellipse cx="335" cy="330" rx="90" ry="70" fill="#E0762A" opacity="0.55" />
          </g>
          <ellipse cx="290" cy="250" rx="190" ry="175" fill="#000" filter="url(#wcGrain)" opacity="0.6" />
        </motion.g>

        {/* the ink */}
        <g stroke="var(--ill-ink)" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round">
          {SHAPES.map((shape, i) => (
            <motion.path key={i} d={shape.d} fill={shape.fill ?? "none"} {...draw(i)} />
          ))}
        </g>

        {/* things written on things */}
        <motion.g
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          fill="var(--ill-ink)"
          className="font-hand"
        >
          <text transform={onScreen(38, 25, TOP + 44)} fontSize="7.5" fontWeight="700">PHOTOSYNTHESIS</text>
          <text transform={onScreen(38, 24.4, TOP + 34)} fontSize="6">• light is captured</text>
          <text transform={onScreen(38, 23.8, TOP + 26)} fontSize="6">• water is split</text>
          <text transform={onScreen(38, 23.2, TOP + 18)} fontSize="6">• sugar is built</text>
          <text transform={onTop(47, 94, TOP + 1)} fontSize="9" fontWeight="700">lesson 4</text>
          <text transform={onTop(113, 74, TOP + 1.5)} fontSize="8">notes</text>
          <text transform={onTop(113, 86, TOP + 1.5)} fontSize="11" fontWeight="700">you</text>
          <text transform={onTop(136, 32, TOP + 17, "y")} fontSize="6">biology</text>
        </motion.g>
      </svg>

      <FloatingCards />
    </div>
  );
}
