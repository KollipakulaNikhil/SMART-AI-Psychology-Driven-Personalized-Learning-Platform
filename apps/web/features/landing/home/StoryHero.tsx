"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Phone, PHONE_SCREENS } from "./PhoneScreens";

/**
 * The story after the hero. The section is several screens tall; its inner
 * stage is sticky, and how far you have scrolled through picks the step. The
 * verbs ride a large arc on the left, the phone (dead centre) shows that step,
 * and a handwritten margin note explains it.
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

const ARC_RADIUS = 720;
const ARC_STEP_DEG = 12;
/** Where the active verb's dot sits, in px from the container's left edge. */
const ARC_X = 24;
/** Scroll distance per step, in viewport heights. */
const STEP_VH = 55;

function VerbArc({ active, onPick }: { active: number; onPick: (i: number) => void }) {
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
      {STEPS.map((step, i) => {
        const offset = i - active;
        const angle = (offset * ARC_STEP_DEG * Math.PI) / 180;
        const x = Math.cos(angle) * ARC_RADIUS - ARC_RADIUS + ARC_X;
        const y = Math.sin(angle) * ARC_RADIUS;
        const distance = Math.abs(offset);
        return (
          <motion.button
            key={step.verb}
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => onPick(i)}
            className="absolute left-0 top-1/2 flex items-center gap-5 whitespace-nowrap"
            initial={false}
            animate={{
              x: Math.round(x),
              y: Math.round(y - 22),
              rotate: offset * ARC_STEP_DEG,
              opacity: distance === 0 ? 1 : distance === 1 ? 0.35 : distance === 2 ? 0.14 : 0,
            }}
            transition={{ type: "spring", stiffness: 90, damping: 20, mass: 0.9 }}
          >
            <motion.span
              className="block rounded-full"
              initial={false}
              animate={{
                width: distance === 0 ? 7 : 4,
                height: distance === 0 ? 7 : 4,
                backgroundColor: distance === 0 ? "hsl(var(--mark))" : "hsl(var(--foreground) / 0.3)",
              }}
            />
            <span className="font-display text-[2.75rem] leading-none tracking-tight">{step.verb}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function MarginNote({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step.verb}
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-[17rem]"
      >
        <p className="font-hand text-[1.6rem] leading-[1.15] text-amber">
          {step.note[0]}
          <br />
          {step.note[1]}
        </p>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{step.detail}</p>
      </motion.div>
    </AnimatePresence>
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

function PhoneStage({ active, step }: { active: number; step: (typeof STEPS)[number] }) {
  const Screen = PHONE_SCREENS[active];
  return (
    <Phone status={step.status}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          className="h-full"
          initial={{ opacity: 0, y: 14, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Screen />
        </motion.div>
      </AnimatePresence>
    </Phone>
  );
}

export function StoryHero() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const next = Math.min(STEPS.length - 1, Math.max(0, Math.floor(progress * STEPS.length)));
    setActive((current) => (current === next ? current : next));
  });

  /** Scroll to the middle of step i's slice of the section. */
  const pick = (i: number) => {
    const section = ref.current;
    if (!section) return;
    const travel = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY + ((i + 0.5) / STEPS.length) * travel;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const step = STEPS[active];

  return (
    <section
      ref={ref}
      id="story"
      aria-label="What SMART AI does"
      className="relative scroll-mt-16"
      style={{ height: `calc(${STEPS.length * STEP_VH}vh + 100svh)` }}
    >
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
        {/* desktop: verbs on the arc, phone dead centre, note to its right */}
        <div className="container relative hidden h-full lg:block">
          <VerbArc active={active} onPick={pick} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <PhoneStage active={active} step={step} />
          </div>
          <div className="absolute top-1/2 -translate-y-[60%]" style={{ left: "calc(50% + 196px)" }}>
            <div className="relative">
              <Pointer />
              <MarginNote step={step} />
            </div>
          </div>
        </div>

        {/* small screens: verb, phone, note — stacked */}
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 lg:hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={step.verb}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="font-display text-4xl"
            >
              {step.verb}
            </motion.p>
          </AnimatePresence>
          <div className="-mb-[123px] origin-top scale-[0.78] sm:-mb-[56px] sm:scale-90">
            <PhoneStage active={active} step={step} />
          </div>
          <div className="mt-2 text-center">
            <MarginNote step={step} />
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
