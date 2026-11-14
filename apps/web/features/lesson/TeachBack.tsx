"use client";

import { useEffect, useRef, useState } from "react";
import { Check, GraduationCap, Mic, MicOff, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SlideView } from "@/lib/types";

/**
 * Teach-back: the board in reverse. Instead of the narrator writing the board
 * while the learner listens, the board starts empty and writes itself from the
 * learner's own explanation — each item appears the moment they say it.
 *
 * Matching is plain token overlap done in the browser, the same idea the server
 * uses to align the board to the narrator. That keeps it instant and free: the
 * board has to react mid-sentence, which a model round-trip can't do.
 */

export interface TeachItem {
  key: string;
  text: string;
}

const STOPWORDS = new Set(
  "a an and are as at be but by can for from has have how in into is it its of on or so than that the their then there these this to was what when where which who why will with you your".split(
    " "
  )
);

/** Lowercased content words. */
function tokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      // Latin accents only — Indic vowel signs live outside this range and must survive.
      .replace(/[̀-ͯ]/g, "")
      .split(/[^\p{L}\p{N}\p{M}]+/u)
      .filter((word) => word.length > 1 && !STOPWORDS.has(word))
  );
}

/**
 * Same word in a different form: "cell"/"cells", "absorb"/"absorbing",
 * "absorbed"/"absorbs" — but not "plant"/"planet". A learner explaining in
 * their own words rarely uses the exact inflection written on the board.
 */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.length - short.length <= 3 && long.startsWith(short)) return true;
  let common = 0;
  while (common < short.length && short[common] === long[common]) common += 1;
  return common >= 6 && long.length - common <= 3;
}

/** Every board item on the slide, keyed the same way the board keys them. */
export function teachItemsFor(slide: SlideView): TeachItem[] {
  const board = slide.board;
  if (!board) return [];
  const nodes = board.diagram && board.diagram.type !== "none" ? board.diagram.nodes : [];
  return [
    ...board.keyTerms.map((text, i) => ({ key: `term:${i}`, text })),
    ...board.notes.map((text, i) => ({ key: `note:${i}`, text })),
    ...nodes.map((text, i) => ({ key: `node:${i}`, text })),
  ];
}

/**
 * Which items the explanation has covered. Short items (a key term) need most
 * of their words said; a full written note only needs half, since nobody
 * recites a sentence word for word when explaining it themselves.
 */
export function coveredKeys(items: TeachItem[], explanation: string): Set<string> {
  const said = Array.from(new Set(tokens(explanation)));
  const covered = new Set<string>();
  if (said.length === 0) return covered;
  for (const item of items) {
    const words = Array.from(new Set(tokens(item.text)));
    if (words.length === 0) continue;
    const hits = words.filter((word) => said.some((spoken) => sameWord(word, spoken))).length;
    const needed = words.length <= 3 ? Math.ceil(words.length * 0.67) : Math.ceil(words.length * 0.5);
    if (hits >= needed) covered.add(item.key);
  }
  return covered;
}

/* Minimal typing for the Web Speech recognition API, which TypeScript's DOM lib omits. */
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface TeachBackProps {
  slideTitle: string;
  /** Language written on the board — what the learner's words are matched against. */
  locale: string;
  total: number;
  coveredCount: number;
  /** Typed (and finished spoken) explanation. */
  text: string;
  onTextChange: (text: string) => void;
  /** Words still being recognised — matched live but not yet committed. */
  onInterimChange: (interim: string) => void;
  checked: boolean;
  onCheck: () => void;
  onRetry: () => void;
  onExit: () => void;
  onAskTutor: (question: string) => void;
}

export function TeachBack({
  slideTitle,
  locale,
  total,
  coveredCount,
  text,
  onTextChange,
  onInterimChange,
  checked,
  onCheck,
  onRetry,
  onExit,
  onAskTutor,
}: TeachBackProps) {
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  // The recogniser's callbacks outlive renders, so they read the latest text here.
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    setMicSupported(recognitionCtor() !== null);
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.stop();
      }
    };
  }, []);

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const startListening = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = locale;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      let finished = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finished += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (finished.trim()) onTextChange(`${textRef.current} ${finished}`.trim());
      onInterimChange(interim);
    };
    const finish = () => {
      setListening(false);
      onInterimChange("");
      recognitionRef.current = null;
    };
    recognition.onend = finish;
    recognition.onerror = finish;
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      finish();
    }
  };

  const check = () => {
    stopListening();
    onCheck();
  };

  const missed = total - coveredCount;
  const askTutor = () => {
    // The tutor endpoint caps a message at 600 characters.
    const said = text.trim().slice(0, 380);
    onAskTutor(
      `I tried to teach "${slideTitle.slice(0, 80)}" in my own words: "${said}". What did I get right, what is wrong, and what did I miss?`
    );
  };

  return (
    <div className="mt-3 border-l-2 border-mark bg-foreground/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-mono">
            <span className="text-primary">Teach it back</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {checked
              ? missed === 0
                ? "You rebuilt the whole board from memory."
                : "Shown in amber: what you left out. Tap a note or diagram box to hear that part again."
              : "The board is wiped. Explain this slide as if you were the teacher — it writes itself back as you cover each idea."}
          </p>
        </div>
        <p className="shrink-0 font-display text-3xl leading-none tabular-nums">
          {coveredCount}
          <span className="text-base text-muted-foreground"> / {total}</span>
        </p>
      </div>

      <div className="mt-3 h-1.5 w-full bg-foreground/10">
        <div
          className={cn("h-full transition-all duration-300", checked && missed > 0 ? "bg-amber" : "bg-primary")}
          style={{ width: `${total > 0 ? (coveredCount / total) * 100 : 0}%` }}
        />
      </div>

      <textarea
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        disabled={checked}
        rows={3}
        aria-label="Your explanation"
        placeholder={
          micSupported
            ? "Type your explanation, or press the mic and say it out loud…"
            : "Type your explanation in your own words…"
        }
        className="mt-3 w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!checked && micSupported && (
          <Button
            variant={listening ? "gradient" : "outline"}
            size="sm"
            className="min-h-11"
            onClick={listening ? stopListening : startListening}
            aria-pressed={listening}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {listening ? "Stop listening" : "Speak"}
          </Button>
        )}
        {!checked ? (
          <Button variant="gradient" size="sm" className="min-h-11" onClick={check} disabled={!text.trim()}>
            <Check className="h-4 w-4" /> Check what I missed
          </Button>
        ) : (
          <>
            <Button variant="gradient" size="sm" className="min-h-11" onClick={askTutor} disabled={!text.trim()}>
              <GraduationCap className="h-4 w-4" /> Get tutor feedback
            </Button>
            <Button variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" className="ml-auto min-h-11" onClick={onExit}>
          <X className="h-4 w-4" /> Back to the lesson
        </Button>
      </div>
    </div>
  );
}
