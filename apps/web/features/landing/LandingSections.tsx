"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { Circled, PenArrow, PenTick, SectionLabel, Underlined } from "@/components/ui/marks";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { BoardDemo } from "./BoardDemo";
import { LessonVideo } from "./LessonVideo";
import { TryItLive } from "./TryItLive";

/**
 * The home page is laid out like the opening spread of a study guide: a
 * masthead, a contents column, numbered sections separated by rules. Motion is
 * a single short rise on entry — nothing loops, nothing floats.
 */
const rise = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
};

/* ------------------------------------------------------------- contents --- */

const SECTIONS: { number: string; label: string; href: string; note: string }[] = [
  { number: "01", label: "How it works", href: "#how-it-works", note: "Six stages, one topic" },
  { number: "02", label: "Try the dials", href: "#difference", note: "Change the learner" },
  { number: "03", label: "The board", href: "#board", note: "Written as it is spoken" },
  { number: "04", label: "What's inside", href: "#capabilities", note: "The full index" },
];

/* ------------------------------------------------------------------ nav --- */

export function Navbar() {
  const { firebaseUser } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // "You are here": the last section whose top has passed 40% of the way down
  // the viewport. Once the reader is past the final section it stays marked,
  // and above the first one nothing is.
  useEffect(() => {
    const sections = SECTIONS.map(({ href }) => document.querySelector<HTMLElement>(href)).filter(
      (element): element is HTMLElement => Boolean(element)
    );
    if (sections.length === 0) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let current = "";
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = `#${section.id}`;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b bg-background transition-colors duration-200",
        scrolled ? "border-foreground" : "border-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-2 sm:gap-4">
        <Logo />
        <nav aria-label="Sections" className="hidden items-center gap-7 lg:flex">
          {SECTIONS.map(({ number, label, href }) => {
            const active = activeId === href;
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group flex h-11 items-center gap-2 text-sm transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("font-mono text-[11px]", active ? "text-primary" : "text-muted-foreground")}>
                  {number}
                </span>
                <span
                  className={cn(
                    "border-b py-0.5 transition-colors",
                    active ? "border-primary" : "border-transparent group-hover:border-foreground/50"
                  )}
                >
                  {label}
                </span>
              </a>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <ThemeToggle />
          {!firebaseUser && (
            <Link
              href="/login"
              className="flex h-11 items-center px-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          )}
          <Link
            href={firebaseUser ? "/dashboard" : "/login"}
            className={cn(buttonVariants({ variant: "gradient", size: "sm" }), "h-11 px-3.5 sm:px-4")}
          >
            <span className="sm:hidden">{firebaseUser ? "Dashboard" : "Start"}</span>
            <span className="hidden sm:inline">{firebaseUser ? "Open dashboard" : "Get started"}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------- hero --- */

const FACTS: { value: string; unit: string; label: string }[] = [
  { value: "3", unit: "min", label: "to find out how you learn" },
  { value: "6", unit: "", label: "short activities, no wrong answers" },
  { value: "5", unit: "", label: "languages, written and spoken" },
  { value: "4", unit: "", label: "quiz games to finish a lesson" },
];

export function Hero() {
  return (
    <section className="pt-16">
      {/* masthead line */}
      <div className="border-b border-foreground/20">
        <div className="container flex items-center justify-between gap-4 py-2.5">
          <p className="label-mono">A learning notebook</p>
          <p className="label-mono hidden sm:inline-flex" lang="mul">
            English · हिन्दी · తెలుగు · தமிழ் · Español
          </p>
        </div>
      </div>

      <div className="container">
        <div className="grid gap-x-10 gap-y-12 pb-14 pt-12 sm:pt-16 lg:grid-cols-12 lg:pb-20 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0 lg:col-span-8"
          >
            <h1 className="text-display text-balance">
              Every lesson, written for the way{" "}
              <Circled>
                <em>you</em>
              </Circled>{" "}
              learn.
            </h1>
            <p className="text-lead mt-8 max-w-[38rem]">
              SMART AI spends three minutes finding out how you take things in. Then it writes
              each lesson for you — a narrated, animated video with a teacher on screen, a board
              you can click, and a quiz that plays like a game.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link href="/login" className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "group")}>
                Start the 3-minute discovery
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
              </Link>
              <a href="#exhibit" className="link-ink inline-flex h-11 items-center gap-1.5 text-[15px] font-medium">
                Watch a real lesson <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </motion.div>

          {/* contents — the margin column */}
          <motion.nav
            aria-label="Contents"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="min-w-0 lg:col-span-4 lg:border-l lg:border-foreground/20 lg:pl-8"
          >
            <p className="label-mono">Contents</p>
            <ol className="mt-3 border-t border-foreground">
              {SECTIONS.map(({ number, label, href, note }) => (
                <li key={href} className="border-b border-foreground/20">
                  <a href={href} className="group flex min-h-[3.25rem] items-baseline gap-3 py-3">
                    <span className="font-mono text-xs text-primary">{number}</span>
                    <span className="font-display text-lg leading-tight group-hover:italic">{label}</span>
                    <span
                      aria-hidden
                      className="mx-1 hidden flex-1 translate-y-[-3px] border-b border-dotted border-foreground/35 sm:block"
                    />
                    <span className="ml-auto text-right text-xs text-muted-foreground sm:ml-0">{note}</span>
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Free to start. It is not a survey — the discovery is six small things to try.
            </p>
          </motion.nav>
        </div>
      </div>

      {/* the facts, as a ruled row of figures */}
      <div className="border-y border-foreground">
        <dl className="container grid grid-cols-2 lg:grid-cols-4">
          {FACTS.map(({ value, unit, label }, index) => (
            <div
              key={label}
              className={cn(
                "flex items-baseline gap-3 py-5 sm:py-6",
                index % 2 === 1 && "border-l border-foreground/20 pl-4 sm:pl-6",
                index >= 2 && "border-t border-foreground/20 lg:border-t-0",
                index === 2 && "lg:border-l lg:border-foreground/20 lg:pl-6"
              )}
            >
              <dd className="nums font-display text-4xl leading-none text-mark sm:text-5xl">
                {value}
                {unit && <span className="ml-1 font-mono text-xs uppercase tracking-wider">{unit}</span>}
              </dd>
              <dt className="max-w-[14ch] text-[13px] leading-snug text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* exhibit: the real lesson video */}
      <div id="exhibit" className="container scroll-mt-20 py-14 sm:py-20">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
          <motion.div {...rise} className="min-w-0 lg:col-span-9">
            <LessonVideo />
          </motion.div>
          <motion.aside {...rise} className="min-w-0 lg:col-span-3 lg:pt-10">
            <PenArrow className="hidden lg:block" />
            <p className="font-hand text-xl leading-snug text-primary lg:mt-2 lg:-rotate-1">
              Nobody edited this. One line went in — “Introduction to Photosynthesis” — and this
              came out.
            </p>
            <dl className="mt-6 border-t border-foreground text-sm">
              {[
                ["Input", "One topic line"],
                ["Teacher", "Animated, on screen"],
                ["Narration", "Neural voice, captioned"],
                ["Also made", "Board, slides, quiz"],
              ].map(([term, detail]) => (
                <div key={term} className="flex justify-between gap-4 border-b border-foreground/20 py-2.5">
                  <dt className="label-mono">{term}</dt>
                  <dd className="text-right">{detail}</dd>
                </div>
              ))}
            </dl>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- how it works --- */

const PIPELINE: { title: string; text: string; output: string }[] = [
  {
    title: "Discovery",
    text: "Six short activities, about three minutes. You try things; nothing is marked right or wrong.",
    output: "You, observed",
  },
  {
    title: "Learning profile",
    text: "How you take things in, your pace, your attention and what you already know become weighted traits.",
    output: "A profile",
  },
  {
    title: "The script",
    text: "You name a topic — or upload a PDF — and the lesson is written around that exact profile.",
    output: "A lesson plan",
  },
  {
    title: "Animated video",
    text: "A teacher on screen, animated scenes and narration in your language, at your speed.",
    output: "Video + captions",
  },
  {
    title: "Board, slides, handout",
    text: "The same script becomes an interactive board, a slide deck and a handout you can keep.",
    output: "Board · PPTX · PDF",
  },
  {
    title: "Quiz and review",
    text: "Finish with a quiz game. What you miss is scheduled to come back just before you would forget it.",
    output: "A review date",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-foreground py-16 sm:py-24">
      <div className="container grid gap-x-10 gap-y-10 lg:grid-cols-12">
        <motion.div {...rise} className="min-w-0 lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <SectionLabel number="01">How it works</SectionLabel>
            <h2 className="text-h2 mt-5 text-balance">
              One topic in. <em>Your</em> lesson out.
            </h2>
            <p className="text-lead mt-5">
              Six stages, fully automated. Every one of them is bent by what the discovery learned
              about you.
            </p>
          </div>
        </motion.div>

        <ol className="min-w-0 border-t border-foreground lg:col-span-8">
          {PIPELINE.map((step, index) => (
            <motion.li
              key={step.title}
              {...rise}
              className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-foreground/20 py-6 sm:grid-cols-[3.5rem_1fr_11rem] sm:gap-x-6 sm:py-7"
            >
              <span className="nums pt-1 font-mono text-sm text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-h3">{step.title}</h3>
                <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
              <p className="label-mono col-start-2 mt-3 sm:col-start-3 sm:mt-1.5 sm:justify-end sm:text-right">
                <span aria-hidden>→</span> {step.output}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- difference --- */

export function Difference() {
  return (
    <section id="difference" className="border-y border-foreground bg-elevated py-16 sm:py-24">
      <div className="container">
        <motion.div {...rise} className="grid gap-x-10 gap-y-6 lg:grid-cols-12 lg:items-end">
          <div className="min-w-0 lg:col-span-8">
            <SectionLabel number="02">Try the dials</SectionLabel>
            <h2 className="text-h2 mt-5 text-balance">
              One topic. Any mind. <em>A different lesson each time.</em>
            </h2>
          </div>
          <p className="text-lead lg:col-span-4">
            Most tools hand everyone the same answer. Move the dials and watch the plan rewrite
            itself — it is the same logic that runs on a real profile.
          </p>
        </motion.div>

        <motion.div {...rise} className="mt-12">
          <TryItLive />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ the board --- */

export function BoardSection() {
  return (
    <section id="board" className="py-16 sm:py-24">
      <div className="container grid items-start gap-x-10 gap-y-12 lg:grid-cols-12">
        <motion.div {...rise} className="min-w-0 lg:col-span-5">
          <SectionLabel number="03">The board</SectionLabel>
          <h2 className="text-h2 mt-5 text-balance">
            Written as it is <Underlined><em>spoken</em></Underlined>.
          </h2>
          <p className="text-lead mt-6">
            Most generated lessons are slides that fade in on a timer. This one listens to the
            narration: each term is chalked up at the moment the voice reaches it, and diagrams
            are drawn stroke by stroke while they are explained.
          </p>
          <ul className="mt-8 border-t border-foreground">
            {[
              "Terms appear on the narrator's word, not on a countdown",
              "Diagrams draw themselves as the process is described",
              "Click anything on the board to ask the tutor about it",
              "Hear it in your language, keep the exam terms in English",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 border-b border-foreground/20 py-3.5 text-[15px]">
                <PenTick className="mt-1 shrink-0 text-accent" />
                {line}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.figure {...rise} className="min-w-0 lg:col-span-7">
          <BoardDemo />
          <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="label-mono">
              <span className="text-primary">Fig. 2</span> The board, live
            </span>
            <span className="text-sm text-muted-foreground">
              Switch the voice. It is running in your browser, not a recording.
            </span>
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- capabilities --- */

const LANGUAGES = ["English", "हिन्दी", "తెలుగు", "தமிழ்", "Español"];

const KNOBS: { label: string; from: string; to: string }[] = [
  { label: "Slide density", from: "6 slides", to: "16 slides" },
  { label: "Lesson length", from: "3 min", to: "30 min" },
  { label: "Narration speed", from: "0.9×", to: "1.1×" },
  { label: "Analogy style", from: "Everyday", to: "Formal" },
];

const INDEX: { title: string; text: string }[] = [
  {
    title: "AI tutor",
    text: "Click any term on the board and ask. Answers are grounded in the exact slide you are on.",
  },
  {
    title: "Smart review",
    text: "Every quiz schedules the lesson to return when you are about to forget it — spaced repetition, done for you.",
  },
  {
    title: "Learning paths",
    text: "Give it a goal and it plans a sectioned syllabus, writing each module as you unlock it.",
  },
  {
    title: "Quiz games",
    text: "Boss Battle, Knowledge Climb, Constellation and Bloom: four ways to be tested that do not feel like a test.",
  },
  {
    title: "Teach from your PDF",
    text: "Upload your notes or a chapter and the lesson is built from that material.",
  },
  {
    title: "Research Lab",
    text: "Describe an idea; it finds sources, captures the pages and drafts directions worth exploring.",
  },
  {
    title: "Yours to keep",
    text: "Download the deck as PPTX or PDF, the narration as audio, and the lesson as a subtitled MP4.",
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="border-t border-foreground py-16 sm:py-24">
      <div className="container">
        <motion.div {...rise} className="max-w-3xl">
          <SectionLabel number="04">What&apos;s inside</SectionLabel>
          <h2 className="text-h2 mt-5 text-balance">
            Not a chatbot. A <em>study</em> you can walk into.
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-x-10 gap-y-12 lg:grid-cols-12">
          {/* the index — a ruled list, not a card grid */}
          <dl className="min-w-0 border-t border-foreground lg:col-span-8">
            {INDEX.map((entry, index) => (
              <motion.div
                key={entry.title}
                {...rise}
                className="grid gap-x-6 gap-y-1 border-b border-foreground/20 py-5 sm:grid-cols-[2.5rem_13rem_1fr]"
              >
                <span className="nums hidden pt-1 font-mono text-xs text-muted-foreground sm:block">
                  {String.fromCharCode(97 + index)}.
                </span>
                <dt className="font-display text-xl leading-snug">{entry.title}</dt>
                <dd className="text-[15px] leading-relaxed text-muted-foreground">{entry.text}</dd>
              </motion.div>
            ))}
          </dl>

          {/* margin: two small reference tables */}
          <motion.aside {...rise} className="min-w-0 space-y-10 lg:col-span-4">
            <div>
              <p className="label-mono">Table 1 · What your profile changes</p>
              <table className="mt-3 w-full border-t border-foreground text-sm">
                <tbody>
                  {KNOBS.map(({ label, from, to }) => (
                    <tr key={label} className="border-b border-foreground/20">
                      <th scope="row" className="py-3 pr-3 text-left font-medium">
                        {label}
                      </th>
                      <td className="nums whitespace-nowrap py-3 text-right font-mono text-xs text-muted-foreground">
                        {from} <span className="text-primary">→</span> {to}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Not cosmetic settings. They change what the model is asked to write.
              </p>
            </div>

            <div>
              <p className="label-mono">Table 2 · Languages</p>
              <ul className="mt-3 border-t border-foreground">
                {LANGUAGES.map((language) => (
                  <li
                    key={language}
                    className="flex items-baseline justify-between border-b border-foreground/20 py-2.5"
                  >
                    <span className="font-display text-lg">{language}</span>
                    <span className="label-mono">voice + board</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ cta --- */

export function FinalCta() {
  return (
    <section className="border-t border-foreground">
      <div className="container">
        {/* A notebook page: ruled lines and one red margin. Each block of type
            sits on its own patch of clean paper, so no rule ever crosses a word. */}
        <motion.div
          {...rise}
          className="ruled relative py-16 pl-8 sm:py-24 sm:pl-20"
          style={{ ["--rule-gap" as string]: "2.75rem" }}
        >
          <span aria-hidden className="absolute inset-y-0 left-3 w-px bg-mark/70 sm:left-12" />
          <p className="paper label-mono py-1 pr-2">Your first page</p>
          <h2 className="paper text-display mt-5 w-fit max-w-4xl py-2 pr-3 text-balance">
            Three minutes of discovery. Then lessons that finally <Underlined><em>fit</em></Underlined>.
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link href="/login" className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "group")}>
              Start free
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
            </Link>
            <span className="paper px-2 py-1.5 text-sm text-muted-foreground">Sign in with Google or email.</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t-2 border-foreground pb-10 pt-12">
      <div className="container grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            A personal learning notebook. It works out how you learn, then writes the lesson.
          </p>
        </div>

        <nav aria-label="Footer contents" className="min-w-0 lg:col-span-4">
          <p className="label-mono">Contents</p>
          <ul className="mt-3 border-t border-foreground/20 text-sm">
            {SECTIONS.map(({ number, label, href }) => (
              <li key={href} className="border-b border-foreground/20">
                <a href={href} className="group flex min-h-11 items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">{number}</span>
                  <span className="group-hover:text-primary">{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account" className="min-w-0 lg:col-span-3">
          <p className="label-mono">Begin</p>
          <ul className="mt-3 border-t border-foreground/20 text-sm">
            {[
              ["Sign in", "/login"],
              ["Start the discovery", "/login"],
            ].map(([label, href]) => (
              <li key={label} className="border-b border-foreground/20">
                <Link href={href} className="group flex min-h-11 items-center justify-between gap-3">
                  <span className="group-hover:text-primary">{label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="container mt-12 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono uppercase tracking-[0.12em]">© {new Date().getFullYear()} SMART AI</p>
        <p>Set in Fraunces, Hanken Grotesk and JetBrains Mono.</p>
      </div>
    </footer>
  );
}
