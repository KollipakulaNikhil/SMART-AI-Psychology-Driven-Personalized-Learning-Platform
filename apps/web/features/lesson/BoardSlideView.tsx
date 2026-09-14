"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { staticUrl } from "@/lib/constants";
import type { BoardEvent, BoardEventKind, SlideView } from "@/lib/types";

/**
 * The interactive digital board.
 *
 * Items are not faded in on a timer — each one is WRITTEN at the moment the
 * narrator actually says it, using the timeline the backend aligned to the
 * voice's word boundaries. Whatever is being talked about right now stays
 * underlined, and a chalk marker flies to it, so the board reads as someone
 * teaching rather than a deck advancing.
 */

interface BoardSlideViewProps {
  slide: SlideView;
  /** Seconds into this slide's narration. Infinity shows the finished board. */
  elapsed: number;
  /** Real narration length, used to rescale a timeline built against an estimate. */
  durationSec: number | null;
  onTermClick: (term: string) => void;
}

/**
 * Kalam, loaded via next/font in the root layout. Self-hosting the handwriting
 * face means the board looks identical on every machine instead of depending on
 * whatever cursive font the OS happens to ship — and Kalam covers Devanagari,
 * so a Hindi board stays handwritten rather than falling back to a system face.
 *
 * Telugu and Tamil have no handwriting face here, so they fall through to the
 * system Indic families. Browsers resolve font stacks PER GLYPH, which is what
 * makes a bilingual board work: English terms render in the handwriting face
 * while Telugu notes beside them render in Nirmala UI / Noto, from this one
 * stack and with no per-language branching.
 */
const HAND_FONT =
  "var(--font-hand), 'Segoe Print', 'Bradley Hand', 'Nirmala UI', 'Noto Sans Telugu', 'Noto Sans Tamil', cursive";

/** Written-on effect: the text is wiped in left-to-right, like a hand crossing it. */
const writeOn = {
  initial: { clipPath: "inset(0 100% 0 0)", opacity: 0.4 },
  animate: { clipPath: "inset(0 0% 0 0)", opacity: 1 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

/**
 * A deterministic sub-degree tilt per line. Real handwriting is never perfectly
 * level, and the inconsistency is most of what separates "written" from "typed".
 */
function tilt(seed: number): number {
  return (((seed * 37) % 9) - 4) * 0.11;
}

interface ResolvedEvent extends BoardEvent {
  key: string;
}

const keyOf = (kind: BoardEventKind, index: number) => `${kind}:${index}`;

/**
 * Resolves the slide's board into timed events in player time.
 *
 * The stored timeline is relative to whatever duration was known when it was
 * built (an estimate at content time, the real audio length after narration),
 * so it is rescaled to the duration actually playing. Lessons generated before
 * timelines existed fall back to an even spread — the old behaviour.
 */
function useBoardEvents(slide: SlideView, durationSec: number | null): ResolvedEvent[] {
  return useMemo(() => {
    const board = slide.board;
    if (!board) return [];

    const nodes = board.diagram && board.diagram.type !== "none" ? board.diagram.nodes : [];
    const timeline = board.timeline;

    if (timeline && timeline.events.length > 0) {
      const scale =
        durationSec && durationSec > 0 && timeline.durationSec > 0
          ? durationSec / timeline.durationSec
          : 1;
      return timeline.events.map((event) => ({
        ...event,
        at: event.at * scale,
        until: event.until * scale,
        key: keyOf(event.kind, event.index),
      }));
    }

    const items: { kind: BoardEventKind; index: number }[] = [
      ...board.keyTerms.map((_, index) => ({ kind: "term" as const, index })),
      ...board.notes.map((_, index) => ({ kind: "note" as const, index })),
      ...nodes.map((_, index) => ({ kind: "node" as const, index })),
    ];
    if (items.length === 0) return [];
    const total = durationSec && durationSec > 0 ? durationSec : items.length * 2;
    const step = total / (items.length + 1);
    return items.map((item, i) => ({
      ...item,
      at: step * (i + 1),
      until: step * (i + 2),
      matched: false,
      key: keyOf(item.kind, item.index),
    }));
  }, [slide.board, durationSec]);
}

/** The chalk marker. One instance shared by layoutId, so it flies between items. */
function ChalkMarker() {
  return (
    <motion.span
      layoutId="board-chalk"
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="absolute -left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_3px_rgba(103,232,249,0.65)]"
    />
  );
}

/** Chalk underline that draws itself under whatever is being spoken about. */
function ActiveUnderline() {
  return (
    <motion.span
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ originX: 0 }}
      className="absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-gradient-to-r from-cyan-300 to-transparent"
    />
  );
}

/** Connector between two flow/cycle nodes — stroke-drawn rather than popped in. */
function Connector({ draw }: { draw: boolean }) {
  return (
    <svg width="20" height="26" viewBox="0 0 20 26" className="my-0.5 overflow-visible">
      <motion.path
        d="M10 0 L10 18"
        stroke="rgb(34 211 238)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: draw ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      <motion.path
        d="M5 14 L10 20 L15 14"
        stroke="rgb(34 211 238)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: draw ? 1 : 0, opacity: draw ? 1 : 0 }}
        transition={{ duration: 0.25, delay: 0.22, ease: "easeOut" }}
      />
    </svg>
  );
}

const boxBase =
  "relative rounded-xl border-2 px-4 py-3 text-center text-sm font-semibold text-slate-100 shadow-lg transition-shadow";

function DiagramBoxes({
  type,
  nodes,
  isVisible,
  isActive,
}: {
  type: "flow" | "cycle" | "compare" | "list" | "timeline" | "hierarchy" | "none";
  nodes: string[];
  isVisible: (index: number) => boolean;
  isActive: (index: number) => boolean;
}) {
  const shownCount = nodes.filter((_, i) => isVisible(i)).length;

  const nodeBox = (node: string, i: number, extra: string) => (
    <motion.div
      key={i}
      {...writeOn}
      className={cn(
        boxBase,
        extra,
        isActive(i) && "ring-2 ring-cyan-300/70 shadow-[0_0_22px_rgba(34,211,238,0.28)]"
      )}
      style={{ rotate: `${tilt(i + 3)}deg` }}
    >
      {isActive(i) && <ChalkMarker />}
      {node}
    </motion.div>
  );

  if (type === "compare") {
    const mid = Math.ceil(nodes.length / 2);
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <AnimatePresence>
          {nodes.map((node, i) =>
            isVisible(i) ? (
              <div key={i} style={{ gridColumn: i < mid ? 1 : 2 }}>
                {nodeBox(
                  node,
                  i,
                  i < mid ? "border-indigo-400 bg-indigo-500/15" : "border-cyan-400 bg-cyan-500/10"
                )}
              </div>
            ) : null
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className="flex flex-col gap-2.5">
        <AnimatePresence>
          {nodes.map((node, i) =>
            isVisible(i) ? nodeBox(node, i, "border-indigo-400/70 bg-indigo-500/10 !text-left") : null
          )}
        </AnimatePresence>
      </div>
    );
  }

  // timeline — a vertical rail with a dot per event, dot glows while active.
  if (type === "timeline") {
    return (
      <div className="relative flex flex-col gap-4 pl-7">
        <div className="absolute bottom-2 left-[9px] top-2 w-px bg-gradient-to-b from-cyan-400/70 via-violet-400/40 to-transparent" />
        <AnimatePresence>
          {nodes.map((node, i) =>
            isVisible(i) ? (
              <div key={i} className="relative flex items-start">
                <span
                  className={cn(
                    "absolute -left-7 top-3 h-3.5 w-3.5 shrink-0 rounded-full border-2 bg-[#0B1120] transition-shadow",
                    isActive(i)
                      ? "border-cyan-300 shadow-[0_0_10px_2px_rgba(103,232,249,0.6)]"
                      : "border-cyan-400/60"
                  )}
                />
                <div className="w-full">
                  {nodeBox(node, i, "!text-left border-cyan-400/60 bg-cyan-500/10")}
                </div>
              </div>
            ) : null
          )}
        </AnimatePresence>
      </div>
    );
  }

  // hierarchy — a top-down breakdown, each level narrower than the last.
  if (type === "hierarchy") {
    return (
      <div className="flex flex-col items-center">
        {nodes.map((node, i) =>
          isVisible(i) ? (
            <div
              key={i}
              className="flex w-full flex-col items-center"
              style={{ width: `${Math.max(48, 100 - i * 13)}%` }}
            >
              {i > 0 && <Connector draw={isVisible(i)} />}
              <div className="w-full">
                {nodeBox(
                  node,
                  i,
                  i === 0
                    ? "border-violet-400 bg-violet-500/15"
                    : i % 2
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-indigo-400 bg-indigo-500/15"
                )}
              </div>
            </div>
          ) : null
        )}
      </div>
    );
  }

  // flow / cycle — a vertical chain whose arrows draw themselves in.
  return (
    <div className="flex flex-col items-center">
      {nodes.map((node, i) =>
        isVisible(i) ? (
          <div key={i} className="flex w-full flex-col items-center">
            {i > 0 && <Connector draw={isVisible(i)} />}
            <div className="w-full max-w-md">
              {nodeBox(
                node,
                i,
                i % 2 ? "border-cyan-400 bg-cyan-500/10" : "border-indigo-400 bg-indigo-500/15"
              )}
            </div>
          </div>
        ) : null
      )}
      {type === "cycle" && shownCount >= nodes.length && nodes.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 flex items-center gap-1.5 text-xs text-violet-300"
        >
          <RotateCw className="h-3.5 w-3.5" /> loops back to the start
        </motion.div>
      )}
    </div>
  );
}

export function BoardSlideView({ slide, elapsed, durationSec, onTermClick }: BoardSlideViewProps) {
  const board = slide.board;
  const terms = board?.keyTerms ?? [];
  const notes = board?.notes ?? [];
  const diagram = board?.diagram;
  const nodes = diagram && diagram.type !== "none" ? diagram.nodes : [];

  const events = useBoardEvents(slide, durationSec);

  const { visible, activeKey } = useMemo(() => {
    const shown = new Set<string>();
    let current: string | null = null;
    for (const event of events) {
      if (elapsed >= event.at) {
        shown.add(event.key);
        // The last event whose window we're inside wins, so a long note doesn't
        // keep the marker after the narrator has moved to the next item.
        if (elapsed < event.until) current = event.key;
      }
    }
    return { visible: shown, activeKey: current };
  }, [events, elapsed]);

  const isVisible = (kind: BoardEventKind, index: number) => visible.has(keyOf(kind, index));
  const isActive = (kind: BoardEventKind, index: number) => activeKey === keyOf(kind, index);

  const imageUrl = staticUrl(slide.imageUrl);
  const anyNoteVisible = notes.some((_, i) => isVisible("note", i));

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0B1120] to-[#0F172A] p-6 sm:p-8">
      {/* faint grid, like a board */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* chalk dust — uneven brightness so the surface doesn't read as flat glass */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 22% 18%, #fff 0%, transparent 45%), radial-gradient(ellipse at 78% 72%, #fff 0%, transparent 40%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />

      <div className="relative">
        <h2
          className="mb-1 text-2xl font-bold text-slate-50 sm:text-3xl"
          style={{ fontFamily: HAND_FONT }}
        >
          {slide.title}
        </h2>
        <div className="mb-6 h-1.5 w-28 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: key terms + notes */}
          <div className="space-y-5">
            {terms.some((_, i) => isVisible("term", i)) && (
              <p className="pl-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Key terms
              </p>
            )}
            <ul className="space-y-2.5 pl-4">
              <AnimatePresence>
                {/* Keyed by position — the model can repeat a key term, and a
                    duplicate React key drops one of the list items. */}
                {terms.map((term, termIndex) =>
                  isVisible("term", termIndex) ? (
                    <motion.li key={termIndex} {...writeOn} className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                          isActive("term", termIndex) ? "bg-cyan-300" : "bg-cyan-400/60"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => onTermClick(term)}
                        className={cn(
                          "group relative flex items-center gap-1.5 text-left text-lg transition-colors hover:text-cyan-300",
                          isActive("term", termIndex) ? "text-cyan-200" : "text-slate-200"
                        )}
                        style={{
                          fontFamily: HAND_FONT,
                          rotate: `${tilt(termIndex)}deg`,
                        }}
                        title={`Ask the tutor about "${term}"`}
                      >
                        {isActive("term", termIndex) && <ChalkMarker />}
                        {term}
                        <HelpCircle className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        <AnimatePresence>
                          {isActive("term", termIndex) && <ActiveUnderline />}
                        </AnimatePresence>
                      </button>
                    </motion.li>
                  ) : null
                )}
              </AnimatePresence>
            </ul>

            {anyNoteVisible && (
              <div className="space-y-2 border-l-2 border-violet-400/40 pl-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-400/70">
                  Notes
                </p>
                <AnimatePresence>
                  {notes.map((note, i) =>
                    isVisible("note", i) ? (
                      <motion.p
                        key={i}
                        {...writeOn}
                        className={cn(
                          "relative text-sm leading-relaxed transition-colors",
                          isActive("note", i) ? "text-slate-200" : "text-slate-400"
                        )}
                        style={{ fontFamily: HAND_FONT }}
                      >
                        ✎ {note}
                        <AnimatePresence>{isActive("note", i) && <ActiveUnderline />}</AnimatePresence>
                      </motion.p>
                    ) : null
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Right: diagram, or a real photo when there's no diagram */}
          {nodes.length > 0 ? (
            <div className="flex items-center justify-center">
              <div className="w-full">
                <DiagramBoxes
                  type={diagram!.type}
                  nodes={nodes}
                  isVisible={(i) => isVisible("node", i)}
                  isActive={(i) => isActive("node", i)}
                />
              </div>
            </div>
          ) : (
            imageUrl && (
              <div className="flex items-center justify-center">
                <figure className="w-full">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={slide.title}
                      className="aspect-[4/3] w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {slide.imageCredit && (
                    <figcaption className="mt-1 text-right text-[11px] text-slate-500">
                      {slide.imageCredit}
                    </figcaption>
                  )}
                </figure>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
