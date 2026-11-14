"use client";

import { useMemo } from "react";
import type { Theme } from "./theme";

const MAX_WORDS = 11;

interface Chunk {
  words: string[];
  /** Start and end as a fraction of the narration (by word count). */
  from: number;
  to: number;
}

/** Splits the script into short, readable caption lines, timed by word share. */
export function chunkScript(script: string): Chunk[] {
  const words = script.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let startIdx = 0;
  const flush = (endIdx: number) => {
    if (current.length === 0) return;
    chunks.push({ words: current, from: startIdx / words.length, to: endIdx / words.length });
    current = [];
    startIdx = endIdx;
  };
  words.forEach((word, i) => {
    current.push(word);
    const sentenceEnd = /[.!?।…]["')\]]?$/.test(word);
    const clauseEnd = /[,;:]$/.test(word) && current.length >= 6;
    if (sentenceEnd || clauseEnd || current.length >= MAX_WORDS) flush(i + 1);
  });
  flush(words.length);
  return chunks;
}

/** Karaoke-style captions: the line being spoken, with the current word lit. */
export function Captions({ script, progress, theme }: { script: string; progress: number; theme: Theme }) {
  const chunks = useMemo(() => chunkScript(script), [script]);
  const chunk = chunks.find((c) => progress < c.to) ?? chunks[chunks.length - 1];
  if (!chunk) return null;

  const span = Math.max(0.0001, chunk.to - chunk.from);
  const within = Math.min(1, Math.max(0, (progress - chunk.from) / span));
  const lit = Math.floor(within * chunk.words.length);

  return (
    <div
      className="pointer-events-none absolute bottom-[2cqw] left-[27cqw] z-20 w-[69cqw] rounded-[1.2cqw] px-[2cqw] py-[1.1cqw] text-center backdrop-blur-md"
      style={{ background: "rgba(8,6,24,.62)", fontSize: "2.1cqw", lineHeight: 1.35 }}
    >
      {chunk.words.map((w, i) => (
        <span
          key={i}
          className="font-semibold transition-colors duration-150"
          style={{
            color: i <= lit ? "#fff" : "rgba(255,255,255,.42)",
            textShadow: i === lit ? `0 0 14px ${theme.accent}` : undefined,
          }}
        >
          {w}{" "}
        </span>
      ))}
    </div>
  );
}
