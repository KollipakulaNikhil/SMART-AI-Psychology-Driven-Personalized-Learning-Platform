"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The interactive board demo.
 *
 * Two things are being shown at once, and both are real product behaviour
 * rather than marketing animation:
 *
 *  1. The board is WRITTEN in time with the narration. The timings below are
 *     the measured output of the alignment service against a real Edge TTS
 *     synthesis of this script, scaled down so the loop fits in a page.
 *  2. The voice and the board are separate languages. Switching to Telugu and
 *     leaving the board on English is the "speak your language, write the exam
 *     term" mode — the Hindi/Telugu strings here came out of the product's own
 *     translation service, which is why the Hindi captions keep "normalization"
 *     and "first normal form" in English exactly as a real lesson does.
 */

/** Real timings ran 30s; a demo loop wants ~13s. */
const TIME_SCALE = 0.45;
const LOOP_SEC = 30.5 * TIME_SCALE;
const EMPHASIS_SEC = 1.9 * TIME_SCALE;

type Lane = "term" | "note" | "node";
type Lang = "en" | "hi" | "te";

interface DemoEvent {
  lane: Lane;
  index: number;
  at: number;
}

const EVENTS: DemoEvent[] = (
  [
    { lane: "term", index: 0, at: 0.91 },
    { lane: "node", index: 0, at: 8.71 },
    { lane: "note", index: 0, at: 11.64 },
    { lane: "node", index: 1, at: 15.38 },
    { lane: "node", index: 2, at: 21.3 },
    { lane: "term", index: 1, at: 26.05 },
    { lane: "note", index: 1, at: 28.01 },
  ] satisfies DemoEvent[]
).map((event) => ({ ...event, at: event.at * TIME_SCALE }));

const CAPTION_AT = [0, 7.6, 14.4, 20.6, 25.4].map((at) => at * TIME_SCALE);

interface BoardCopy {
  title: string;
  terms: string[];
  notes: string[];
  nodes: string[];
}

interface LangCopy {
  nativeLabel: string;
  /** Spoken narration, one line per caption slot. */
  captions: string[];
  /** What gets written when the board follows the voice. */
  board: BoardCopy;
}

const ENGLISH_BOARD: BoardCopy = {
  title: "Normalization",
  terms: ["Normalization", "Redundancy"],
  notes: ["Each column holds one single value", "Updates stop contradicting each other"],
  nodes: ["First normal form", "Second normal form", "Third normal form"],
};

const COPY: Record<Lang, LangCopy> = {
  en: {
    nativeLabel: "English",
    captions: [
      "Let's start with normalization — organizing your data so nothing is stored twice.",
      "The first step is first normal form, where every column holds one single value.",
      "Then second normal form removes partial dependencies on part of a key.",
      "And third normal form gets rid of transitive dependencies.",
      "The payoff: redundancy disappears, and your updates stop contradicting each other.",
    ],
    board: ENGLISH_BOARD,
  },
  hi: {
    nativeLabel: "हिन्दी",
    captions: [
      "आइए normalization से शुरू करें — अपने डेटा को इस तरह व्यवस्थित करना ताकि कुछ भी दो बार स्टोर न हो।",
      "पहला कदम first normal form है, जहां हर कॉलम में केवल एक ही मान होता है।",
      "फिर second normal form में partial dependencies को हटाया जाता है जो किसी key के एक हिस्से पर निर्भर करती हैं।",
      "और third normal form में transitive dependencies को खत्म किया जाता है।",
      "इसका फायदा: redundancy खत्म हो जाती है, और आपके updates एक दूसरे के विरोध में नहीं आते हैं।",
    ],
    board: {
      title: "सामान्यीकरण",
      terms: ["Normalization", "Redundancy"],
      notes: ["प्रत्येक कॉलम में केवल एक ही मान होता है", "अपडेट्स एक दूसरे के विरोध में नहीं आते"],
      nodes: ["First normal form", "Second normal form", "Third normal form"],
    },
  },
  te: {
    nativeLabel: "తెలుగు",
    captions: [
      "మనం నార్మలైజేషన్ తో ప్రారంభిద్దాం — మీ డేటాను ఏమీ రెండుసార్లు నిల్వ చేయకుండా అమర్చడం.",
      "మొదటి దశ ఫస్ట్ నార్మల్ ఫారమ్, ఇక్కడ ప్రతి నిలువు వరుస ఒక సింగిల్ విలువను కలిగి ఉంటుంది.",
      "ఆపై సెకండ్ నార్మల్ ఫారమ్ కీ యొక్క భాగంపై పాక్షిక ఆధారపడటాన్ని తొలగిస్తుంది.",
      "మరియు మూడవ నార్మల్ ఫారమ్ పరోక్ష ఆధారపడటాన్ని పోగొడుతుంది.",
      "ప్రతిఫలం: రెడండెన్సీ అదృశ్యమవుతుంది, మీ అప్‌డేట్‌లు ఒకదానికొకటి విరుద్ధంగా ఆగిపోతాయి.",
    ],
    board: {
      title: "నార్మలైజేషన్",
      terms: ["నార్మలైజేషన్", "రెడండెన్సీ"],
      notes: ["ప్రతి నిలువు వరుస ఒక సింగిల్ విలువ", "అప్‌డేట్‌లు ఒకదానికొకటి విరుద్ధంగా ఆగిపోతాయి"],
      nodes: ["ఫస్ట్ నార్మల్ ఫారమ్", "సెకండ్ నార్మల్ ఫారమ్", "మూడవ నార్మల్ ఫారమ్"],
    },
  },
};

const writeOn = {
  initial: { clipPath: "inset(0 100% 0 0)", opacity: 0.35 },
  animate: { clipPath: "inset(0 0% 0 0)", opacity: 1 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

function ChalkMarker() {
  return (
    <motion.span
      layoutId="demo-chalk"
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className="absolute -left-3.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_3px_rgba(103,232,249,0.7)]"
    />
  );
}

function Connector() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" className="overflow-visible">
      <motion.path
        d="M9 0 L9 14"
        stroke="rgb(34 211 238)"
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      <motion.path
        d="M5 11 L9 16 L13 11"
        stroke="rgb(34 211 238)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.2 }}
      />
    </svg>
  );
}

/** Small segmented control used for both language and board-language. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <div className="flex rounded-full bg-white/[0.06] p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "relative rounded-full px-2.5 py-1 text-xs transition-colors",
              value === option.value ? "text-slate-900" : "text-slate-300 hover:text-white"
            )}
          >
            {value === option.value && (
              <motion.span
                layoutId={`seg-${label}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-white"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function BoardDemo({ className }: { className?: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [lang, setLang] = useState<Lang>("en");
  /** Whether the board follows the voice, or stays in English. */
  const [boardNative, setBoardNative] = useState(false);

  // Clock state lives in refs so changing language never restarts the loop.
  const startedAtRef = useRef<number>(0);
  const offsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      setElapsed(LOOP_SEC);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    startedAtRef.current = performance.now();
    let published = -1;
    const tick = () => {
      const seconds = (offsetRef.current + (performance.now() - startedAtRef.current) / 1000) % LOOP_SEC;
      // ~12/s is plenty for writing to land on the right word and costs a
      // fraction of a per-frame state update.
      if (Math.abs(seconds - published) > 0.08 || seconds < published) {
        published = seconds;
        setElapsed(seconds);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      // Remember where we stopped so play/pause resumes rather than restarts.
      offsetRef.current =
        (offsetRef.current + (performance.now() - startedAtRef.current) / 1000) % LOOP_SEC;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [playing]);

  const restart = useCallback(() => {
    offsetRef.current = 0;
    startedAtRef.current = performance.now();
    setElapsed(0);
    setPlaying(true);
  }, []);

  const copy = COPY[lang];
  const board = lang === "en" || boardNative ? copy.board : ENGLISH_BOARD;

  const { shown, activeKey } = useMemo(() => {
    const visible = new Set<string>();
    let active: string | null = null;
    for (const event of EVENTS) {
      if (elapsed >= event.at) {
        visible.add(`${event.lane}:${event.index}`);
        if (elapsed < event.at + EMPHASIS_SEC) active = `${event.lane}:${event.index}`;
      }
    }
    return { shown: visible, activeKey: active };
  }, [elapsed]);

  const captionIndex = useMemo(() => {
    let index = 0;
    CAPTION_AT.forEach((at, i) => {
      if (elapsed >= at) index = i;
    });
    return index;
  }, [elapsed]);

  const isShown = (lane: Lane, index: number) => shown.has(`${lane}:${index}`);
  const isActive = (lane: Lane, index: number) => activeKey === `${lane}:${index}`;
  const progress = Math.min(100, (elapsed / LOOP_SEC) * 100);

  return (
    <div
      className={cn(
        "grain relative overflow-hidden rounded-[1.75rem] border border-white/10",
        "bg-gradient-to-b from-[#0B1120] to-[#0d1426] shadow-float",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />

      {/* controls — the visitor drives this, it is not a video */}
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <Volume2 className="h-3 w-3 text-cyan-400" />
          Voice
        </span>
        <Segmented
          label=""
          value={lang}
          onChange={setLang}
          options={(Object.keys(COPY) as Lang[]).map((code) => ({
            value: code,
            label: COPY[code].nativeLabel,
          }))}
        />
        {lang !== "en" && (
          <Segmented
            label="Board"
            value={boardNative ? "native" : "en"}
            onChange={(next) => setBoardNative(next === "native")}
            options={[
              { value: "en", label: "English" },
              { value: "native", label: copy.nativeLabel },
            ]}
          />
        )}
      </div>

      <div className="relative p-5 sm:p-7">
        <h3 className="font-hand text-2xl font-bold text-slate-50 sm:text-[1.75rem]">{board.title}</h3>
        <div className="mb-6 mt-1.5 h-1 w-24 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" />

        <div className="grid min-h-[13rem] gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <ul className="space-y-2.5 pl-3.5">
              <AnimatePresence>
                {board.terms.map((term, i) =>
                  isShown("term", i) ? (
                    <motion.li key={`${lang}-${boardNative}-${i}`} {...writeOn} className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full transition-colors",
                          isActive("term", i) ? "bg-cyan-300" : "bg-cyan-400/50"
                        )}
                      />
                      <span
                        className={cn(
                          "relative font-hand text-lg transition-colors",
                          isActive("term", i) ? "text-cyan-200" : "text-slate-200"
                        )}
                      >
                        {isActive("term", i) && <ChalkMarker />}
                        {term}
                        {isActive("term", i) && (
                          <motion.span
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            style={{ originX: 0 }}
                            transition={{ duration: 0.35 }}
                            className="absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-gradient-to-r from-cyan-300 to-transparent"
                          />
                        )}
                      </span>
                    </motion.li>
                  ) : null
                )}
              </AnimatePresence>
            </ul>

            <div className="space-y-1.5 border-l-2 border-violet-400/40 pl-3">
              <AnimatePresence>
                {board.notes.map((note, i) =>
                  isShown("note", i) ? (
                    <motion.p
                      key={`${lang}-${boardNative}-${i}`}
                      {...writeOn}
                      className={cn(
                        "font-hand text-[13px] leading-relaxed transition-colors",
                        isActive("note", i) ? "text-slate-200" : "text-slate-400"
                      )}
                    >
                      ✎ {note}
                    </motion.p>
                  ) : null
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <AnimatePresence>
              {board.nodes.map((node, i) =>
                isShown("node", i) ? (
                  <motion.div
                    key={`${lang}-${boardNative}-${i}`}
                    {...writeOn}
                    className="flex w-full flex-col items-center"
                  >
                    {i > 0 && <Connector />}
                    <div
                      className={cn(
                        "relative w-full max-w-[15rem] rounded-xl border-2 px-3 py-2.5 text-center text-[13px] font-semibold text-slate-100",
                        i % 2 ? "border-cyan-400/80 bg-cyan-500/10" : "border-indigo-400/80 bg-indigo-500/15",
                        isActive("node", i) && "ring-2 ring-cyan-300/60"
                      )}
                    >
                      {isActive("node", i) && <ChalkMarker />}
                      {node}
                    </div>
                  </motion.div>
                ) : null
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* the spoken line — the thing the writing is synced to */}
        <div className="mt-6 min-h-[3.5rem] rounded-xl border border-white/[0.07] bg-black/25 px-4 py-2.5">
          <AnimatePresence mode="wait">
            <motion.p
              key={`${lang}-${captionIndex}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-[13px] leading-relaxed text-slate-300"
            >
              {copy.captions[captionIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? "Pause the board" : "Play the board"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={restart}
            aria-label="Restart the board"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.09]">
            <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
