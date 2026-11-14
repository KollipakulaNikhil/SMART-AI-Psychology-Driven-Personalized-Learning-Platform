"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, BookMarked, Eye, HelpCircle, RotateCcw, Trophy } from "lucide-react";
import type { SlideView } from "@/lib/types";
import type { Theme } from "./theme";

/**
 * The stop between chapters. A video that only ever plays is easy to stop
 * listening to; a teacher pauses, says what to hold on to, and asks something
 * before moving on. This is that pause — and it is also where the written
 * matter the narration never shows (definitions, key facts, the common
 * mistake) gets onto the screen.
 */
export interface Recap {
  facts: string[];
  terms: { term: string; meaning: string }[];
  mistake: string | null;
  check: { question: string; answer: string } | null;
}

/** Null when the slide has nothing worth stopping for. */
export function recapFor(slide: SlideView): Recap | null {
  const notes = slide.studyNotes;
  const board = slide.board;

  const facts = (
    notes?.keyFacts.length ? notes.keyFacts : board?.notes.length ? board.notes : slide.points
  ).slice(0, 2);
  const terms = (notes?.definitions ?? []).slice(0, 2);
  const mistake = notes?.commonMistake?.trim() || null;

  let check: Recap["check"] = null;
  if (notes?.practice) {
    check = notes.practice;
  } else if (board?.keyTerms[0]) {
    const term = board.keyTerms[0];
    const meaning = notes?.definitions.find((d) => d.term.toLowerCase() === term.toLowerCase())?.meaning;
    check = {
      question: `In your own words: what is "${term}", and why does it matter in this chapter?`,
      answer: meaning ?? slide.points.slice(0, 2).join(" "),
    };
  } else if (slide.points.length > 0) {
    check = {
      question: `Without looking back: what were the main ideas of "${slide.title}"?`,
      answer: slide.points.slice(0, 3).join(" "),
    };
  }
  if (check && !check.answer.trim()) check = null;

  if (facts.length === 0 && !check) return null;
  return { facts, terms, mistake, check };
}

/** Readable on a phone-width stage, proportional on a large one. */
const fs = (cqw: number, min = 11, max = 22): CSSProperties => ({ fontSize: `clamp(${min}px, ${cqw}cqw, ${max}px)` });

const panel: CSSProperties = {
  background: "rgba(255,255,255,0.09)",
  border: "1px solid rgba(255,255,255,0.18)",
};

function Label({ icon, color, children }: { icon: ReactNode; color: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-[0.6em] font-bold uppercase tracking-[0.18em]" style={{ ...fs(1.05, 10, 14), color }}>
      {icon}
      {children}
    </p>
  );
}

function StageButton({
  onClick,
  primary,
  theme,
  children,
}: {
  onClick: () => void;
  primary?: boolean;
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-[0.5em] rounded-full px-[1.2em] py-[0.5em] font-bold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{
        ...fs(1.3, 12, 17),
        ...(primary
          ? { background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: "#0f172a" }
          : { ...panel, color: "#fff" }),
      }}
    >
      {children}
    </button>
  );
}

interface ChapterRecapProps {
  recap: Recap;
  theme: Theme;
  /** Zero-based index of the chapter that just finished. */
  chapter: number;
  total: number;
  nextTitle: string | null;
  onContinue: () => void;
  onRewatch: () => void;
}

export function ChapterRecap({ recap, theme, chapter, total, nextTitle, onContinue, onRewatch }: ChapterRecapProps) {
  const [revealed, setRevealed] = useState(false);
  const iconSize = { width: "1.2em", height: "1.2em" };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      // The stage toggles playback on click; this card is for reading and answering.
      onClick={(event) => event.stopPropagation()}
      className="absolute inset-0 z-40 flex cursor-default flex-col overflow-y-auto text-white"
      style={{ background: "rgba(6,6,22,0.86)", backdropFilter: "blur(8px)", padding: "clamp(10px, 2.6cqw, 36px)" }}
      role="dialog"
      aria-label={`Chapter ${chapter + 1} recap`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold uppercase tracking-[0.24em]" style={{ ...fs(1.15, 10, 15), color: theme.accent2 }}>
          Pause · Chapter {chapter + 1} of {total} done
        </p>
        <div className="flex gap-[0.4cqw]" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: "clamp(8px, 2.2cqw, 28px)",
                height: "clamp(3px, 0.45cqw, 6px)",
                background: i <= chapter ? theme.accent2 : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-[1.6cqw] grid flex-1 content-start gap-[1.6cqw] sm:grid-cols-2">
        {/* What to hold on to */}
        <div className="flex flex-col gap-[1.2cqw]">
          {recap.facts.length > 0 && (
            <div className="rounded-[1.2cqw] p-[1.4cqw]" style={panel}>
              <Label icon={<BookMarked style={iconSize} />} color={theme.accent}>
                Remember
              </Label>
              <ul className="mt-[0.8cqw] space-y-[0.6cqw]">
                {recap.facts.map((fact, i) => (
                  <li key={i} className="font-semibold leading-snug" style={fs(1.45, 12, 19)}>
                    {fact}
                  </li>
                ))}
              </ul>
              {recap.terms.map((entry, i) => (
                <p key={i} className="mt-[0.7cqw] leading-snug text-white/80" style={fs(1.25, 11, 17)}>
                  <span className="font-bold" style={{ color: theme.accent2 }}>
                    {entry.term}
                  </span>{" "}
                  — {entry.meaning}
                </p>
              ))}
            </div>
          )}
          {recap.mistake && (
            <div
              className="rounded-[1.2cqw] p-[1.4cqw]"
              style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.45)" }}
            >
              <Label icon={<AlertTriangle style={iconSize} />} color="#fcd34d">
                Careful here
              </Label>
              <p className="mt-[0.7cqw] leading-snug" style={fs(1.3, 11, 17)}>
                {recap.mistake}
              </p>
            </div>
          )}
        </div>

        {/* One question before moving on */}
        {recap.check && (
          <div className="flex flex-col rounded-[1.2cqw] p-[1.4cqw]" style={{ ...panel, borderColor: theme.accent }}>
            <Label icon={<HelpCircle style={iconSize} />} color={theme.accent}>
              Quick check
            </Label>
            <p className="mt-[0.8cqw] font-bold leading-snug" style={fs(1.6, 13, 21)}>
              {recap.check.question}
            </p>
            {revealed ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-[1cqw] leading-snug text-white/85"
                style={{ ...fs(1.3, 11, 17), borderLeft: `3px solid ${theme.accent2}`, paddingLeft: "0.8em" }}
              >
                {recap.check.answer}
              </motion.p>
            ) : (
              <div className="mt-[1.1cqw]">
                <p className="mb-[0.8cqw] text-white/60" style={fs(1.15, 10, 15)}>
                  Answer it in your head first.
                </p>
                <StageButton theme={theme} onClick={() => setRevealed(true)}>
                  <Eye style={iconSize} /> Show the answer
                </StageButton>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-[1.6cqw] flex flex-wrap items-center justify-between gap-2">
        <StageButton theme={theme} onClick={onRewatch}>
          <RotateCcw style={iconSize} /> Rewatch this chapter
        </StageButton>
        <StageButton theme={theme} primary onClick={onContinue}>
          <span className="max-w-[38cqw] truncate">{nextTitle ? `Next: ${nextTitle}` : "Continue"}</span>
          <ArrowRight style={iconSize} />
        </StageButton>
      </div>
    </motion.div>
  );
}

/** Shown when the last chapter finishes: what was covered, and what to do with it. */
export function EndCard({
  theme,
  chapters,
  hasQuiz,
  onReplay,
  onJump,
}: {
  theme: Theme;
  chapters: string[];
  hasQuiz: boolean;
  onReplay: () => void;
  onJump: (index: number) => void;
}) {
  const iconSize = { width: "1.2em", height: "1.2em" };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(event) => event.stopPropagation()}
      className="absolute inset-0 z-40 flex cursor-default flex-col overflow-y-auto text-white"
      style={{ background: "rgba(6,6,22,0.88)", backdropFilter: "blur(8px)", padding: "clamp(10px, 2.6cqw, 36px)" }}
      role="dialog"
      aria-label="Lesson complete"
    >
      <p className="flex items-center gap-[0.6em] font-display font-extrabold" style={fs(2.6, 16, 34)}>
        <Trophy style={{ width: "1.1em", height: "1.1em", color: theme.accent2 }} /> Lesson complete
      </p>
      <p className="mt-[0.4cqw] text-white/70" style={fs(1.25, 11, 17)}>
        You covered {chapters.length} chapter{chapters.length === 1 ? "" : "s"}. Tap one to watch it again.
      </p>

      <ol className="mt-[1.4cqw] grid flex-1 content-start gap-[0.7cqw] sm:grid-cols-2">
        {chapters.map((title, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onJump(i)}
              className="flex w-full items-center gap-[0.8em] rounded-[1cqw] px-[1em] py-[0.6em] text-left transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ ...panel, ...fs(1.3, 11, 17) }}
            >
              <span className="font-black tabular-nums" style={{ color: theme.accent2 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="truncate font-semibold">{title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-[1.4cqw] flex flex-wrap items-center justify-between gap-2">
        <StageButton theme={theme} onClick={onReplay}>
          <RotateCcw style={iconSize} /> Watch again
        </StageButton>
        {hasQuiz && (
          <a
            href="#quiz"
            className="inline-flex min-h-9 items-center gap-[0.5em] rounded-full px-[1.2em] py-[0.5em] font-bold text-slate-900 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{ ...fs(1.3, 12, 17), background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
          >
            Test yourself on this <ArrowRight style={iconSize} />
          </a>
        )}
      </div>
    </motion.div>
  );
}
