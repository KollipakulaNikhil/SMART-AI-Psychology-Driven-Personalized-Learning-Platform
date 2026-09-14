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
import { VideoHero } from "./VideoHero";

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
  ["How it works", "#how-it-works"],
  ["Why it's different", "#difference"],
  ["The board", "#board"],
  ["What you get", "#capabilities"],
];

export function Navbar() {
  const { firebaseUser } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  // The hero (`#hero-video` in VideoHero) is permanently dark footage, not a
  // fade-to-light wash — so the header needs light text for as long as any
  // part of it is still behind the header, not just "has the user scrolled
  // at all" (that flips almost immediately, while the hero is still mostly
  // in view).
  const [overHero, setOverHero] = useState(true);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>("");

  // Transparent+light over the hero, frosted+normal once content is behind
  // it — so the bar never floats as a mismatched slab across the footage.
  // Also drives the read progress bar, so one scroll listener does all of it.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      const heroBottom = document.getElementById("hero-video")?.getBoundingClientRect().bottom ?? 0;
      setOverHero(heroBottom > 64); // 64px = header height (h-16)
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
        // While any of the (permanently dark) hero footage is still behind the
        // header, borrow the app's dark palette the same way the hero copy
        // does — same reasoning as the scoped `.dark` in VideoHero.
        overHero && "dark",
        scrolled && !overHero
          ? "border-b border-border bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent"
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

/**
 * Hero is a looping ambient video background (`VideoHero`) with the copy/CTA
 * overlaid on top — simpler than the scroll-scrubbed version it replaced
 * (`ScrollVideoHero`, kept but unused): just plays, no scroll-jacking.
 */
export function Hero() {
  return <VideoHero />;
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

const PIPELINE = [
  {
    icon: BrainCircuit,
    title: "Assessment",
    text: "20 psychology questions — no wrong answers.",
    tone: "bg-violet-100 text-violet-700",
  },
  {
    icon: Compass,
    title: "Learning Profile",
    text: "Style, pace, attention and memory become weighted traits.",
    tone: "bg-indigo-100 text-indigo-700",
  },
  {
    icon: Sparkles,
    title: "AI Script",
    text: "The lesson is authored around that exact profile.",
    tone: "bg-sky-100 text-sky-700",
  },
  {
    icon: PenLine,
    title: "Slides / PPT / PDF",
    text: "Deck, handout and quiz render from the same script.",
    tone: "bg-teal-100 text-teal-700",
  },
  {
    icon: AudioLines,
    title: "Narration",
    text: "Neural voice, your language, matched to your pace.",
    tone: "bg-amber-100 text-amber-700",
  },
  {
    icon: MessageCircleQuestion,
    title: "Interactive Lesson",
    text: "Board, tutor and quiz open the moment it's ready.",
    tone: "bg-rose-100 text-rose-700",
  },
];

/** A flowing highlight sweeping through an otherwise static track — reads as
 *  "things are moving through this pipeline" without looping attention-grabs. */
function FlowTrack({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute overflow-hidden bg-border",
        vertical ? "inset-y-0 left-[27px] w-0.5" : "inset-x-[8.5%] top-[27px] h-0.5"
      )}
    >
      <div
        className={cn(
          "absolute bg-brand-gradient",
          vertical ? "h-1/3 w-full animate-sheen-y" : "h-full w-1/3 animate-sheen"
        )}
      />
    </div>
  );
}

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

        {/* Desktop: a horizontal pipeline with a flowing connector track. */}
        <div className="relative mt-16 hidden lg:grid lg:grid-cols-6 lg:gap-4">
          <FlowTrack />
          {PIPELINE.map((step, index) => (
            <motion.div key={step.title} {...fadeUpAt(index)} className="relative flex flex-col items-center text-center">
              <span
                className={cn(
                  "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-background shadow-soft",
                  step.tone
                )}
              >
                <step.icon className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-semibold">{step.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Mobile/tablet: the same pipeline, stacked with a vertical track. */}
        <div className="relative mt-14 space-y-8 lg:hidden">
          <FlowTrack vertical />
          {PIPELINE.map((step, index) => (
            <motion.div key={step.title} {...fadeUpAt(index)} className="relative flex items-start gap-4 pl-0">
              <span
                className={cn(
                  "relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-4 border-background shadow-soft",
                  step.tone
                )}
              >
                <step.icon className="h-6 w-6" />
              </span>
              <div className="pt-2.5">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
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

const FEATURES = [
  {
    icon: MessageCircleQuestion,
    title: "AI Tutor",
    text: "Click any term on the board and ask — answers are grounded in the exact slide you're on.",
    tone: "bg-indigo-100 text-indigo-700",
  },
  {
    icon: Repeat2,
    title: "Smart Review",
    text: "Every quiz schedules the lesson to return exactly when you're about to forget it.",
    tone: "bg-amber-100 text-amber-700",
  },
  {
    icon: Compass,
    title: "Learning Paths",
    text: "Give it a goal and it plans a sectioned syllabus, generating each module as you unlock it.",
    tone: "bg-violet-100 text-violet-700",
  },
  {
    icon: Languages,
    title: "Multilingual",
    text: "Slides, narration, board and quiz — all translated, with a native neural voice.",
    tone: "bg-teal-100 text-teal-700",
  },
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

        <motion.div {...fadeUp} className="mx-auto mt-14 max-w-5xl">
          <Card>
            <CardContent className="grid gap-8 p-6 sm:p-8 md:grid-cols-2 md:items-center">
              <div>
                <h3 className="text-h3">Your profile moves these dials</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Not cosmetic settings — they change what the model is asked to write.
                </p>
              </div>
              <div className="space-y-4">
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

        <div className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <motion.div key={feature.title} {...fadeUpAt(index)}>
              <Card interactive className="group h-full">
                <CardContent className="p-6">
                  <motion.span
                    whileHover={{ scale: 1.12, rotate: -6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl",
                      feature.tone
                    )}
                  >
                    <feature.icon className="h-5 w-5" />
                  </motion.span>
                  <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                  {feature.title === "Multilingual" && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {LANGUAGES.map((language) => (
                        <Badge key={language} variant="outline" className="px-2 py-0.5 text-[11px]">
                          {language}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} className="mx-auto mt-4 max-w-5xl">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <ListChecks className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold">Yours to keep</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Download the deck as PPTX or PDF, the narration as audio, and the lesson as a
                  subtitled MP4.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
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
          className="grain relative overflow-hidden rounded-[2rem] bg-[#0B0A17] px-6 py-16 text-center shadow-float sm:px-16"
        >
          {/* Echoes the hero's palette and glow, deliberately static and dimmer — a
              second live particle sim here would be needless GPU cost for a moment
              that's meant to read as calmer, not another spectacle. Soft radial
              gradients rather than `blur()` filters: same glow, none of the
              real-time blur compositing cost stacked on top of the grain
              blend-mode + rounded clip this card already carries. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(129,140,248,0.28),transparent_50%),radial-gradient(circle_at_85%_75%,rgba(167,139,250,0.2),transparent_45%),radial-gradient(circle_at_12%_90%,rgba(251,191,36,0.16),transparent_40%)]"
          />
          <div aria-hidden className="absolute inset-0 bg-grid [background-size:48px_48px] opacity-[0.06]" />
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
