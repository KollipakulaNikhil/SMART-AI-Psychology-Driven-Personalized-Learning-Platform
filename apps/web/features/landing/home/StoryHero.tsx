"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { BuildProvider, Phone, PHONE_SCREENS } from "./PhoneScreens";

/**
 * The story after the hero. The section is several screens tall; its inner
 * stage is sticky. Everything on the stage is driven *directly* by scroll
 * position — no timed transitions — so it moves exactly with your hand and
 * never runs ahead of or behind the scroll. Each step holds still for most of
 * its slice, then cross-fades into the next over the last part.
 */

const STEPS: { verb: string; note: [string, string]; detail: string; status: string }[] = [
  {
    verb: "Learns.",
    note: ["Your way of learning.", "Your next lesson."],
    detail: "Start with a three-minute discovery and a topic.",
    status: "online",
  },
  {
    verb: "Writes.",
    note: ["A lesson, written", "for you alone."],
    detail: "The script bends to your pace, level and attention.",
    status: "writing your lesson",
  },
  {
    verb: "Explains.",
    note: ["A teacher who speaks", "your language."],
    detail: "Narrated, animated video in five languages, with captions.",
    status: "playing · 2:14",
  },
  {
    verb: "Draws.",
    note: ["Written as it", "is spoken."],
    detail: "Terms land on the board the moment the voice reaches them.",
    status: "on the board",
  },
  {
    verb: "Quizzes.",
    note: ["A test that plays", "like a game."],
    detail: "Boss Battle, Knowledge Climb, Constellation and Bloom.",
    status: "quiz in progress",
  },
  {
    verb: "Remembers.",
    note: ["What you'd forget", "comes back."],
    detail: "Missed answers return just before you would lose them.",
    status: "1 review due",
  },
];

const N = STEPS.length;
const ARC_RADIUS = 720;
const ARC_STEP_DEG = 12;
/** Where the active verb's dot sits, in px from the container's left edge. */
const ARC_X = 24;
/** Scroll distance per step, in viewport heights. */
const STEP_VH = 110;
/**
 * Each step's slice of scroll: the screen builds item by item over
 * BUILD_FROM..BUILD_TO, rests complete until HOLD, then cross-fades to the next.
 */
const BUILD_FROM = 0.03;
const BUILD_TO = 0.62;
const HOLD = 0.75;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Scroll progress (0..1) → a continuous step position (0..N-1) with plateaus. */
function toPosition(progress: number) {
  const raw = clamp01(progress) * N;
  const k = Math.min(N - 1, Math.floor(raw));
  if (k === N - 1) return k;
  const t = raw - k;
  return k + smooth(clamp01((t - HOLD) / (1 - HOLD)));
}

/** Opacity of layer i: the old step is gone before the new one appears, so text never overlaps. */
const layerOpacity = (pos: number, i: number) => clamp01(1 - Math.abs(pos - i) * 2.2);

function Layer({
  pos,
  index,
  shift = 18,
  className,
  children,
}: {
  pos: MotionValue<number>;
  index: number;
  shift?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const opacity = useTransform(pos, (p) => layerOpacity(p, index));
  const y = useTransform(pos, (p) => Math.round((index - p) * shift * 10) / 10);
  const visibility = useTransform(opacity, (o) => (o < 0.01 ? "hidden" : "visible"));
  return (
    <motion.div style={{ opacity, y, visibility, gridArea: "1 / 1" }} className={className}>
      {children}
    </motion.div>
  );
}

function ArcVerb({ pos, index, onPick }: { pos: MotionValue<number>; index: number; onPick: (i: number) => void }) {
  const offset = useTransform(pos, (p) => index - p);
  const x = useTransform(offset, (o) => Math.cos((o * ARC_STEP_DEG * Math.PI) / 180) * ARC_RADIUS - ARC_RADIUS + ARC_X);
  const y = useTransform(offset, (o) => Math.sin((o * ARC_STEP_DEG * Math.PI) / 180) * ARC_RADIUS - 22);
  const rotate = useTransform(offset, (o) => o * ARC_STEP_DEG);
  const opacity = useTransform(offset, (o) => {
    const d = Math.abs(o);
    return d <= 1 ? 1 - 0.65 * d : d <= 2 ? 0.35 - 0.21 * (d - 1) : Math.max(0, 0.14 - 0.14 * (d - 2));
  });
  const dot = useTransform(offset, (o) => 4 + 3 * clamp01(1 - Math.abs(o)));
  const dotColor = useTransform(offset, (o) => (Math.abs(o) < 0.5 ? "hsl(var(--mark))" : "hsl(var(--foreground) / 0.3)"));
  return (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={() => onPick(index)}
      className="absolute left-0 top-1/2 flex items-center gap-5 whitespace-nowrap will-change-transform"
      style={{ x, y, rotate, opacity }}
    >
      <motion.span className="block rounded-full" style={{ width: dot, height: dot, backgroundColor: dotColor }} />
      <span className="font-display text-[2.75rem] leading-none tracking-tight">{STEPS[index].verb}</span>
    </motion.button>
  );
}

function VerbArc({ pos, onPick }: { pos: MotionValue<number>; onPick: (i: number) => void }) {
  return (
    <div
      className="absolute inset-y-0 left-0 hidden w-[30%] lg:block"
      // fade the arc out towards the top and bottom so it never crowds the nav
      style={{ maskImage: "linear-gradient(transparent, #000 22%, #000 78%, transparent)" }}
    >
      <div
        aria-hidden
        className="absolute rounded-full border border-dashed border-foreground/15"
        style={{
          width: ARC_RADIUS * 2,
          height: ARC_RADIUS * 2,
          left: ARC_X + 3 - ARC_RADIUS * 2,
          top: `calc(50% - ${ARC_RADIUS}px)`,
        }}
      />
      {STEPS.map((step, i) => (
        <ArcVerb key={step.verb} pos={pos} index={i} onPick={onPick} />
      ))}
    </div>
  );
}

function Notes({ pos, center = false }: { pos: MotionValue<number>; center?: boolean }) {
  return (
    <div className="grid">
      {STEPS.map((step, i) => (
        <Layer key={step.verb} pos={pos} index={i} shift={14} className={center ? "mx-auto max-w-[19rem]" : "max-w-[17rem]"}>
          <p className="font-hand text-[1.6rem] leading-[1.15] text-amber">
            {step.note[0]}
            <br />
            {step.note[1]}
          </p>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{step.detail}</p>
        </Layer>
      ))}
    </div>
  );
}

/** The pen line from the phone's edge to the note. */
function Pointer() {
  return (
    <svg aria-hidden viewBox="0 0 110 56" className="absolute -left-[104px] -top-9 h-[56px] w-[110px]">
      <path d="M108 6 C 66 -2, 26 10, 6 44" fill="none" stroke="hsl(var(--amber))" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 32 L6 45 L18 40" fill="none" stroke="hsl(var(--amber))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One screen, built item by item by scroll within its own step's slice. */
function BuiltScreen({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const build = useTransform(progress, (p) => clamp01((p * N - index - BUILD_FROM) / (BUILD_TO - BUILD_FROM)));
  const Screen = PHONE_SCREENS[index];
  return (
    <BuildProvider value={build}>
      <Screen />
    </BuildProvider>
  );
}

/**
 * All six screens are stacked in the phone and cross-faded by scroll. Each one
 * arrives blank and fills in one item at a time as you keep scrolling.
 */
function PhoneStage({ pos, progress, active }: { pos: MotionValue<number>; progress: MotionValue<number>; active: number }) {
  return (
    <Phone status={STEPS[active].status}>
      <div className="grid h-full">
        {PHONE_SCREENS.map((_, i) => (
          <Layer key={i} pos={pos} index={i} shift={16} className="h-full min-h-0">
            <BuiltScreen progress={progress} index={i} />
          </Layer>
        ))}
      </div>
    </Phone>
  );
}

export function StoryHero() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const pos = useTransform(scrollYProgress, toPosition);

  // The phone settles in as the section arrives, tied to the same scroll.
  const { scrollYProgress: enter } = useScroll({ target: ref, offset: ["start end", "start start"] });
  const stageScale = useTransform(enter, [0, 1], [0.92, 1]);
  const stageOpacity = useTransform(enter, [0, 0.55], [0, 1]);

  useMotionValueEvent(pos, "change", (p) => {
    const next = Math.round(p);
    setActive((c) => (c === next ? c : next));
  });

  /** Scroll to the point where step i is fully built. */
  const pick = (i: number) => {
    const section = ref.current;
    if (!section) return;
    const travel = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY + ((i + (BUILD_TO + HOLD) / 2) / N) * travel;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <section
      ref={ref}
      id="story"
      aria-label="What SMART AI does"
      className="relative scroll-mt-16"
      style={{ height: `calc(${N * STEP_VH}vh + 100svh)` }}
    >
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
        {/* desktop: verbs on the arc, phone dead centre, note to its right */}
        <div className="container relative hidden h-full lg:block">
          <VerbArc pos={pos} onPick={pick} />
          <motion.div
            className="absolute left-1/2 top-1/2 -ml-[136px] -mt-[280px]"
            style={{ scale: stageScale, opacity: stageOpacity }}
          >
            <PhoneStage pos={pos} progress={scrollYProgress} active={active} />
          </motion.div>
          <div className="absolute top-1/2 -translate-y-[60%]" style={{ left: "calc(50% + 196px)" }}>
            <div className="relative">
              <Pointer />
              <Notes pos={pos} />
            </div>
          </div>
        </div>

        {/* small screens: verb, phone, note — stacked */}
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 lg:hidden">
          <div className="grid text-center">
            {STEPS.map((s, i) => (
              <Layer key={s.verb} pos={pos} index={i} shift={10}>
                <p className="font-display text-4xl">{s.verb}</p>
              </Layer>
            ))}
          </div>
          <motion.div
            className="-mb-[123px] origin-top scale-[0.78] sm:-mb-[56px] sm:scale-90"
            style={{ opacity: stageOpacity }}
          >
            <PhoneStage pos={pos} progress={scrollYProgress} active={active} />
          </motion.div>
          <div className="mt-2 w-full text-center">
            <Notes pos={pos} center />
          </div>
        </div>

        {/* step dots — also a way to jump */}
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.verb}
              type="button"
              onClick={() => pick(i)}
              aria-label={`Show step ${i + 1}: ${s.verb.replace(".", "")}`}
              aria-current={i === active ? "step" : undefined}
              className="group grid h-6 place-items-center px-0.5"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === active ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25 group-hover:bg-foreground/50"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
