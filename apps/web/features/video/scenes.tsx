"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { Check, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlideView } from "@/lib/types";
import { Backdrop } from "./Backdrop";
import { Mascot, type Arm, type Mood } from "./Mascot";
import { iconFor, revealTime, seeded, type Theme } from "./theme";

export interface SceneProps {
  slide: SlideView;
  lessonTitle: string;
  index: number;
  total: number;
  theme: Theme;
  /** Seconds into this scene's narration. */
  t: number;
  /** Scene length in seconds. */
  D: number;
  speaking: boolean;
}

export type SceneKind = "hook" | "concept" | "diagram" | "outro";

export function sceneKind(slide: SlideView, index: number, total: number): SceneKind {
  if (index === 0) return "hook";
  if (index === total - 1 && total > 1) return "outro";
  const d = slide.board?.diagram;
  if (d && d.type !== "none" && d.nodes.length >= 2) return "diagram";
  return "concept";
}

export function Scene(props: SceneProps) {
  switch (sceneKind(props.slide, props.index, props.total)) {
    case "hook":
      return <HookScene {...props} />;
    case "outro":
      return <OutroScene {...props} />;
    case "diagram":
      return <DiagramScene {...props} />;
    default:
      return <ConceptScene {...props} />;
  }
}

// ── shared bits ─────────────────────────────────────────────────────────────

const VARIANTS: Record<string, Variants> = {
  up: { out: { opacity: 0, y: 26, scale: 0.96 }, in: { opacity: 1, y: 0, scale: 1 } },
  left: { out: { opacity: 0, x: -48 }, in: { opacity: 1, x: 0 } },
  right: { out: { opacity: 0, x: 48 }, in: { opacity: 1, x: 0 } },
  pop: { out: { opacity: 0, scale: 0.35 }, in: { opacity: 1, scale: 1 } },
  drop: { out: { opacity: 0, y: -40 }, in: { opacity: 1, y: 0 } },
};

/** Springs an element in the moment `on` flips true — the clock decides when. */
function Reveal({
  on,
  from = "up",
  delay = 0,
  className,
  style,
  children,
}: {
  on: boolean;
  from?: keyof typeof VARIANTS;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <motion.div
      variants={VARIANTS[from]}
      initial={on ? "in" : "out"}
      animate={on ? "in" : "out"}
      transition={{ type: "spring", stiffness: 210, damping: 20, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

const glass: CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.2)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

function SceneFrame({
  theme,
  index,
  t,
  D,
  mood,
  arm,
  speaking,
  mascotClass = "left-[1cqw] bottom-[1cqw] w-[19cqw]",
  children,
}: {
  theme: Theme;
  index: number;
  t: number;
  D: number;
  mood: Mood;
  arm: Arm;
  speaking: boolean;
  mascotClass?: string;
  children: ReactNode;
}) {
  const p = D > 0 ? Math.min(1, Math.max(0, t / D)) : 0;
  return (
    <div className="absolute inset-0 overflow-hidden text-white">
      <Backdrop theme={theme} seed={index + 1} progress={p} />
      {/* slow push-in: the "camera" */}
      <div
        className="absolute inset-0"
        style={{ transform: `scale(${1 + 0.04 * p})`, transformOrigin: "60% 45%", transition: "transform .1s linear" }}
      >
        {children}
      </div>
      <div className={cn("absolute z-10", mascotClass)}>
        <Mascot theme={theme} mood={mood} arm={arm} speaking={speaking} className="h-auto w-full drop-shadow-2xl" />
      </div>
    </div>
  );
}

function Header({
  theme,
  index,
  total,
  title,
  t,
}: {
  theme: Theme;
  index: number;
  total: number;
  title: string;
  t: number;
}) {
  return (
    <div className="absolute left-[3cqw] right-[3cqw] top-[2.4cqw]">
      <Reveal on={t >= 0.05} from="left">
        <p className="text-[1.25cqw] font-bold uppercase tracking-[0.3em]" style={{ color: theme.accent2 }}>
          Chapter {String(index + 1).padStart(2, "0")}{" "}
          <span className="opacity-50">/ {String(total).padStart(2, "0")}</span>
        </p>
      </Reveal>
      <Reveal on={t >= 0.2} from="left" delay={0.05}>
        <h2
          className="mt-[0.4cqw] line-clamp-2 max-w-[88cqw] font-display font-extrabold leading-[1.08]"
          style={{ fontSize: title.length > 48 ? "3.2cqw" : "3.9cqw", textShadow: "0 0.3cqw 1.2cqw rgba(0,0,0,.45)" }}
        >
          {title}
        </h2>
      </Reveal>
      <motion.div
        className="mt-[0.7cqw] h-[0.45cqw] rounded-full"
        style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
        initial={false}
        animate={{ width: t >= 0.3 ? "18cqw" : "0cqw" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

/** Key terms, stacked in the left column above the presenter. */
function TermChips({ terms, theme, t, D }: { terms: string[]; theme: Theme; t: number; D: number }) {
  const shown = terms.slice(0, 4);
  return (
    <div className="absolute left-[3cqw] top-[15.5cqw] flex w-[22cqw] flex-col gap-[0.8cqw]">
      {shown.map((term, i) => (
        <Reveal key={term + i} on={t >= revealTime(i, shown.length, D) + D * 0.08} from="left">
          <span
            className="inline-flex max-w-full items-center gap-[0.6cqw] rounded-full px-[1.2cqw] py-[0.55cqw] font-bold"
            style={{ ...glass, fontSize: "1.4cqw", borderColor: theme.accent }}
          >
            <Sparkles style={{ width: "1.3cqw", height: "1.3cqw", color: theme.accent2 }} className="shrink-0" />
            <span className="truncate">{term}</span>
          </span>
        </Reveal>
      ))}
    </div>
  );
}

/** A glowing icon with orbiting rings and satellite icons — the hero visual when there's no photo. */
function OrbitHero({
  Icon,
  satellites,
  theme,
  on,
  size,
}: {
  Icon: LucideIcon;
  satellites: LucideIcon[];
  theme: Theme;
  on: boolean;
  size: number;
}) {
  const rad = size / 2;
  return (
    <Reveal on={on} from="pop" className="relative" style={{ width: `${size}cqw`, height: `${size}cqw` }}>
      <div
        className="absolute inset-[-12%] rounded-full opacity-60 blur-2xl xv-pulse"
        style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 70%)` }}
      />
      <div
        className="xv-spin absolute inset-0 rounded-full border-2 border-dashed"
        style={{ borderColor: theme.accent }}
      />
      <div
        className="xv-spin-rev absolute inset-[12%] rounded-full border"
        style={{ borderColor: theme.accent2, opacity: 0.6 }}
      />
      {satellites.slice(0, 3).map((Sat, i) => (
        <div
          key={i}
          className="xv-spin absolute inset-0"
          style={{ animationDuration: `${18 + i * 6}s`, animationDelay: `${-i * 5}s` }}
        >
          <div
            className="xv-spin-rev absolute grid place-items-center rounded-full"
            style={{
              ...glass,
              left: `${(50 + 50 * Math.cos((i * 2 * Math.PI) / 3)).toFixed(3)}%`,
              top: `${(50 + 50 * Math.sin((i * 2 * Math.PI) / 3)).toFixed(3)}%`,
              width: `${rad * 0.34}cqw`,
              height: `${rad * 0.34}cqw`,
              marginLeft: `${-rad * 0.17}cqw`,
              marginTop: `${-rad * 0.17}cqw`,
              animationDuration: `${18 + i * 6}s`,
              animationDelay: `${-i * 5}s`,
            }}
          >
            <Sat style={{ width: `${rad * 0.18}cqw`, height: `${rad * 0.18}cqw`, color: theme.accent2 }} />
          </div>
        </div>
      ))}
      <div
        className="absolute inset-[22%] grid place-items-center rounded-full shadow-2xl"
        style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
      >
        <Icon
          style={{ width: `${size * 0.26}cqw`, height: `${size * 0.26}cqw` }}
          className="text-slate-900 drop-shadow"
          strokeWidth={1.8}
        />
      </div>
    </Reveal>
  );
}

function PhotoCard({
  src,
  credit,
  theme,
  on,
  p,
}: {
  src: string;
  credit: string | null;
  theme: Theme;
  on: boolean;
  p: number;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <Reveal on={on} from="right" className="absolute right-[3cqw] top-[14.5cqw] w-[27cqw]">
      <div className="xv-float" style={{ animationDuration: "7s" }}>
        <div
          className="overflow-hidden rounded-[1.4cqw] shadow-2xl"
          style={{ border: `0.35cqw solid ${theme.accent}`, transform: "rotate(2deg)", aspectRatio: "4 / 3" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
            style={{ transform: `scale(${1.05 + 0.14 * p})`, transition: "transform .1s linear" }}
          />
        </div>
        {credit && (
          <p className="mt-[0.5cqw] text-right text-[0.9cqw] text-white/60" style={{ transform: "rotate(2deg)" }}>
            {credit}
          </p>
        )}
      </div>
    </Reveal>
  );
}

// ── Hook (first slide) ──────────────────────────────────────────────────────

function HookScene(props: SceneProps) {
  const { slide, lessonTitle, theme, t, D, speaking, index } = props;
  const words = lessonTitle.split(/\s+/).filter(Boolean);
  const Icon = iconFor(lessonTitle);
  const sats = [iconFor(slide.title, 1), iconFor(slide.points[0] ?? "", 2), iconFor(slide.points[1] ?? "", 3)];
  const points = slide.points.slice(0, 3);
  const big = lessonTitle.length > 40 ? 5.2 : 6.6;

  return (
    <SceneFrame theme={theme} index={index} t={t} D={D} mood="happy" arm="wave" speaking={speaking}>
      <Reveal on={t >= 0.1} from="drop" className="absolute left-[28cqw] top-[5cqw]">
        <span
          className="rounded-full px-[1.6cqw] py-[0.6cqw] text-[1.3cqw] font-bold uppercase tracking-[0.28em]"
          style={{ ...glass, color: theme.accent2 }}
        >
          Animated lesson
        </span>
      </Reveal>

      <div className="absolute left-[28cqw] top-[10.5cqw] flex w-[40cqw] flex-wrap gap-x-[1.4cqw] gap-y-[0.4cqw]">
        {words.map((w, i) => (
          <Reveal key={i} on={t >= 0.3 + i * 0.28} from="up">
            <span
              className="inline-block font-display font-black leading-[1.02]"
              style={{
                fontSize: `${big}cqw`,
                textShadow: "0 0.5cqw 1.6cqw rgba(0,0,0,.5)",
                backgroundImage: i % 2 === 0 ? undefined : `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
                WebkitBackgroundClip: i % 2 === 0 ? undefined : "text",
                backgroundClip: i % 2 === 0 ? undefined : "text",
                color: i % 2 === 0 ? "#fff" : "transparent",
              }}
            >
              {w}
            </span>
          </Reveal>
        ))}
      </div>

      <Reveal
        on={t >= 0.3 + words.length * 0.28 + 0.2}
        from="up"
        className="absolute left-[28cqw] top-[33cqw] w-[38cqw]"
      >
        <p className="font-semibold text-white/85" style={{ fontSize: "2cqw" }}>
          {slide.title}
        </p>
      </Reveal>

      <div className="absolute right-[4cqw] top-[7cqw]">
        <OrbitHero Icon={Icon} satellites={sats} theme={theme} on={t >= 0.5} size={27} />
      </div>

      <div className="absolute left-[28cqw] top-[39cqw] flex w-[68cqw] gap-[1.2cqw]">
        {points.map((pt, i) => (
          <Reveal key={i} on={t >= revealTime(i, points.length, D) + D * 0.1} from="up" className="min-w-0 flex-1">
            <div
              className="rounded-[1.2cqw] px-[1.2cqw] py-[0.8cqw] font-medium leading-snug"
              style={{ ...glass, fontSize: "1.45cqw" }}
            >
              <span className="line-clamp-2">{pt}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </SceneFrame>
  );
}

// ── Concept ─────────────────────────────────────────────────────────────────

function ConceptScene(props: SceneProps) {
  const { slide, theme, t, D, speaking, index, total } = props;
  const points = slide.points.slice(0, 6);
  const n = points.length;
  const hasPhoto = Boolean(slide.imageUrl);
  const font = n <= 3 ? 2.2 : n === 4 ? 1.95 : n === 5 ? 1.7 : 1.5;
  const times = points.map((_, i) => revealTime(i, n, D));
  const active = times.reduce((acc, at, i) => (t >= at ? i : acc), -1);
  const p = D > 0 ? Math.min(1, t / D) : 0;
  const HeroIcon = iconFor(slide.title, index);
  const sats = (slide.board?.keyTerms ?? points).slice(0, 3).map((x, i) => iconFor(x, i + 5));

  return (
    <SceneFrame
      theme={theme}
      index={index}
      t={t}
      D={D}
      mood={p > 0.85 ? "wow" : "happy"}
      arm="point"
      speaking={speaking}
    >
      <Header theme={theme} index={index} total={total} title={slide.title} t={t} />
      <TermChips terms={slide.board?.keyTerms ?? []} theme={theme} t={t} D={D} />

      <div
        className="absolute left-[28cqw] top-[14.5cqw] flex flex-col justify-center gap-[0.9cqw]"
        style={{ width: hasPhoto ? "38cqw" : "46cqw", height: "33cqw" }}
      >
        {points.map((pt, i) => {
          const Icon = iconFor(pt, i);
          const on = t >= times[i];
          const isActive = i === active;
          return (
            <Reveal key={i} on={on} from="left" delay={0.02}>
              <div
                className="flex items-center gap-[1.2cqw] rounded-[1.3cqw] px-[1.2cqw] py-[0.8cqw] transition-all duration-300"
                style={{
                  ...glass,
                  fontSize: `${font}cqw`,
                  background: isActive ? "rgba(255,255,255,0.2)" : glass.background,
                  borderColor: isActive ? theme.accent2 : "rgba(255,255,255,0.2)",
                  boxShadow: isActive ? `0 0 2.4cqw ${theme.accent}66` : "none",
                  transform: isActive ? "scale(1.025)" : "scale(1)",
                  opacity: isActive || active < 0 ? 1 : 0.8,
                }}
              >
                <span
                  className="grid shrink-0 place-items-center rounded-[1cqw]"
                  style={{
                    width: `${font * 1.9}cqw`,
                    height: `${font * 1.9}cqw`,
                    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                  }}
                >
                  <Icon
                    style={{ width: `${font * 1.05}cqw`, height: `${font * 1.05}cqw` }}
                    className="text-slate-900"
                    strokeWidth={2.2}
                  />
                </span>
                <span className="line-clamp-2 font-semibold leading-snug">{pt}</span>
              </div>
            </Reveal>
          );
        })}
      </div>

      {hasPhoto ? (
        <PhotoCard src={slide.imageUrl!} credit={slide.imageCredit} theme={theme} on={t >= 0.6} p={p} />
      ) : (
        <div className="absolute right-[4cqw] top-[16cqw]">
          <OrbitHero Icon={HeroIcon} satellites={sats} theme={theme} on={t >= 0.5} size={24} />
        </div>
      )}
    </SceneFrame>
  );
}

// ── Diagram ─────────────────────────────────────────────────────────────────

const W = 1000;
const H = 560;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function layout(type: string, n: number): Box[] {
  switch (type) {
    case "cycle": {
      const w = n > 6 ? 170 : 200;
      const h = n > 6 ? 84 : 98;
      return Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return { x: 500 + 330 * Math.cos(a), y: 285 + 190 * Math.sin(a), w, h };
      });
    }
    case "timeline": {
      const step = n > 1 ? 800 / (n - 1) : 0;
      return Array.from({ length: n }, (_, i) => ({
        x: n > 1 ? 100 + i * step : 500,
        y: i % 2 === 0 ? 135 : 425,
        w: 210,
        h: 110,
      }));
    }
    case "hierarchy": {
      const h = Math.min(92, H / n - 14);
      return Array.from({ length: n }, (_, i) => ({
        x: 500,
        y: h / 2 + 4 + i * (H / n),
        w: 960 - i * (420 / Math.max(1, n - 1)),
        h,
      }));
    }
    default: {
      // flow: one row up to 4, then a snaking pair of rows
      const w = 200;
      const h = n > 4 ? 120 : 140;
      if (n <= 4) {
        const gap = (W - n * w) / (n + 1);
        return Array.from({ length: n }, (_, i) => ({ x: gap + w / 2 + i * (w + gap), y: 280, w, h }));
      }
      const top = Math.ceil(n / 2);
      const bottom = n - top;
      const row = (count: number, y: number, reverse: boolean) => {
        const gap = (W - count * w) / (count + 1);
        return Array.from({ length: count }, (_, i) => {
          const k = reverse ? count - 1 - i : i;
          return { x: gap + w / 2 + k * (w + gap), y, w, h };
        });
      };
      return [...row(top, 150, false), ...row(bottom, 410, true)];
    }
  }
}

function NodeCard({
  box,
  label,
  num,
  on,
  active,
  theme,
  font = 1.9,
  align = "left",
}: {
  box: Box;
  label: string;
  num: number;
  on: boolean;
  active: boolean;
  theme: Theme;
  font?: number;
  align?: "left" | "center";
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${((box.x - box.w / 2) / W) * 100}%`,
        top: `${((box.y - box.h / 2) / H) * 100}%`,
        width: `${(box.w / W) * 100}%`,
        height: `${(box.h / H) * 100}%`,
      }}
    >
      <Reveal on={on} from="pop" className="h-full w-full">
        <div
          className={cn(
            "flex h-full w-full items-center gap-[0.9cqw] rounded-[1.3cqw] px-[1.1cqw] transition-all duration-300",
            align === "center" && "justify-center text-center",
          )}
          style={{
            ...glass,
            background: active ? "rgba(255,255,255,0.22)" : glass.background,
            borderColor: active ? theme.accent2 : theme.accent,
            boxShadow: active ? `0 0 2.6cqw ${theme.accent}88` : "none",
            transform: active ? "scale(1.06)" : "scale(1)",
          }}
        >
          <span
            className="grid shrink-0 place-items-center rounded-full font-black text-slate-900"
            style={{
              width: "2.9cqw",
              height: "2.9cqw",
              fontSize: "1.5cqw",
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
            }}
          >
            {num}
          </span>
          <span className="line-clamp-3 font-bold leading-tight" style={{ fontSize: `${font}cqw` }}>
            {label}
          </span>
        </div>
      </Reveal>
    </div>
  );
}

function DiagramScene(props: SceneProps) {
  const { slide, theme, t, D, speaking, index, total } = props;
  const diagram = slide.board!.diagram!;
  const nodes = diagram.nodes.slice(0, 8);
  const n = nodes.length;
  const type = diagram.type;
  const p = D > 0 ? Math.min(1, t / D) : 0;

  // Prefer the real board timeline (when each node is spoken); else spread evenly.
  const times = useMemo(() => {
    const events = slide.board?.timeline?.events.filter((e) => e.kind === "node") ?? [];
    const scale = slide.board?.timeline?.durationSec ? D / slide.board.timeline.durationSec : 1;
    return nodes.map((_, i) => {
      const ev = events.find((e) => e.index === i);
      return ev ? Math.max(0.6, ev.at * scale) : revealTime(i, n, D);
    });
  }, [slide, nodes, n, D]);
  const active = times.reduce((acc, at, i) => (t >= at ? i : acc), -1);
  const shown = active + 1;

  const boxes = useMemo(() => layout(type, n), [type, n]);

  let body: ReactNode;
  if (type === "compare" || type === "list") {
    body = <GridDiagram type={type} nodes={nodes} times={times} t={t} theme={theme} active={active} />;
  } else {
    // Connectors: flow/timeline link neighbours; cycle draws a ring.
    const links: [Box, Box][] = [];
    if (type === "flow") for (let i = 0; i < n - 1; i++) links.push([boxes[i], boxes[i + 1]]);
    body = (
      <>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <marker
              id={`ah-${index}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 1 L9 5 L0 9 Z" fill={theme.accent2} />
            </marker>
          </defs>
          {type === "cycle" && (
            <ellipse
              cx={500}
              cy={285}
              rx={330}
              ry={190}
              fill="none"
              stroke={theme.accent}
              strokeWidth={4}
              strokeDasharray="14 10"
              strokeLinecap="round"
              className="xv-march"
              opacity={shown > 1 ? 0.8 : 0}
              style={{ transition: "opacity .5s" }}
            />
          )}
          {type === "timeline" && (
            <motion.line
              x1={60}
              y1={280}
              x2={940}
              y2={280}
              stroke={theme.accent}
              strokeWidth={6}
              strokeLinecap="round"
              initial={false}
              animate={{ pathLength: shown > 0 ? Math.min(1, shown / n + 0.05) : 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
          {type === "timeline" &&
            boxes.map((b, i) => (
              <g key={i} style={{ opacity: t >= times[i] ? 1 : 0, transition: "opacity .4s" }}>
                <line
                  x1={b.x}
                  y1={280}
                  x2={b.x}
                  y2={i % 2 === 0 ? b.y + b.h / 2 : b.y - b.h / 2}
                  stroke={theme.accent2}
                  strokeWidth={3}
                />
                <circle cx={b.x} cy={280} r={13} fill={theme.accent2} stroke="#fff" strokeWidth={3} />
              </g>
            ))}
          {links.map(([a, b], i) => {
            const horizontal = Math.abs(a.y - b.y) < 20;
            const x1 = horizontal ? (b.x > a.x ? a.x + a.w / 2 : a.x - a.w / 2) : a.x;
            const y1 = horizontal ? a.y : a.y + a.h / 2;
            const x2 = horizontal ? (b.x > a.x ? b.x - b.w / 2 : b.x + b.w / 2) : b.x;
            const y2 = horizontal ? b.y : b.y - b.h / 2;
            return (
              <motion.path
                key={i}
                d={`M${x1} ${y1} L${x2} ${y2}`}
                stroke={theme.accent2}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray="12 10"
                fill="none"
                markerEnd={`url(#ah-${index})`}
                className="xv-march"
                initial={false}
                animate={{ opacity: shown > i + 1 ? 1 : 0 }}
                transition={{ duration: 0.4 }}
              />
            );
          })}
        </svg>
        {type === "hierarchy"
          ? boxes.map((b, i) => (
              <NodeCard
                key={i}
                box={b}
                label={nodes[i]}
                num={i + 1}
                on={t >= times[i]}
                active={i === active}
                theme={theme}
                align="center"
                font={2.1}
              />
            ))
          : boxes.map((b, i) => (
              <NodeCard
                key={i}
                box={b}
                label={nodes[i]}
                num={i + 1}
                on={t >= times[i]}
                active={i === active}
                theme={theme}
                font={n > 6 ? 1.5 : 1.8}
              />
            ))}
        {type === "cycle" && (
          <Reveal
            on={t >= 0.5}
            from="pop"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
          >
            <div
              className="xv-spin mx-auto grid place-items-center rounded-full"
              style={{ width: "7cqw", height: "7cqw", border: `0.35cqw dashed ${theme.accent2}` }}
            />
          </Reveal>
        )}
      </>
    );
  }

  return (
    <SceneFrame
      theme={theme}
      index={index}
      t={t}
      D={D}
      mood={p > 0.85 ? "wow" : "think"}
      arm="point"
      speaking={speaking}
    >
      <Header theme={theme} index={index} total={total} title={slide.title} t={t} />
      <TermChips terms={slide.board?.keyTerms ?? []} theme={theme} t={t} D={D} />
      <div className="absolute left-[30cqw] top-[14.2cqw]" style={{ width: "59cqw", aspectRatio: `${W} / ${H}` }}>
        {body}
        {type === "cycle" && (
          <Reveal on={t >= 0.5} from="pop" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span
              className="rounded-full px-[1.6cqw] py-[0.7cqw] font-extrabold uppercase tracking-widest text-slate-900"
              style={{ fontSize: "1.4cqw", background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
            >
              Cycle
            </span>
          </Reveal>
        )}
      </div>
    </SceneFrame>
  );
}

/** Compare (two columns) and list (card grid) diagrams. */
function GridDiagram({
  type,
  nodes,
  times,
  t,
  theme,
  active,
}: {
  type: "compare" | "list";
  nodes: string[];
  times: number[];
  t: number;
  theme: Theme;
  active: number;
}) {
  const n = nodes.length;
  if (type === "list") {
    return (
      <div className="absolute inset-0 grid auto-rows-fr grid-cols-2 content-center gap-[1.2cqw]">
        {nodes.map((label, i) => {
          const Icon = iconFor(label, i);
          return (
            <Reveal key={i} on={t >= times[i]} from="pop">
              <div
                className="flex h-full items-center gap-[1cqw] rounded-[1.3cqw] px-[1.2cqw] py-[0.8cqw] transition-all duration-300"
                style={{
                  ...glass,
                  borderColor: i === active ? theme.accent2 : "rgba(255,255,255,0.2)",
                  boxShadow: i === active ? `0 0 2.4cqw ${theme.accent}77` : "none",
                  transform: i === active ? "scale(1.04)" : "scale(1)",
                }}
              >
                <span
                  className="grid shrink-0 place-items-center rounded-[1cqw]"
                  style={{
                    width: "4cqw",
                    height: "4cqw",
                    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                  }}
                >
                  <Icon style={{ width: "2.2cqw", height: "2.2cqw" }} className="text-slate-900" />
                </span>
                <span className="line-clamp-3 font-bold leading-tight" style={{ fontSize: "1.8cqw" }}>
                  {label}
                </span>
              </div>
            </Reveal>
          );
        })}
      </div>
    );
  }

  const split = Math.max(1, Math.ceil(n / 2));
  const sides = [nodes.slice(0, split), nodes.slice(split)];
  return (
    <div className="absolute inset-0 grid grid-cols-2 gap-[3.4cqw]">
      {sides.map((side, s) => (
        <div key={s} className="flex flex-col justify-center gap-[1cqw]">
          {side.map((label, k) => {
            const i = s === 0 ? k : split + k;
            const header = k === 0;
            return (
              <Reveal key={i} on={t >= times[i]} from={s === 0 ? "left" : "right"}>
                <div
                  className="rounded-[1.3cqw] px-[1.4cqw] py-[1cqw] text-center font-bold transition-all duration-300"
                  style={{
                    ...glass,
                    fontSize: header ? "2.2cqw" : "1.7cqw",
                    background: header
                      ? `linear-gradient(135deg, ${theme.accent}cc, ${theme.accent2}cc)`
                      : glass.background,
                    color: header ? "#0f172a" : "#fff",
                    boxShadow: i === active ? `0 0 2.4cqw ${theme.accent}88` : "none",
                    transform: i === active ? "scale(1.04)" : "scale(1)",
                  }}
                >
                  {label}
                </div>
              </Reveal>
            );
          })}
        </div>
      ))}
      <Reveal
        on={t >= 0.6}
        from="pop"
        className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-black text-slate-900"
        style={{
          width: "5.4cqw",
          height: "5.4cqw",
          fontSize: "2cqw",
          background: `linear-gradient(135deg, ${theme.accent2}, ${theme.accent})`,
          boxShadow: "0 0 3cqw rgba(255,255,255,.4)",
        }}
      >
        VS
      </Reveal>
    </div>
  );
}

// ── Outro (last slide) ──────────────────────────────────────────────────────

const CONFETTI = ["#fde68a", "#f9a8d4", "#a5b4fc", "#67e8f9", "#86efac", "#fdba74"];

function OutroScene(props: SceneProps) {
  const { slide, theme, t, D, speaking, index, total } = props;
  const points = slide.points.slice(0, 6);
  const n = points.length;
  const font = n <= 3 ? 2.2 : n === 4 ? 1.95 : 1.65;
  const confetti = useMemo(() => {
    const rand = seeded(42);
    return Array.from({ length: 44 }, (_, i) => ({
      left: rand() * 100,
      delay: rand() * 2.6,
      dur: 2.6 + rand() * 2,
      w: 0.7 + rand() * 0.8,
      color: CONFETTI[i % CONFETTI.length],
    }));
  }, []);

  return (
    <SceneFrame theme={theme} index={index} t={t} D={D} mood="wow" arm="cheer" speaking={speaking}>
      <Header theme={theme} index={index} total={total} title={slide.title} t={t} />
      <TermChips terms={slide.board?.keyTerms ?? []} theme={theme} t={t} D={D} />

      <Reveal on={t >= 0.5} from="pop" className="absolute right-[5cqw] top-[15cqw]">
        <div
          className="xv-float grid place-items-center rounded-full shadow-2xl"
          style={{
            width: "13cqw",
            height: "13cqw",
            background: `linear-gradient(135deg, ${theme.accent2}, ${theme.accent})`,
          }}
        >
          <Trophy style={{ width: "7cqw", height: "7cqw" }} className="text-slate-900" strokeWidth={1.8} />
        </div>
      </Reveal>

      <div
        className="absolute left-[28cqw] top-[14.5cqw] flex flex-col justify-center gap-[0.9cqw]"
        style={{ width: "46cqw", height: "33cqw" }}
      >
        {points.map((pt, i) => {
          const on = t >= revealTime(i, n, D);
          return (
            <Reveal key={i} on={on} from="left">
              <div
                className="flex items-center gap-[1.2cqw] rounded-[1.3cqw] px-[1.2cqw] py-[0.8cqw]"
                style={{ ...glass, fontSize: `${font}cqw` }}
              >
                <motion.span
                  className="grid shrink-0 place-items-center rounded-full"
                  style={{ width: `${font * 1.7}cqw`, height: `${font * 1.7}cqw`, background: "#34d399" }}
                  initial={false}
                  animate={{ scale: on ? [0.4, 1.25, 1] : 0.4 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                >
                  <Check
                    style={{ width: `${font}cqw`, height: `${font}cqw` }}
                    className="text-emerald-950"
                    strokeWidth={3.5}
                  />
                </motion.span>
                <span className="line-clamp-2 font-semibold leading-snug">{pt}</span>
              </div>
            </Reveal>
          );
        })}
      </div>

      {t >= D * 0.3 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {confetti.map((c, i) => (
            <span
              key={i}
              className="absolute -top-[2cqw] block rounded-[0.15cqw]"
              style={{
                left: `${c.left}%`,
                width: `${c.w}cqw`,
                height: `${c.w * 1.7}cqw`,
                background: c.color,
                animation: `xv-confetti ${c.dur}s ${c.delay}s linear 2 both`,
              }}
            />
          ))}
        </div>
      )}
    </SceneFrame>
  );
}
