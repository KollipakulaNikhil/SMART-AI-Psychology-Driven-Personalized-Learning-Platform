"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowUpRight, Check, FileText, Sparkles, Waypoints, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* ------------------------------------------------------------ InkHeading --- */

function InkWord({ progress, index, total, italic, children }: {
  progress: MotionValue<number>;
  index: number;
  total: number;
  italic: boolean;
  children: string;
}) {
  const start = index / total;
  const opacity = useTransform(progress, [start, Math.min(1, start + 1.6 / total)], [0.14, 1]);
  const y = useTransform(progress, [start, Math.min(1, start + 1.6 / total)], [6, 0]);
  const Tag = italic ? motion.em : motion.span;
  return (
    <Tag style={{ opacity, y }} className="inline-block">
      {children}
    </Tag>
  );
}

/**
 * A heading that inks in word by word as it crosses the screen, tied to
 * scroll. Wrap a word in *asterisks* to set it in italics.
 */
export function InkHeading({ text, className, as = "h2" }: { text: string; className?: string; as?: "h2" | "p" }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.92", "start 0.5"] });
  const words = text.split(" ");
  const Tag = as;
  return (
    <Tag ref={ref} className={className} aria-label={text.replace(/\*/g, "")}>
      {words.map((w, i) => {
        const italic = w.startsWith("*");
        const clean = w.replace(/\*/g, "");
        // keep trailing punctuation outside the italics, as in the rest of the page
        const m = italic ? clean.match(/^(.*?)([.,!?]*)$/) : null;
        return (
          <span key={i} aria-hidden>
            <InkWord progress={scrollYProgress} index={i} total={words.length} italic={italic}>
              {m ? m[1] : clean}
            </InkWord>
            {m && m[2] ? (
              <InkWord progress={scrollYProgress} index={i} total={words.length} italic={false}>
                {m[2]}
              </InkWord>
            ) : null}
            {i < words.length - 1 ? " " : null}
          </span>
        );
      })}
    </Tag>
  );
}

/* ------------------------------------------- lesson kit: pinned sideways --- */

const KIT: { n: string; title: string; detail: string; icon: typeof Sparkles; art: () => React.ReactElement }[] = [
  {
    n: "01",
    title: "Every lesson has a reason.",
    detail: "Your profile decides the slides, the pace and the examples.",
    icon: Sparkles,
    art: () => (
      <div className="w-[250px] space-y-2 rounded-xl border border-foreground/10 bg-background p-4 shadow-lift">
        <p className="font-mono text-[10px] text-muted-foreground">[your profile]</p>
        {["Visual first", "Quick pace", "Exam focus"].map((t) => (
          <p key={t} className="flex items-center gap-2 text-[14px]">
            <Check className="h-3.5 w-3.5 text-secondary" aria-hidden /> {t}
          </p>
        ))}
      </div>
    ),
  },
  {
    n: "02",
    title: "Worth a closer look.",
    detail: "Tap any term on the board and the tutor explains it.",
    icon: Waypoints,
    art: () => (
      <div className="w-[270px] rounded-xl border border-foreground/10 bg-background p-4 shadow-lift">
        <p className="font-hand text-xl">
          The <span className="rounded bg-amber/20 px-1">chlorophyll</span> catches light
        </p>
        <p className="mt-3 rounded-lg bg-foreground px-3 py-2 text-[12.5px] leading-snug text-background">
          The green pigment in leaves. It absorbs red and blue light.
        </p>
      </div>
    ),
  },
  {
    n: "03",
    title: "Yours to keep.",
    detail: "Download the deck, the handout and the captioned video.",
    icon: FileText,
    art: () => (
      <div className="relative h-[150px] w-[260px]">
        {["Slides.pptx", "Handout.pdf", "Lesson.mp4", "Narration.mp3"].map((f, i) => (
          <span
            key={f}
            className={cn(
              "absolute rounded-lg border px-3 py-2 font-mono text-[12px] shadow-lift",
              i === 2 ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-background"
            )}
            style={{ left: 10 + i * 34, top: 8 + i * 30, transform: `rotate(${(i - 1.5) * 4}deg)` }}
          >
            {f}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: "04",
    title: "What you missed, too.",
    detail: "Wrong answers come back on a review date, not never.",
    icon: Check,
    art: () => (
      <div className="w-[260px] space-y-2 rounded-xl border border-foreground/10 bg-background p-4 shadow-lift">
        <p className="flex items-center gap-2 text-[14px]"><Check className="h-3.5 w-3.5 text-secondary" aria-hidden /> Light reactions</p>
        <p className="flex items-center gap-2 text-[14px]"><Check className="h-3.5 w-3.5 text-secondary" aria-hidden /> Where it happens</p>
        <p className="flex items-center gap-2 text-[14px]">
          <X className="h-3.5 w-3.5 text-destructive" aria-hidden /> Calvin cycle
          <span className="font-mono text-[10px] text-amber">[review Fri]</span>
        </p>
      </div>
    ),
  },
];

function KitCard({ card }: { card: (typeof KIT)[number] }) {
  const Icon = card.icon;
  const Art = card.art;
  return (
    <article className="group relative flex h-[440px] w-[84vw] shrink-0 snap-center flex-col overflow-hidden rounded-[26px] border border-foreground/10 bg-card shadow-float sm:w-[460px]">
      <div className="relative grid flex-1 place-items-center overflow-hidden border-b border-foreground/[0.07] bg-background/60 [background-image:radial-gradient(hsl(var(--foreground)/0.09)_1px,transparent_1px)] [background-size:18px_18px]">
        <div className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-1 group-hover:scale-[1.04]">
          <Art />
        </div>
        <span className="absolute left-5 top-4 font-mono text-[11px] text-muted-foreground">{card.n} / 04</span>
      </div>
      <div className="flex items-start gap-4 p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-foreground/10 bg-background">
          <Icon className="h-4 w-4 text-amber" aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-[1.45rem] leading-snug">{card.title}</h3>
          <p className="mt-1 text-[14.5px] text-muted-foreground">{card.detail}</p>
        </div>
      </div>
    </article>
  );
}

/**
 * "More than a video" — on wide screens the section pins and the cards travel
 * sideways as you scroll down. On phones it is a plain swipeable row.
 */
export function LessonKit() {
  const sectionRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [wide, setWide] = useState(false);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -distance]);
  const bar = useTransform(scrollYProgress, [0.05, 0.95], [0, 1]);

  useIsoLayoutEffect(() => {
    const measure = () => {
      const isWide = window.matchMedia("(min-width: 1024px)").matches;
      setWide(isWide);
      const row = rowRef.current;
      if (row) setDistance(Math.max(0, row.scrollWidth - window.innerWidth + 48));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="more"
      className="relative scroll-mt-16 bg-elevated"
      style={{ height: wide ? `calc(${Math.round(distance)}px + 100svh)` : undefined }}
    >
      <div className={cn("overflow-hidden py-24", wide && "sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center py-0")}>
        <div className="container flex flex-wrap items-end justify-between gap-4">
          <InkHeading text="More than a *video*." className="font-display text-4xl tracking-tight sm:text-[3.25rem]" />
          <p className="max-w-xs text-[15px] text-muted-foreground">
            Every lesson comes with the pieces around it — so it sticks.
          </p>
        </div>

        <motion.div
          ref={rowRef}
          style={wide ? { x } : undefined}
          className={cn(
            "mt-10 flex gap-5 px-6 lg:px-[max(2rem,calc((100vw-1400px)/2+2rem))]",
            !wide && "snap-x snap-mandatory overflow-x-auto pb-4 [scrollbar-width:none]"
          )}
        >
          {KIT.map((card) => (
            <KitCard key={card.n} card={card} />
          ))}
          <div className="flex h-[440px] w-[70vw] shrink-0 snap-center flex-col justify-center sm:w-[340px]">
            <p className="font-hand text-[1.9rem] leading-tight text-amber">
              …all written for one person.
              <br />
              You.
            </p>
          </div>
        </motion.div>

        {wide && (
          <div className="container mt-8">
            <div className="h-px w-full bg-foreground/10">
              <motion.div style={{ scaleX: bar }} className="h-px origin-left bg-foreground" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------ forgetting curve --- */

const W = 820;
const H = 320;
const PAD = { l: 44, r: 20, t: 24, b: 38 };
const DAYS = 30;
const REVIEWS = [1, 3, 7, 15];

const px = (day: number) => PAD.l + (day / DAYS) * (W - PAD.l - PAD.r);
const py = (r: number) => PAD.t + (1 - r) * (H - PAD.t - PAD.b);

function curvePath(withReviews: boolean) {
  const pts: string[] = [];
  let last = 0;
  let stability = 1.6;
  for (let i = 0; i <= DAYS * 8; i++) {
    const day = i / 8;
    if (withReviews && REVIEWS.includes(day)) {
      pts.push(`L${px(day).toFixed(1)},${py(Math.exp(-(day - last) / stability)).toFixed(1)}`);
      last = day;
      stability *= 2.6;
    }
    const r = Math.exp(-(day - last) / stability);
    pts.push(`${i === 0 ? "M" : "L"}${px(day).toFixed(1)},${py(r).toFixed(1)}`);
  }
  return pts.join(" ");
}

const PATH_PLAIN = curvePath(false);
const PATH_REVIEW = curvePath(true);

function ReviewDot({ progress, day, i }: { progress: MotionValue<number>; day: number; i: number }) {
  const at = day / DAYS;
  const opacity = useTransform(progress, [at, at + 0.03], [0, 1]);
  const scale = useTransform(progress, [at, at + 0.05], [0.4, 1]);
  return (
    <motion.g style={{ opacity, scale, transformBox: "fill-box", transformOrigin: "center" }}>
      <circle cx={px(day)} cy={py(1)} r={6} fill="hsl(var(--mark))" />
      <text x={px(day)} y={py(1) - 12} textAnchor="middle" className="fill-muted-foreground font-sans text-[11px]">
        review {i + 1}
      </text>
    </motion.g>
  );
}

export function ForgettingCurve({ figures }: { figures: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.75", "end 0.55"] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const endLabels = useTransform(scrollYProgress, [0.9, 1], [0, 1]);

  return (
    <section className="border-y border-foreground/10 py-24 sm:py-32">
      <div className="container">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <InkHeading text="Built not to be *forgotten*." className="font-display text-4xl tracking-tight sm:text-[3.25rem] sm:leading-[1.05]" />
          <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            Memory fades fast after one lesson. A review right before it slips resets the clock — and each time it fades more slowly.
          </p>
        </div>

        <div ref={ref} className="mt-12 rounded-[26px] border border-foreground/10 bg-card p-4 shadow-float sm:p-8">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Illustration: memory without review falls to almost nothing in a month; with four timed reviews it stays high.">
            {[0, 0.5, 1].map((r) => (
              <g key={r}>
                <line x1={PAD.l} x2={W - PAD.r} y1={py(r)} y2={py(r)} stroke="hsl(var(--foreground) / 0.08)" />
                <text x={PAD.l - 10} y={py(r) + 4} textAnchor="end" className="fill-muted-foreground font-sans text-[11px]">
                  {r * 100}%
                </text>
              </g>
            ))}
            {[0, 7, 14, 21, 30].map((d) => (
              <text key={d} x={px(d)} y={H - 12} textAnchor="middle" className="fill-muted-foreground font-sans text-[11px]">
                {d === 0 ? "lesson" : `day ${d}`}
              </text>
            ))}
            <motion.path
              d={PATH_PLAIN}
              fill="none"
              stroke="hsl(var(--foreground) / 0.35)"
              strokeWidth={2}
              strokeDasharray="5 6"
              style={{ pathLength: draw }}
            />
            <motion.path
              d={PATH_REVIEW}
              fill="none"
              stroke="hsl(var(--amber))"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pathLength: draw }}
            />
            {REVIEWS.map((d, i) => (
              <ReviewDot key={d} progress={draw} day={d} i={i} />
            ))}
            <motion.g style={{ opacity: endLabels }}>
              <text x={W - PAD.r} y={py(0.06) - 8} textAnchor="end" className="fill-muted-foreground font-sans text-[12px]">
                one lesson, no review
              </text>
              <text x={W - PAD.r} y={py(0.78) + 22} textAnchor="end" className="fill-amber font-hand text-[18px]">
                with SMART AI reviews
              </text>
            </motion.g>
          </svg>
          <p className="mt-2 text-right text-[11px] text-muted-foreground">Illustration of the forgetting curve, not measured data.</p>
        </div>

        <div className="mt-12">{figures}</div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- ask the tutor --- */

const QA: [string, string][] = [
  ["Is it free?", "It is free to start. Sign in with Google or email and begin the discovery."],
  ["What do I need to start?", "A topic line, or a PDF of your notes or a chapter. The discovery itself takes about three minutes."],
  [
    "How does it know how I learn?",
    "Six short activities, nothing marked right or wrong. How you take things in, your pace, your attention and what you already know become your learning profile.",
  ],
  ["Which languages?", "English, Hindi, Telugu, Tamil and Spanish — written on the board and spoken in the narration."],
  ["What do I get per lesson?", "A narrated, animated video with captions, an interactive board, a slide deck and handout, and a quiz game to finish."],
  ["Can I keep my lessons?", "Download the deck as PPTX or PDF, the narration as audio and the lesson as a subtitled MP4."],
  ["How does review work?", "Every quiz schedules the lesson to come back just before you are likely to forget it."],
];

type Msg = { id: number; from: "me" | "tutor"; text: string };

function Typing() {
  return (
    <span className="flex gap-1 px-1 py-1.5" aria-label="Tutor is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-foreground/40"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </span>
  );
}

export function AskTutor() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 1, from: "me", text: QA[0][0] },
    { id: 2, from: "tutor", text: QA[0][1] },
  ]);
  const [streaming, setStreaming] = useState<{ id: number; full: string; shown: number } | null>(null);
  const [typing, setTyping] = useState(false);
  const asked = new Set(messages.filter((m) => m.from === "me").map((m) => m.text));
  const timers = useRef<number[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, streaming?.shown, typing]);

  const ask = (q: string, a: string) => {
    if (typing || streaming) return;
    const base = Date.now();
    setMessages((m) => [...m, { id: base, from: "me", text: q }]);
    setTyping(true);
    timers.current.push(
      window.setTimeout(() => {
        setTyping(false);
        const words = a.split(" ");
        setStreaming({ id: base + 1, full: a, shown: 0 });
        words.forEach((_, i) => {
          timers.current.push(
            window.setTimeout(() => {
              if (i === words.length - 1) {
                setStreaming(null);
                setMessages((m) => [...m, { id: base + 1, from: "tutor", text: a }]);
              } else {
                setStreaming((s) => (s ? { ...s, shown: i + 1 } : s));
              }
            }, 45 * (i + 1))
          );
        });
      }, 650)
    );
  };

  return (
    <section id="faq" className="scroll-mt-16 py-24 sm:py-32">
      <div className="container grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <InkHeading text="Ask the *tutor*." className="font-display text-4xl tracking-tight sm:text-[3.25rem] sm:leading-[1.05]" />
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            The questions people ask first. Tap one — the same tutor answers inside every lesson.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {QA.map(([q, a]) => {
              const done = asked.has(q);
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q, a)}
                  disabled={done || typing || !!streaming}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-[13.5px] transition-[background-color,border-color,opacity,transform] duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    done
                      ? "border-transparent bg-foreground/[0.05] text-muted-foreground line-through decoration-foreground/20"
                      : "border-foreground/15 bg-card hover:-translate-y-0.5 hover:border-foreground/40 disabled:opacity-60"
                  )}
                >
                  {q}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-[26px] border border-foreground/10 bg-card shadow-float">
            <div className="flex items-center gap-2.5 border-b border-foreground/10 px-5 py-3.5">
              <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-foreground font-display text-[13px] text-background">
                S
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-secondary" />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] font-semibold">SMART AI tutor</span>
                <span className="block text-[11px] text-muted-foreground">{typing || streaming ? "typing…" : "online"}</span>
              </span>
            </div>
            <div ref={threadRef} aria-live="polite" className="h-[380px] space-y-3 overflow-y-auto px-5 py-5 [scrollbar-width:thin]">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.p
                    key={m.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className={cn(
                      "max-w-[82%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed",
                      m.from === "me"
                        ? "ml-auto rounded-br-md bg-foreground text-background"
                        : "rounded-bl-md border border-foreground/10 bg-background"
                    )}
                  >
                    {m.text}
                  </motion.p>
                ))}
              </AnimatePresence>
              {typing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-fit rounded-2xl rounded-bl-md border border-foreground/10 bg-background px-3 py-1.5">
                  <Typing />
                </motion.div>
              )}
              {streaming && (
                <p className="max-w-[82%] rounded-2xl rounded-bl-md border border-foreground/10 bg-background px-4 py-2.5 text-[14.5px] leading-relaxed">
                  {streaming.full.split(" ").slice(0, streaming.shown + 1).join(" ")}
                  <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-foreground/60" />
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- final CTA --- */

const TOPICS = ["Photosynthesis", "The French Revolution", "Newton's laws", "Quadratic equations", "The human heart"];

function useTypewriter(words: string[], enabled: boolean) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let word = 0;
    let len = 0;
    let deleting = false;
    let id: number;
    const tick = () => {
      const w = words[word];
      if (!deleting) {
        len += 1;
        setText(w.slice(0, len));
        if (len === w.length) {
          deleting = true;
          id = window.setTimeout(tick, 1500);
          return;
        }
      } else {
        len -= 1;
        setText(w.slice(0, len));
        if (len === 0) {
          deleting = false;
          word = (word + 1) % words.length;
        }
      }
      id = window.setTimeout(tick, deleting ? 35 : 75);
    };
    id = window.setTimeout(tick, 400);
    return () => window.clearTimeout(id);
  }, [words, enabled]);
  return text;
}

export function FinalCta() {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const [topic, setTopic] = useState("");
  const [focused, setFocused] = useState(false);
  const placeholder = useTypewriter(TOPICS, !focused && topic === "");

  const onMove = (e: React.PointerEvent) => {
    const el = panel.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <section className="py-20 sm:py-28">
      <div className="container">
        <div
          ref={panel}
          onPointerMove={onMove}
          className="relative overflow-hidden rounded-[32px] bg-[#1d1b17] px-6 py-20 text-center text-[#f4efe4] sm:px-12 sm:py-28 [--mx:50%] [--my:40%]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{ background: "radial-gradient(520px circle at var(--mx) var(--my), rgba(238,143,74,0.28), transparent 60%)" }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

          <div className="relative">
            <InkHeading
              text="What will you *learn* next?"
              className="mx-auto max-w-3xl font-display text-[2.6rem] leading-[1.05] tracking-tight sm:text-[4.2rem]"
            />
            <p className="mt-5 text-[16px] text-[#f4efe4]/65">Type a topic. SMART AI works out the rest.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                router.push(firebaseUser ? "/dashboard" : "/login");
              }}
              className="mx-auto mt-10 flex max-w-xl items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] p-2 backdrop-blur focus-within:border-white/40"
            >
              <label htmlFor="cta-topic" className="sr-only">
                Topic
              </label>
              <input
                id="cta-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={focused ? "Any topic…" : placeholder}
                autoComplete="off"
                className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[16px] text-[#f4efe4] outline-none placeholder:text-[#f4efe4]/45"
              />
              <button
                type="submit"
                className="group inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-[#f4efe4] px-5 text-[14.5px] font-semibold text-[#1d1b17] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
              >
                {firebaseUser ? "Open dashboard" : "Start learning"}
                <ArrowUpRight className="h-4 w-4 text-[#c2410c] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </button>
            </form>
            <p className="mt-4 text-[12.5px] text-[#f4efe4]/45">Free to start · 5 languages · ready in minutes</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- footer mark --- */

/** A giant wordmark that fills with ink as the footer arrives. */
export function FooterMark() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const clip = useTransform(scrollYProgress, (v) => `inset(0 ${Math.round((1 - Math.min(1, v * 1.15)) * 100)}% 0 0)`);
  const classes = "select-none whitespace-nowrap font-display text-[19vw] leading-[0.85] tracking-[-0.04em] lg:text-[16.5rem]";
  return (
    <div ref={ref} aria-hidden className="container mt-16 overflow-hidden">
      <div className="relative">
        <p className={cn(classes, "text-transparent [-webkit-text-stroke:1px_hsl(var(--foreground)/0.18)]")}>
          smart <em>ai</em>.
        </p>
        <motion.p style={{ clipPath: clip }} className={cn(classes, "absolute inset-0 text-foreground")}>
          smart <em className="text-mark">ai</em>.
        </motion.p>
      </div>
    </div>
  );
}
