"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, FileText, Plus, Sparkles, Waypoints, X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ nav --- */

const NAV: [string, string][] = [
  ["How it works", "#story"],
  ["Lessons", "#more"],
  ["FAQ", "#faq"],
];

/** Dark pill with the small up-right arrow — the one primary action. */
export function PillLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13.5px] font-semibold text-background",
        "transition-[transform,background-color] duration-150 hover:bg-foreground/90 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {children}
      <ArrowUpRight
        className="h-3.5 w-3.5 text-amber transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-background/70"
        aria-hidden
      />
    </Link>
  );
}

export function SiteNav() {
  const { firebaseUser } = useAuth();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-foreground/10 bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-3">
          <ThemeToggle />
          {!firebaseUser && (
            <Link href="/login" className="hidden h-10 items-center px-2 text-sm font-medium sm:flex">
              Log in
            </Link>
          )}
          <PillLink href={firebaseUser ? "/dashboard" : "/login"}>
            {firebaseUser ? "Open dashboard" : "Start learning"}
          </PillLink>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------- more than a … --- */

const CARDS: { title: string; detail: string; icon: typeof Sparkles; art: () => React.ReactElement }[] = [
  {
    title: "Every lesson has a reason.",
    detail: "Your profile decides the slides, the pace and the examples.",
    icon: Sparkles,
    art: () => (
      <div className="space-y-1.5 rounded-xl border border-foreground/10 bg-background p-3 shadow-lift">
        <p className="font-mono text-[10px] text-muted-foreground">[your profile]</p>
        {["Visual first", "Quick pace", "Exam focus"].map((t) => (
          <p key={t} className="flex items-center gap-2 text-[13px]">
            <Check className="h-3.5 w-3.5 text-secondary" aria-hidden /> {t}
          </p>
        ))}
      </div>
    ),
  },
  {
    title: "Worth a closer look.",
    detail: "Tap any term on the board and the tutor explains it.",
    icon: Waypoints,
    art: () => (
      <div className="relative rounded-xl border border-foreground/10 bg-background p-3 shadow-lift">
        <p className="font-hand text-lg">
          The <span className="rounded bg-amber/20 px-1">chlorophyll</span> catches light
        </p>
        <p className="mt-2 rounded-lg bg-foreground px-2.5 py-1.5 text-[12px] leading-snug text-background">
          The green pigment in leaves. It absorbs red and blue light.
        </p>
      </div>
    ),
  },
  {
    title: "Yours to keep.",
    detail: "Download the deck, the handout and the captioned video.",
    icon: FileText,
    art: () => (
      <div className="flex flex-wrap gap-2">
        {["Slides.pptx", "Handout.pdf", "Lesson.mp4", "Narration.mp3"].map((f, i) => (
          <span
            key={f}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 font-mono text-[11px] shadow-soft",
              i === 2 ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-background"
            )}
          >
            {f}
          </span>
        ))}
      </div>
    ),
  },
  {
    title: "What you missed, too.",
    detail: "Wrong answers come back on a review date, not never.",
    icon: Check,
    art: () => (
      <div className="space-y-1.5 rounded-xl border border-foreground/10 bg-background p-3 shadow-lift">
        <p className="flex items-center gap-2 text-[13px]"><Check className="h-3.5 w-3.5 text-secondary" aria-hidden /> Light reactions</p>
        <p className="flex items-center gap-2 text-[13px]"><Check className="h-3.5 w-3.5 text-secondary" aria-hidden /> Where it happens</p>
        <p className="flex items-center gap-2 text-[13px]">
          <X className="h-3.5 w-3.5 text-destructive" aria-hidden /> Calvin cycle
          <span className="font-mono text-[10px] text-amber">[review Fri]</span>
        </p>
      </div>
    ),
  },
];

export function MoreThan() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % CARDS.length), 4500);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <section id="more" className="scroll-mt-16 bg-elevated py-20 sm:py-28">
      <div className="container">
        <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
          More than a <em>video</em>.
        </h2>
        <div
          className="mt-10 flex flex-col gap-3 md:h-[300px] md:flex-row"
          onMouseLeave={() => setPaused(false)}
        >
          {CARDS.map((card, i) => {
            const open = i === active;
            const Icon = card.icon;
            const Art = card.art;
            return (
              <motion.button
                key={card.title}
                type="button"
                layout
                onMouseEnter={() => {
                  setPaused(true);
                  setActive(i);
                }}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-expanded={open}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className={cn(
                  "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-5 text-left transition-colors",
                  open
                    ? "border-foreground/10 bg-card shadow-float md:flex-[2.4]"
                    : "border-transparent bg-card/55 hover:bg-card/80 md:flex-1"
                )}
              >
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.12 }}
                      className="mb-5 max-w-sm"
                    >
                      <Art />
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="mt-auto">
                  {!open && <Icon className="mb-3 h-5 w-5 text-amber" aria-hidden />}
                  <p className="font-display text-xl leading-snug">{card.title}</p>
                  {open && <p className="mt-1.5 text-sm text-muted-foreground">{card.detail}</p>}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ --- */

const FAQS: [string, string][] = [
  ["Is it free?", "It is free to start. Sign in with Google or email and begin the discovery."],
  ["What do I need to start?", "A topic line, or a PDF of your notes or a chapter. The discovery itself takes about three minutes."],
  [
    "How does it know how I learn?",
    "Six short activities, nothing marked right or wrong. How you take things in, your pace, your attention and what you already know become your learning profile.",
  ],
  ["Which languages does it speak?", "English, Hindi, Telugu, Tamil and Spanish — written on the board and spoken in the narration."],
  [
    "What do I get for each lesson?",
    "A narrated, animated video with captions, an interactive board, a slide deck and handout, and a quiz game to finish.",
  ],
  ["Can I keep my lessons?", "Download the deck as PPTX or PDF, the narration as audio and the lesson as a subtitled MP4."],
  ["How does review work?", "Every quiz schedules the lesson to come back just before you are likely to forget it."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-16 py-20 sm:py-28">
      <div className="container grid gap-10 lg:grid-cols-12">
        <h2 className="font-display text-5xl tracking-tight lg:col-span-5">FAQ</h2>
        <dl className="border-t border-foreground/15 lg:col-span-7">
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q} className="border-b border-foreground/15">
                <dt>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-6 py-4 text-left font-display text-lg sm:text-xl"
                  >
                    {q}
                    <Plus
                      className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-45")}
                      aria-hidden
                    />
                  </button>
                </dt>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.dd
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-xl pb-5 text-[15px] leading-relaxed text-muted-foreground">{a}</p>
                    </motion.dd>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- cta + footer --- */

export function ClosingCta() {
  const { firebaseUser } = useAuth();
  return (
    <section className="border-t border-foreground/10 py-24 text-center sm:py-32">
      <div className="container">
        <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
          What will you <em>learn</em> next?
        </h2>
        <p className="mt-4 text-muted-foreground">Start with a topic. SMART AI works out the rest.</p>
        <PillLink href={firebaseUser ? "/dashboard" : "/login"} className="mt-8">
          {firebaseUser ? "Open dashboard" : "Start learning"}
        </PillLink>
      </div>
    </section>
  );
}

const FOOTER: { title: string; links: [string, string][] }[] = [
  { title: "Learn", links: [["Start the discovery", "/login"], ["Log in", "/login"]] },
  { title: "Product", links: [["How it works", "#story"], ["Lessons", "#more"], ["FAQ", "#faq"]] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-foreground/10 pb-10 pt-14">
      <div className="container grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            A learning notebook. It works out how you learn, then writes the lesson.
          </p>
        </div>
        {FOOTER.map((col) => (
          <nav key={col.title} aria-label={col.title} className="lg:col-span-2">
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="lg:col-span-3">
          <p className="text-sm font-semibold">Languages</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground" lang="mul">
            English · हिन्दी · తెలుగు · தமிழ் · Español
          </p>
        </div>
      </div>
      <div className="container mt-14 text-xs text-muted-foreground">© {new Date().getFullYear()} SMART AI</div>
    </footer>
  );
}
