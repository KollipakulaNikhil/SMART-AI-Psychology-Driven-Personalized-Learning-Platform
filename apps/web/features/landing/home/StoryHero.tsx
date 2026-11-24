"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Phone, PHONE_SCREENS } from "./PhoneScreens";

/**
 * The opening story. The section is several screens tall; its inner stage is
 * sticky, and how far you have scrolled through picks the step. The verbs
 * ride a large arc on the left, the phone shows that step, and a handwritten
 * margin note explains it.
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

const ARC_RADIUS = 760;
const ARC_STEP_DEG = 11;
/** Where the active verb's dot sits, in px from the left edge. */
const ARC_X = 130;

function VerbArc({ active }: { active: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[34%] lg:block">
      {/* the dashed arc itself */}
      {/* centre sits ARC_RADIUS left of the active verb, so the arc runs through every verb's dot */}
      <div
        className="absolute rounded-full border border-dashed border-foreground/20"
        style={{
          width: ARC_RADIUS * 2,
          height: ARC_RADIUS * 2,
          left: ARC_X + 2 - ARC_RADIUS * 2,
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
          <motion.div
            key={step.verb}
            className="absolute left-0 top-1/2 flex items-center gap-5 whitespace-nowrap"
            initial={false}
            animate={{
              x: Math.round(x),
              y: Math.round(y - 24),
              rotate: offset * ARC_STEP_DEG,
              opacity: distance === 0 ? 1 : distance === 1 ? 0.42 : distance === 2 ? 0.2 : 0,
            }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          >
            <span className={distance === 0 ? "h-1.5 w-1.5 bg-mark" : "h-1 w-1 bg-foreground/30"} />
            <span className="font-display text-[2.6rem] leading-none tracking-tight">{step.verb}</span>
          </motion.div>
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="max-w-[16rem]"
      >
        <p className="font-hand text-[1.55rem] leading-[1.15] text-amber">
          {step.note[0]}
          <br />
          {step.note[1]}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{step.detail}</p>
      </motion.div>
    </AnimatePresence>
  );
}

/** The pen line from the phone's edge to the note. */
function Pointer() {
  return (
    <svg aria-hidden viewBox="0 0 120 60" className="absolute -left-[118px] -top-8 hidden h-[60px] w-[120px] lg:block">
      <path d="M118 8 C 70 0, 30 10, 6 46" fill="none" stroke="hsl(var(--amber))" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 34 L6 47 L18 42" fill="none" stroke="hsl(var(--amber))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StoryHero() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const next = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length));
    setActive((current) => (current === next ? current : next));
  });

  const step = STEPS[active];
  const Screen = PHONE_SCREENS[active];

  return (
    <section ref={ref} id="story" aria-label="What SMART AI does" style={{ height: `${STEPS.length * 70 + 40}vh` }}>
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
        <h1 className="sr-only">SMART AI learns how you learn, then writes, explains, draws, quizzes and remembers.</h1>
        <VerbArc active={active} />

        <div className="container relative grid h-full items-center gap-6 lg:grid-cols-[34%_auto_1fr]">
          <div className="hidden lg:block" />

          {/* small screens: the current verb sits above the phone */}
          <div className="flex flex-col items-center gap-4 pt-6 lg:hidden">
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
          </div>

          <div className="flex justify-center">
            <div className="-mb-[123px] origin-top scale-[0.78] sm:-mb-[56px] sm:scale-90 lg:mb-0 lg:scale-100">
              <Phone status={step.status}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    className="h-full"
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(4px)" }}
                    transition={{ duration: 0.25 }}
                  >
                    <Screen />
                  </motion.div>
                </AnimatePresence>
              </Phone>
            </div>
          </div>

          <div className="relative flex justify-center pb-10 text-center lg:block lg:pb-0 lg:pl-28 lg:text-left">
            <div className="relative">
              <Pointer />
              <MarginNote step={step} />
            </div>
          </div>
        </div>

        {/* step dots */}
        <ol aria-hidden className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-1.5">
          {STEPS.map((s, i) => (
            <li
              key={s.verb}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-5 bg-foreground" : "w-1.5 bg-foreground/25"}`}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
