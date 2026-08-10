"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  BrainCircuit,
  Check,
  Clock3,
  Compass,
  Gauge,
  Languages,
  ListChecks,
  MessageCircleQuestion,
  PenLine,
  Repeat2,
  Sparkles,
  Type,
} from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { BoardDemo } from "./BoardDemo";
import { TryItLive } from "./TryItLive";
import { LessonVideo } from "./LessonVideo";

/**
 * Reveal-on-scroll, tuned to be felt but never waited for. `margin: "-40px"`
 * fires a little BEFORE an element reaches the viewport: with the old -80px,
 * fast scrolling outran the trigger and left visibly blank stretches of page.
 */
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

/** Staggered variant for lists — index-delayed rather than hand-tuned per item. */
const fadeUpAt = (index: number) => ({
  ...fadeUp,
  transition: { ...fadeUp.transition, delay: Math.min(index * 0.06, 0.4) },
});

/* ------------------------------------------------------------------ nav --- */

const NAV_LINKS: [label: string, href: string][] = [
  ["Why it's different", "#difference"],
  ["The board", "#board"],
  ["How it works", "#how-it-works"],
  ["What you get", "#capabilities"],
];

export function Navbar() {
  const { firebaseUser } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>("");

  // Transparent over the hero, frosted once content is behind it — so the bar
  // never floats as a solid slab across the artwork. Also drives the read
  // progress bar, so one scroll listener does all of it.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(100, (y / scrollable) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight whichever section the reader is actually in. An observer beats
  // measuring offsets on every scroll frame, and it stays correct when the
  // sections resize.
  useEffect(() => {
    const sections = NAV_LINKS.map(([, href]) => document.querySelector(href)).filter(
      (element): element is Element => Boolean(element)
    );
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(`#${visible.target.id}`);
      },
      // Bias the band toward the upper half so a section counts as "current"
      // once its heading is comfortably on screen.
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.6] }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-border bg-background/80 backdrop-blur-xl" : "border-b border-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm lg:flex">
          {NAV_LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className={cn(
                "relative rounded-lg px-3 py-2 transition-colors",
                activeId === href ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {activeId === href && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-muted"
                />
              )}
              <span className="relative">{label}</span>
            </a>
          ))}
        </nav>
        <Link
          href={firebaseUser ? "/dashboard" : "/login"}
          className={cn(buttonVariants({ variant: "gradient", size: "sm" }), "shrink-0")}
        >
          {firebaseUser ? "Open dashboard" : "Get started"}
        </Link>
      </div>

      {/* Read progress — a quiet cue that the page has a length and an end. */}
      <div
        aria-hidden
        className="h-0.5 origin-left bg-brand-gradient transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </header>
  );
}

/* ----------------------------------------------------------------- hero --- */

/** Soft colour behind the hero — the "mixed light" wash, in pure CSS. */
function HeroWash() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 left-1/2 h-[30rem] w-[70rem] max-w-none -translate-x-1/2 rounded-full bg-primary/[0.13] blur-[110px] animate-float" />
      <div className="absolute -top-16 right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-secondary/[0.13] blur-[100px] animate-float [animation-delay:-5s]" />
      <div className="absolute left-[-6rem] top-64 h-[22rem] w-[22rem] rounded-full bg-accent/[0.10] blur-[100px] animate-float [animation-delay:-9s]" />
      <div className="absolute right-[12%] top-[26rem] h-[18rem] w-[18rem] rounded-full bg-amber-300/25 blur-[110px] animate-float [animation-delay:-3s]" />
      <div className="absolute inset-x-0 top-0 h-[42rem] bg-grid [background-size:64px_64px] opacity-40 mask-fade-b" />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pt-36">
      <HeroWash />

      <div className="container relative">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div {...fadeUp}>
            <Badge
              variant="outline"
              className="border-border bg-card px-3.5 py-1.5 text-[13px] text-foreground shadow-soft"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Psychology-driven learning
            </Badge>
          </motion.div>

          <motion.h1 {...fadeUpAt(1)} className="text-display mt-6">
            The tutor that learns{" "}
            <span className="text-gradient">how you learn</span> first
          </motion.h1>

          <motion.p {...fadeUpAt(2)} className="text-lead mx-auto mt-6 max-w-2xl">
            A 20-question assessment maps your attention span, pace and memory style.
            Then every lesson is written, drawn, narrated and quizzed for that profile.
          </motion.p>

          <motion.div
            {...fadeUpAt(3)}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "group w-full sm:w-auto")}
            >
              Map my learning style
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}
            >
              See how it works
            </a>
          </motion.div>

          <motion.ul
            {...fadeUpAt(4)}
            className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {["Free to start", "5 languages", "No credit card"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-accent" />
                {item}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* the product, playing */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-16 max-w-5xl"
        >
          <LessonVideo />
        </motion.div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- difference --- */

export function Difference() {
  return (
    <section id="difference" className="wash-lilac py-20 sm:py-24">
      <div className="container">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">The difference</span>
          <h2 className="text-h2 mt-4">
            One topic. Any mind.{" "}
            <span className="text-gradient">A different lesson each time.</span>
          </h2>
          <p className="text-lead mt-4">
            Generic AI hands everyone the same answer. Move the dials below and watch the
            lesson rebuild itself — this is the same logic that runs on a real profile.
          </p>
        </motion.div>

        <motion.div {...fadeUp} className="mx-auto mt-12 max-w-5xl">
          <TryItLive />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ the board --- */

export function BoardSection() {
  return (
    <section id="board" className="py-20 sm:py-24">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <motion.div {...fadeUp}>
            <span className="eyebrow">The board</span>
            <h2 className="text-h2 mt-4">
              Written as it's <span className="text-gradient">spoken</span>
            </h2>
            <p className="text-lead mt-5">
              Most AI lessons are slides that fade in on a timer. Ours listens to the
              narration: every term is written at the exact moment the voice reaches it,
              and diagrams are drawn stroke by stroke while they're explained.
            </p>
            <ul className="mt-7 space-y-3.5">
              {[
                "Terms appear on the narrator's word, not on a countdown",
                "Diagrams draw themselves as the process is described",
                "Click anything on the board to ask the tutor about it",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Check className="h-3 w-3 text-accent" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div {...fadeUpAt(1)}>
            <BoardDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- how it works --- */

const STEPS = [
  {
    icon: BrainCircuit,
    title: "Map your mind",
    text: "A 20-question psychology assessment builds your profile: style, attention, pace, memory strategy, confidence.",
    tone: "bg-violet-100 text-violet-700",
  },
  {
    icon: Sparkles,
    title: "Ask for any topic",
    text: "The lesson is written around that profile — bullet density, analogies, terminology and depth all shift.",
    tone: "bg-indigo-100 text-indigo-700",
  },
  {
    icon: PenLine,
    title: "Watch it written",
    text: "An interactive board writes each term at the moment it is spoken, with diagrams drawn stroke by stroke.",
    tone: "bg-sky-100 text-sky-700",
  },
  {
    icon: AudioLines,
    title: "Hear it your way",
    text: "Neural narration in your language, at a speed matched to your pace — free, with no quota to run out.",
    tone: "bg-teal-100 text-teal-700",
  },
  {
    icon: MessageCircleQuestion,
    title: "Ask mid-lesson",
    text: "Click any term on the board and the tutor answers, grounded in the slide you are looking at right now.",
    tone: "bg-amber-100 text-amber-700",
  },
  {
    icon: Repeat2,
    title: "Actually remember it",
    text: "Quizzes size themselves to your revision habits, then spaced review brings each lesson back before you forget.",
    tone: "bg-rose-100 text-rose-700",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="wash-mint py-20 sm:py-24">
      <div className="container">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="text-h2 mt-4">One topic in. Your lesson out.</h2>
          <p className="text-lead mt-4">
            Six stages, fully automated — every one of them bent by your learning profile.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.div key={step.title} {...fadeUpAt(index)}>
              <Card interactive className="h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        step.tone
                      )}
                    >
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-2xl font-bold text-foreground/10">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- capabilities --- */

const LANGUAGES = ["English", "हिन्दी", "తెలుగు", "தமிழ்", "Español"];

const KNOBS = [
  { icon: Type, label: "Slide density", from: "6 slides", to: "16 slides", fill: "w-2/3" },
  { icon: Clock3, label: "Lesson length", from: "3 min", to: "30 min", fill: "w-1/2" },
  { icon: Gauge, label: "Narration speed", from: "0.9×", to: "1.1×", fill: "w-3/4" },
  { icon: Compass, label: "Analogy style", from: "Everyday", to: "Formal", fill: "w-2/5" },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="py-20 sm:py-24">
      <div className="container">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">What you get</span>
          <h2 className="text-h2 mt-4">
            Not a chatbot. A <span className="text-gradient">learning engine</span>.
          </h2>
          <p className="text-lead mt-4">
            Every knob of the lesson is tuned to the psychology of the person asking.
          </p>
        </motion.div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
          <motion.div {...fadeUp} className="md:col-span-2">
            <Card className="h-full">
              <CardContent className="p-6 sm:p-7">
                <h3 className="text-h3">Your profile moves these dials</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Not cosmetic settings — they change what the model is asked to write.
                </p>
                <div className="mt-6 space-y-4">
                  {KNOBS.map(({ icon: Icon, label, from, to, fill }) => (
                    <div key={label} className="flex items-center gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-accent">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium">{label}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {from} → {to}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full bg-brand-gradient", fill)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeUpAt(1)}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col p-6 sm:p-7">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <Languages className="h-5 w-5" />
                </span>
                <h3 className="text-h3 mt-4">Taught in your language</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Slides, narration, board and quiz — all translated, with a native neural voice.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {LANGUAGES.map((language) => (
                    <Badge key={language} variant="outline" className="px-2.5 py-1 text-[13px]">
                      {language}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {[
            {
              icon: Compass,
              title: "Learning paths",
              text: "Give it a goal and it plans a sectioned syllabus, then generates each module as you unlock it.",
              tone: "bg-indigo-100 text-indigo-700",
            },
            {
              icon: Repeat2,
              title: "Spaced review",
              text: "Every quiz schedules the lesson to return exactly when you're about to forget it.",
              tone: "bg-amber-100 text-amber-700",
            },
            {
              icon: ListChecks,
              title: "Yours to keep",
              text: "Download the deck as PPTX or PDF, the narration as audio, and the lesson as a subtitled MP4.",
              tone: "bg-rose-100 text-rose-700",
            },
          ].map((feature, index) => (
            <motion.div key={feature.title} {...fadeUpAt(index + 2)}>
              <Card interactive className="h-full">
                <CardContent className="p-6">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      feature.tone
                    )}
                  >
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ cta --- */

export function FinalCta() {
  return (
    <section className="pb-20 pt-2 sm:pb-24">
      <div className="container">
        <motion.div
          {...fadeUp}
          className="grain relative overflow-hidden rounded-[2rem] bg-brand-gradient px-6 py-16 text-center shadow-float sm:px-16"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.28),transparent_55%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_78%_88%,rgba(0,0,0,0.22),transparent_55%)]"
          />
          <h2 className="text-h2 relative text-white">
            Learn your next topic the way your brain prefers
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/90">
            Two minutes of questions. Then lessons that finally fit.
          </p>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "group relative mt-9 bg-white text-slate-900 shadow-xl hover:bg-white"
            )}
          >
            Start free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="container flex flex-col items-center justify-between gap-5 sm:flex-row">
        <Logo />
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#capabilities" className="transition-colors hover:text-foreground">
            Features
          </a>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} SMART AI</p>
      </div>
    </footer>
  );
}
