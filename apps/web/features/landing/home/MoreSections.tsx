"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView } from "framer-motion";
import { BookOpen, Check, Ear, Eye, Hand, Pause, Play, RotateCcw, X } from "lucide-react";
import { BossPreview } from "@/features/play/scenes/BossScene";
import { ClimbPreview } from "@/features/play/scenes/ClimbScene";
import { ConstellationPreview } from "@/features/play/scenes/ConstellationScene";
import { GardenPreview } from "@/features/play/scenes/GardenScene";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- shared --- */

const EASE = [0.16, 1, 0.3, 1] as const;

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ title, italic, after = ".", lead }: { title: string; italic: string; after?: string; lead: string }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <h2 className="font-display text-4xl tracking-tight sm:text-[3.25rem] sm:leading-[1.05]">
        {title} <em>{italic}</em>
        {after}
      </h2>
      <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">{lead}</p>
    </Reveal>
  );
}

/** A row of pill buttons where exactly one is chosen. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.id === value;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              on ? "text-background" : "border border-foreground/12 bg-card text-foreground hover:border-foreground/30"
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${label}`}
                className="absolute inset-0 rounded-full bg-foreground"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {Icon && <Icon className="relative h-3.5 w-3.5" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- see it your way --- */

type Topic = "photosynthesis" | "newton" | "revolution";
type Style = "visual" | "listener" | "hands" | "reader";
type Pace = "quick" | "steady";

const TOPICS: Record<Topic, { label: string; subject: string; parts: [string, string, string, string]; thing: string }> = {
  photosynthesis: {
    label: "Photosynthesis",
    subject: "Biology",
    parts: ["Why plants need light", "Inside the chloroplast", "Light into sugar", "Where the oxygen goes"],
    thing: "a leaf in sunlight",
  },
  newton: {
    label: "Newton's laws",
    subject: "Physics",
    parts: ["Things keep moving", "Force equals mass × acceleration", "Every push pushes back", "Laws on a skateboard"],
    thing: "a skateboard ride",
  },
  revolution: {
    label: "French Revolution",
    subject: "History",
    parts: ["A country out of money", "The Estates and the anger", "1789: the Bastille", "What it changed for good"],
    thing: "a bread queue in Paris",
  },
};

const STYLES: Record<Style, { label: string; icon: React.ComponentType<{ className?: string }>; verbs: [string, string, string, string]; note: string }> = {
  visual: { label: "Visual", icon: Eye, verbs: ["Diagram", "Animation", "Board sketch", "Picture recap"], note: "Diagrams first, like you asked." },
  listener: { label: "Listener", icon: Ear, verbs: ["Story", "Narrated walk-through", "Talk it through", "Spoken recap"], note: "Told as a story — listen along." },
  hands: { label: "Hands-on", icon: Hand, verbs: ["Try this", "Experiment", "Build it", "Quick challenge"], note: "Something to try at every step." },
  reader: { label: "Reader", icon: BookOpen, verbs: ["Read", "Key definitions", "Worked example", "Summary notes"], note: "Clear notes you can come back to." },
};

const PACE: Record<Pace, { label: string; slides: number; minutes: number }> = {
  quick: { label: "Quick", slides: 6, minutes: 5 },
  steady: { label: "Steady", slides: 10, minutes: 12 },
};

export function YourWay() {
  const [topic, setTopic] = useState<Topic>("photosynthesis");
  const [style, setStyle] = useState<Style>("visual");
  const [pace, setPace] = useState<Pace>("quick");
  const t = TOPICS[topic];
  const s = STYLES[style];
  const p = PACE[pace];
  const key = `${topic}-${style}-${pace}`;

  return (
    <section id="your-way" className="scroll-mt-16 py-24 sm:py-32">
      <div className="container">
        <SectionHead
          title="See it"
          italic="your"
          after=" way."
          lead="Same topic, a different mind, a different lesson. Change the learner and watch the plan rewrite itself."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
          <Reveal className="space-y-7">
            <div>
              <p className="mb-2.5 text-[13px] font-medium text-muted-foreground">Topic</p>
              <Segmented
                label="Topic"
                value={topic}
                onChange={setTopic}
                options={(Object.keys(TOPICS) as Topic[]).map((id) => ({ id, label: TOPICS[id].label }))}
              />
            </div>
            <div>
              <p className="mb-2.5 text-[13px] font-medium text-muted-foreground">How you learn best</p>
              <Segmented
                label="Learning style"
                value={style}
                onChange={setStyle}
                options={(Object.keys(STYLES) as Style[]).map((id) => ({ id, label: STYLES[id].label, icon: STYLES[id].icon }))}
              />
            </div>
            <div>
              <p className="mb-2.5 text-[13px] font-medium text-muted-foreground">Pace</p>
              <Segmented
                label="Pace"
                value={pace}
                onChange={setPace}
                options={(Object.keys(PACE) as Pace[]).map((id) => ({ id, label: PACE[id].label }))}
              />
            </div>
            <p className="font-hand text-xl leading-snug text-amber">
              In the real thing, a three-minute discovery sets these for you.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative rounded-[22px] border border-foreground/10 bg-card p-6 shadow-float sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium text-amber">{t.subject} · lesson plan</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={topic}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-1 font-display text-[1.9rem] leading-tight"
                    >
                      {t.label}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <span className="shrink-0 rounded-full bg-foreground px-3 py-1 text-[12px] font-semibold text-background">
                  Made for you
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
                {[`${p.slides} slides`, `${p.minutes} min`, s.label].map((chip) => (
                  <motion.span
                    key={chip}
                    layout
                    className="rounded-full border border-foreground/12 bg-background px-2.5 py-0.5 text-muted-foreground"
                  >
                    {chip}
                  </motion.span>
                ))}
              </div>

              <ol className="mt-6 space-y-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {t.parts.map((part, i) => (
                    <motion.li
                      key={`${key}-${i}`}
                      layout
                      initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
                      transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
                      className="flex items-center gap-3 rounded-2xl border border-foreground/[0.07] bg-background px-4 py-3"
                    >
                      <span className="nums w-5 font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-amber">{s.verbs[i]}</span>
                        <span className="block truncate text-[15px]">
                          {i === 3 && style === "hands" ? `Try it with ${t.thing}` : part}
                        </span>
                      </span>
                      <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>

              {pace === "steady" && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 px-4 text-[12.5px] text-muted-foreground"
                >
                  + {p.slides - 4} more slides with worked examples and a recap
                </motion.p>
              )}

              <AnimatePresence mode="wait">
                <motion.p
                  key={style}
                  initial={{ opacity: 0, rotate: -2, y: 6 }}
                  animate={{ opacity: 1, rotate: -1.5, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 w-fit bg-[#E8DEC1] px-3 py-1 font-hand text-lg text-[#2A2A26] shadow-sm"
                >
                  {s.note}
                </motion.p>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ languages --- */

type Lang = "en" | "hi" | "te" | "ta" | "es";

const LANGS: Record<Lang, { name: string; title: string; line: string; term: string }> = {
  en: { name: "English", title: "Photosynthesis", line: "Plants turn sunlight into food.", term: "chlorophyll" },
  hi: { name: "हिन्दी", title: "प्रकाश संश्लेषण", line: "पौधे धूप को भोजन में बदलते हैं।", term: "पर्णहरित" },
  te: { name: "తెలుగు", title: "కిరణజన్య సంయోగక్రియ", line: "మొక్కలు సూర్యరశ్మిని ఆహారంగా మారుస్తాయి.", term: "పత్రహరితం" },
  ta: { name: "தமிழ்", title: "ஒளிச்சேர்க்கை", line: "தாவரங்கள் சூரிய ஒளியை உணவாக மாற்றுகின்றன.", term: "பச்சையம்" },
  es: { name: "Español", title: "Fotosíntesis", line: "Las plantas convierten la luz del sol en alimento.", term: "clorofila" },
};

function Waveform({ playing }: { playing: boolean }) {
  const bars = [6, 12, 18, 10, 22, 14, 8, 16, 24, 12, 18, 9, 14, 20, 11, 7, 15, 21, 13, 8, 17, 12, 19, 10];
  return (
    <div className="flex h-7 flex-1 items-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-[#2A2A26]/70"
          initial={false}
          animate={playing ? { height: [h * 0.4, h, h * 0.6, h * 0.9, h * 0.4] } : { height: h * 0.4 }}
          transition={playing ? { duration: 1.1, repeat: Infinity, delay: i * 0.04, ease: "easeInOut" } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

export function Languages() {
  const [lang, setLang] = useState<Lang>("hi");
  const [keepEnglish, setKeepEnglish] = useState(true);
  const [playing, setPlaying] = useState(false);
  const l = LANGS[lang];
  const term = keepEnglish ? "chlorophyll" : l.term;

  return (
    <section id="languages" className="scroll-mt-16 border-y border-foreground/10 bg-elevated py-24 sm:py-32">
      <div className="container">
        <SectionHead
          title="Learn in"
          italic="your"
          after=" language."
          lead="The narration and the board, in five languages. Keep exam terms in English when that's what your paper uses."
        />

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
          <Reveal>
            <div className="relative overflow-hidden rounded-[22px] border border-foreground/10 bg-[#EFE7D3] p-6 text-[#2A2A26] shadow-float sm:p-8">
              <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(120,105,70,0.25)_1px,transparent_1px)] [background-size:22px_22px]" />
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={lang + String(keepEnglish)}
                    initial={{ opacity: 0, filter: "blur(6px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(6px)" }}
                    transition={{ duration: 0.3 }}
                    lang={lang}
                  >
                    <p className="text-center font-display text-2xl font-bold tracking-wide sm:text-3xl">{l.title}</p>
                    <div className="mx-auto mt-6 max-w-md rounded-2xl border-2 border-[#7FAE86] bg-white/30 p-5">
                      <p className="text-center text-[11px] font-bold tracking-[0.25em]">KEY IDEA</p>
                      <p className="mt-3 flex items-center justify-center gap-2 font-hand text-xl">
                        <span className="h-2 w-2 rounded-full bg-[#EE8F4A]" />
                        <span className={cn("rounded px-1.5", keepEnglish && lang !== "en" && "bg-[#F6D98A]")}>{term}</span>
                      </p>
                    </div>
                    <p className="mx-auto mt-8 w-fit -rotate-1 bg-[#E8DEC1] px-4 py-2 text-center font-hand text-xl shadow-[0_3px_8px_rgba(58,47,18,0.2)] sm:text-2xl">
                      {l.line}
                    </p>
                  </motion.div>
                </AnimatePresence>

                <div className="mt-8 flex items-center gap-3 rounded-full bg-white/50 py-1.5 pl-1.5 pr-4">
                  <button
                    type="button"
                    onClick={() => setPlaying((v) => !v)}
                    aria-label={playing ? "Pause narration preview" : "Play narration preview"}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#2A2A26] text-[#EFE7D3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A2A26] focus-visible:ring-offset-2"
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
                  </button>
                  <Waveform playing={playing} />
                  <span className="text-[12px] tabular-nums">0:{playing ? "14" : "00"}</span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="space-y-8">
            <div role="radiogroup" aria-label="Language" className="grid gap-2">
              {(Object.keys(LANGS) as Lang[]).map((id) => {
                const on = id === lang;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setLang(id)}
                    lang={id}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border px-5 py-3.5 text-left transition-[background-color,border-color,box-shadow] duration-300",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "border-foreground/15 bg-card shadow-lift" : "border-transparent hover:bg-card/60"
                    )}
                  >
                    <span className="font-display text-xl">{LANGS[id].name}</span>
                    <span className={cn("text-[12px] transition-opacity", on ? "text-amber opacity-100" : "opacity-0")}>
                      voice + board
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-card px-5 py-4">
              <span>
                <span className="block text-[15px] font-medium">Keep exam terms in English</span>
                <span className="block text-[13px] text-muted-foreground">Explained in your language, written the way your exam writes them.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={keepEnglish}
                onClick={() => setKeepEnglish((v) => !v)}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  keepEnglish ? "bg-foreground" : "bg-foreground/20"
                )}
              >
                <motion.span
                  className="absolute top-1 h-5 w-5 rounded-full bg-background shadow"
                  animate={{ left: keepEnglish ? 24 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                />
              </button>
            </label>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- games --- */

const GAMES = [
  { name: "Boss Battle", line: "Right answers hurl spells. Misses let the boss strike back.", Preview: BossPreview },
  { name: "Knowledge Climb", line: "Walk a trail to the summit, lighting lanterns as you go.", Preview: ClimbPreview },
  { name: "Constellation", line: "Each answer places a star. Draw your own night sky.", Preview: ConstellationPreview },
  { name: "Bloom", line: "Grow a flower from seed — every right answer opens a bloom.", Preview: GardenPreview },
];

const QUESTION = {
  q: "Where in the leaf does photosynthesis happen?",
  options: ["In the roots", "In the chloroplasts", "In the stem", "In the soil"],
  answer: 1,
  why: "Chloroplasts hold chlorophyll, the pigment that catches light.",
};

export function Games() {
  const [game, setGame] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const Preview = GAMES[game].Preview;
  const correct = picked === QUESTION.answer;

  return (
    <section id="games" className="scroll-mt-16 py-24 sm:py-32">
      <div className="container">
        <SectionHead
          title="Finish with a"
          italic="game"
          lead="Four quiz games, one lesson's worth of questions. What you miss comes back on a review date."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <Reveal className="flex flex-col gap-2">
            {GAMES.map((g, i) => {
              const on = i === game;
              return (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => setGame(i)}
                  aria-pressed={on}
                  className={cn(
                    "group rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow] duration-300",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-foreground/12 bg-card shadow-lift" : "border-transparent hover:bg-card/60"
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-display text-xl">{g.name}</span>
                    <span className={cn("h-2 w-2 rounded-full transition-colors", on ? "bg-mark" : "bg-foreground/15")} />
                  </span>
                  <span
                    className={cn(
                      "grid text-[14px] text-muted-foreground transition-[grid-template-rows,opacity,margin] duration-300",
                      on ? "mt-1 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <span className="overflow-hidden">{g.line}</span>
                  </span>
                </button>
              );
            })}
          </Reveal>

          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-[22px] border border-foreground/10 bg-card shadow-float">
              <div className="relative aspect-[5/3] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={game}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="absolute inset-0"
                  >
                    <Preview />
                  </motion.div>
                </AnimatePresence>
                <span className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-[12px] font-medium text-white backdrop-blur">
                  {GAMES[game].name} · question 4 of 6
                </span>
              </div>

              <div className="p-6 sm:p-7">
                <p className="font-display text-[1.35rem] leading-snug">{QUESTION.q}</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {QUESTION.options.map((option, i) => {
                    const isAnswer = i === QUESTION.answer;
                    const isPicked = i === picked;
                    const done = picked !== null;
                    return (
                      <motion.button
                        key={option}
                        type="button"
                        disabled={done}
                        onClick={() => setPicked(i)}
                        animate={isPicked && !isAnswer ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                        transition={{ duration: 0.4 }}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-[15px] transition-colors duration-200",
                          !done && "border-foreground/12 bg-background hover:border-foreground/40",
                          done && isAnswer && "border-secondary bg-secondary/10 font-medium",
                          done && isPicked && !isAnswer && "border-destructive/60 bg-destructive/[0.06]",
                          done && !isAnswer && !isPicked && "border-foreground/[0.06] bg-background opacity-50"
                        )}
                      >
                        {option}
                        {done && isAnswer && <Check className="h-4 w-4 text-secondary" />}
                        {done && isPicked && !isAnswer && <X className="h-4 w-4 text-destructive" />}
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-4 min-h-[44px]">
                  <AnimatePresence mode="wait">
                    {picked === null ? (
                      <motion.p key="hint" exit={{ opacity: 0 }} className="text-[13px] text-muted-foreground">
                        Go on — pick one.
                      </motion.p>
                    ) : (
                      <motion.div
                        key="result"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <p className="text-[14px]">
                          <span className={cn("font-semibold", correct ? "text-secondary" : "text-destructive")}>
                            {correct ? "Spot on. " : "Not quite — this one comes back Friday. "}
                          </span>
                          <span className="text-muted-foreground">{QUESTION.why}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setPicked(null)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/15 px-3.5 text-[13px] hover:border-foreground/40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Try again
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- numbers --- */

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 1.2, ease: EASE, onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to]);
  return (
    <span ref={ref} className="nums">
      {value}
      {suffix}
    </span>
  );
}

const FIGURES: { value: number; suffix?: string; label: string }[] = [
  { value: 3, suffix: " min", label: "to find out how you learn" },
  { value: 6, label: "short activities, nothing marked wrong" },
  { value: 5, label: "languages, written and spoken" },
  { value: 4, label: "quiz games to finish a lesson" },
];

export function Numbers() {
  return (
    <section className="border-y border-foreground/10 py-16 sm:py-20">
      <div className="container">
        <Reveal>
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            By the <em>numbers</em>.
          </h2>
        </Reveal>
        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {FIGURES.map((f, i) => (
            <Reveal key={f.label} delay={i * 0.08} className="border-l border-foreground/15 pl-5">
              <dd className="font-display text-5xl leading-none tracking-tight sm:text-6xl">
                <CountUp to={f.value} suffix={f.suffix} />
              </dd>
              <dt className="mt-3 max-w-[14rem] text-[14px] leading-snug text-muted-foreground">{f.label}</dt>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
