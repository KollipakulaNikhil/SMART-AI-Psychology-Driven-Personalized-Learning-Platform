import type { SlideBoard } from "../models/Presentation";
import type { WordTiming } from "./tts.service";

/**
 * Turns a slide's board content into a TIMED script of board actions — when each
 * term gets written, and while it is still being talked about.
 *
 * The timeline is derived here rather than asked of the content model on
 * purpose. Two reasons, both practical:
 *
 *  1. The free Groq tier's per-minute token budget is the binding constraint on
 *     this project. A generated timeline would add tokens to every lesson prompt
 *     and give a small model one more structure to get wrong (and an out-of-order
 *     timeline is worse than no timeline).
 *  2. The board already says WHAT goes up; the script already says WHEN it is
 *     spoken. Aligning the two is deterministic, costs nothing, and works on
 *     lessons that were generated before this feature existed.
 *
 * So: find where each board item's words appear in the narration, and write it
 * there. Anything we can't locate is interpolated between the items we could.
 */

export type BoardEventKind = "term" | "note" | "node";

export interface BoardEvent {
  kind: BoardEventKind;
  /** Position within its own list (keyTerms / notes / diagram.nodes). */
  index: number;
  /** Seconds into this slide's narration when the item is written. */
  at: number;
  /** Seconds when the narrator moves on — the item is emphasised until then. */
  until: number;
  /** False when the item's words were not found and its time was interpolated. */
  matched: boolean;
}

export interface BoardTimeline {
  events: BoardEvent[];
  durationSec: number;
  /** Whether times came from real word boundaries or were spread over the duration. */
  source: "spoken" | "estimated";
}

/** Items are written in the same order the board reveals them. */
interface BoardItem {
  kind: BoardEventKind;
  index: number;
  text: string;
}

/**
 * Words carrying no matching signal. Kept deliberately small: this only needs to
 * stop "the"/"is"/"of" from making every window look like a match, not to be a
 * linguistically complete stoplist.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "for", "from", "has", "have",
  "how", "in", "into", "is", "it", "its", "of", "on", "or", "our", "so", "that", "the", "their",
  "them", "then", "there", "these", "they", "this", "to", "up", "was", "we", "were", "what", "when",
  "which", "will", "with", "you", "your",
]);

/**
 * Lowercase, strip punctuation, and fold Latin diacritics. The combining-mark
 * range cleared here (U+0300–U+036F) is Latin-only, so Indic matras — which are
 * meaning-bearing and live in their own blocks — survive untouched.
 */
/** Latin combining marks, written as escapes so the source stays pure ASCII. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function normalize(word: string): string {
  return word
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[\p{P}\p{S}]/gu, "")
    .toLowerCase()
    .trim();
}

/** Content tokens of a board item — what we actually try to find in the script. */
function contentTokens(text: string): string[] {
  const tokens = text
    .split(/\s+/)
    .map(normalize)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
  // An item made entirely of stopwords ("How to do it") would otherwise become
  // unmatchable; fall back to whatever non-empty tokens it has.
  if (tokens.length > 0) return tokens;
  return text.split(/\s+/).map(normalize).filter(Boolean);
}

/**
 * Spreads a script's words evenly across a known duration. Used when the voice
 * reports no boundaries (ElevenLabs) — far better than nothing, because the
 * result is still anchored to the real measured audio length.
 */
/**
 * Rough spoken length of a script, for slides that have no audio yet (or whose
 * narration failed and will be read by the browser voice). ~2.5 words/second is
 * measured teacher pace; the player rescales the timeline to the real duration
 * once it knows it, so this only needs to get the proportions right.
 */
export function estimateNarrationDuration(script: string, speed: number): number {
  const words = script.split(/\s+/).filter(Boolean).length;
  return Math.max(4, words / (2.5 * Math.max(0.5, speed)));
}

export function estimateWordTimings(script: string, durationSec: number): WordTiming[] {
  const words = script.split(/\s+/).filter(Boolean);
  if (words.length === 0 || durationSec <= 0) return [];
  const per = durationSec / words.length;
  return words.map((word, i) => ({ word, start: i * per, end: (i + 1) * per }));
}

function boardItems(board: SlideBoard | undefined): BoardItem[] {
  if (!board) return [];
  const items: BoardItem[] = [];
  // Reveal order is terms → notes → diagram nodes; the timeline must not
  // reorder it, because the board layout builds up in that order.
  board.keyTerms?.forEach((text, index) => items.push({ kind: "term", index, text }));
  board.notes?.forEach((text, index) => items.push({ kind: "note", index, text }));
  if (board.diagram && board.diagram.type !== "none") {
    board.diagram.nodes?.forEach((text, index) => items.push({ kind: "node", index, text }));
  }
  return items;
}

interface Match {
  startWord: number;
  endWord: number;
  score: number;
}

/**
 * Finds where an item is spoken, searching only at or after `from` so items can
 * never be written out of order — a term repeated later in the script must not
 * drag its board entry backwards past an earlier item.
 */
function findMatch(tokens: string[], words: string[], from: number): Match | null {
  if (tokens.length === 0) return null;
  const unique = new Set(tokens);
  // Look at a window roughly the size of the item, with headroom for the filler
  // words a narrator puts between them ("the idea of X, which is…").
  const window = Math.min(words.length, Math.max(4, tokens.length * 3));
  let best: Match | null = null;

  for (let start = from; start < words.length; start++) {
    const end = Math.min(words.length, start + window);
    const seen = new Set<string>();
    let first = -1;
    let last = start;
    for (let i = start; i < end; i++) {
      if (unique.has(words[i]) && !seen.has(words[i])) {
        seen.add(words[i]);
        if (first < 0) first = i;
        last = i;
      }
    }
    if (first < 0) continue;
    const score = seen.size / unique.size;
    // Anchor to the first word of the item that is actually SPOKEN, not to the
    // start of the window it was found in — otherwise the board writes a term
    // a second or two before the narrator reaches it.
    if (!best || score > best.score) best = { startWord: first, endWord: last, score };
    // A full hit can't be beaten, and taking the earliest one keeps the board
    // in step with the narrator rather than lagging behind a later repetition.
    if (score === 1) break;
  }

  // Below this, the "match" is one incidental shared word and placing the item
  // there would be worse than interpolating it.
  const MIN_SCORE = 0.6;
  return best && best.score >= MIN_SCORE ? best : null;
}

/**
 * Builds the timed board script for one slide.
 *
 * `wordTimings` should be the real boundaries when the voice provided them; pass
 * an empty array with a duration to fall back to even distribution.
 */
export function buildBoardTimeline(
  board: SlideBoard | undefined,
  script: string,
  durationSec: number,
  wordTimings: WordTiming[]
): BoardTimeline {
  const spoken = wordTimings.length > 0;
  const timings = spoken ? wordTimings : estimateWordTimings(script, durationSec);
  const total = durationSec > 0 ? durationSec : timings.at(-1)?.end ?? 0;
  const items = boardItems(board);

  const empty: BoardTimeline = {
    events: [],
    durationSec: total,
    source: spoken ? "spoken" : "estimated",
  };
  if (items.length === 0 || timings.length === 0 || total <= 0) return empty;

  const words = timings.map((timing) => normalize(timing.word));

  /**
   * Ordering is enforced per board REGION, not across the whole slide.
   *
   * The key-term list, the notes column and the diagram are three separate
   * areas of the board, and a teacher moves between them freely — writing a
   * term on the left, drawing a node on the right, then coming back. Within one
   * region order still matters (a list fills top-down, a flow chain builds in
   * sequence), so each region carries its own search cursor.
   *
   * Sharing a single cursor across regions was measured to be badly wrong: a
   * closing key term matching near the end of the script dragged every diagram
   * node after it, so the whole diagram appeared at once in the last seconds
   * instead of being drawn while it was being explained.
   */
  const laneEvents: BoardEvent[] = [];

  for (const lane of ["term", "note", "node"] as const) {
    const laneItems = items.filter((item) => item.kind === lane);
    if (laneItems.length === 0) continue;

    let cursor = 0;
    const events: BoardEvent[] = laneItems.map((item) => {
      const match = findMatch(contentTokens(item.text), words, cursor);
      if (!match) {
        return { kind: item.kind, index: item.index, at: -1, until: -1, matched: false };
      }
      // Advance past the whole matched phrase, not just its first word. Items in
      // one region often share vocabulary ("first/second/third normal form"), and
      // a looser cursor lets the next one re-match the previous one's words.
      cursor = Math.max(cursor, match.endWord + 1);
      return {
        kind: item.kind,
        index: item.index,
        at: timings[match.startWord].start,
        until: timings[Math.min(match.endWord, timings.length - 1)].end,
        matched: true,
      };
    });

    // Unmatched runs sit evenly between the surrounding anchors in the same
    // region. The ends of the slide count as anchors too, so a region where
    // nothing matched still spreads across the narration instead of piling up.
    for (let i = 0; i < events.length; i++) {
      if (events[i].matched) continue;
      let runEnd = i;
      while (runEnd < events.length && !events[runEnd].matched) runEnd++;
      const before = i > 0 ? events[i - 1].at : 0;
      const after = runEnd < events.length ? events[runEnd].at : total;
      const gap = (after - before) / (runEnd - i + 1);
      for (let j = i; j < runEnd; j++) {
        events[j].at = before + gap * (j - i + 1);
        events[j].until = events[j].at + gap;
      }
      i = runEnd - 1;
    }

    // Keep this region strictly increasing and inside the audio. Two items in
    // one list landing together would pop as a pair and lose the written-one-
    // at-a-time feel.
    const MIN_GAP = 0.35;
    let previous = -Infinity;
    for (const event of events) {
      event.at = Math.min(Math.max(0, event.at), Math.max(0, total - 0.2));
      if (event.at <= previous) event.at = previous + MIN_GAP;
      event.at = Math.min(event.at, Math.max(0, total - 0.05));
      previous = event.at;
      event.until = Math.min(Math.max(event.until, event.at + 0.6), total);
    }

    laneEvents.push(...events);
  }

  // Chronological, so the player can take the last event whose window contains
  // the playhead as "what is being talked about right now".
  laneEvents.sort((a, b) => a.at - b.at);

  // Two regions can legitimately land on the same instant; nudge the later one
  // so the writing still reads as sequential rather than simultaneous.
  const TIE_GAP = 0.12;
  for (let i = 1; i < laneEvents.length; i++) {
    if (laneEvents[i].at - laneEvents[i - 1].at < TIE_GAP) {
      laneEvents[i].at = Math.min(laneEvents[i - 1].at + TIE_GAP, total);
      laneEvents[i].until = Math.max(laneEvents[i].until, laneEvents[i].at + 0.6);
    }
  }

  return { events: laneEvents, durationSec: total, source: spoken ? "spoken" : "estimated" };
}
