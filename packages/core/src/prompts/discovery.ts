import { z } from "zod";
import type { KnowledgeLevel, LearnerTraits, PreferenceLevel } from "../models/LearningProfile";

/**
 * "Learning Discovery" — the replacement for the 20-question survey.
 *
 * A survey asks people to describe how they learn, and people describe who
 * they would like to be. This instead puts a few tiny pieces of real learning
 * in front of them and scores what they DO: which format they stay with, how
 * fast they actually read, whether they ask for more, whether a fact from two
 * minutes ago is still there, and whether their confidence matches their
 * answers. Only three things are still asked outright (goal, starting level,
 * teacher), and two of those are picked from a concrete sample rather than a
 * label.
 *
 * The output is the same LearnerTraits the rest of the pipeline already
 * consumes, so nothing downstream changes.
 */

/** Three reasoning questions; the key stays server-side. */
export const CHALLENGE_QUESTIONS = [
  {
    id: "c1",
    text: "2, 6, 18, 54 … what comes next?",
    options: ["108", "162", "148", "216"],
    correctIndex: 1,
  },
  {
    id: "c2",
    text: "A bat and a ball cost 110 together. The bat costs 100 more than the ball. What does the ball cost?",
    options: ["10", "5", "1", "15"],
    correctIndex: 1,
  },
  {
    id: "c3",
    text: "All glims are tovs. Some tovs are red. Which statement must be true?",
    options: ["All glims are red", "Some glims are red", "No glims are red", "None of these must be true"],
    correctIndex: 3,
  },
] as const;

/** Index of the right answer to "what causes the Moon's phases?" in the client's recall step. */
export const RECALL_CORRECT_INDEX = 1;

/** Word count of the passage used for the reading-speed activity (kept here so the server computes the rate). */
export const READING_PASSAGE_WORDS = 101;

export const discoverySignalsSchema = z.object({
  /** Which of the four presentations of one idea made it click. */
  clickedFormat: z.enum(["visual", "auditory", "reading", "kinesthetic"]),
  /** Every format the learner opened before choosing. */
  exploredFormats: z.array(z.enum(["visual", "auditory", "reading", "kinesthetic"])).max(4),
  /** Measured time on the reading passage. */
  readingMs: z.number().int().min(0).max(30 * 60 * 1000),
  /** Asked for the deeper explanation afterwards. */
  wantedMore: z.boolean(),
  explanationPick: z.enum(["definition", "example", "analogy"]),
  memoryPick: z.enum(["story", "repetition", "association", "structure"]),
  teacherPick: z.enum(["friendly", "professional", "academic"]),
  goal: z.enum(["curiosity", "career", "exam", "hobby"]),
  startLevel: z.enum(["beginner", "intermediate", "advanced"]),
  challenge: z
    .array(z.object({ answer: z.number().int().min(0).max(3), sure: z.boolean() }))
    .length(CHALLENGE_QUESTIONS.length),
  /** Option chosen when asked, at the very end, about the idea from the first activity. */
  recallAnswer: z.number().int().min(0).max(3),
});

export type DiscoverySignals = z.infer<typeof discoverySignalsSchema>;

const LEVELS: KnowledgeLevel[] = ["beginner", "intermediate", "advanced"];

export function buildProfileFromDiscovery(signals: DiscoverySignals): LearnerTraits {
  const explored = new Set(signals.exploredFormats).size;

  // Reading speed. Under ~4s nobody read the passage — treat as a skip, not as genius.
  const minutes = signals.readingMs / 60_000;
  const wpm = signals.readingMs < 4000 ? 0 : READING_PASSAGE_WORDS / minutes;
  const skimmed = wpm === 0;
  const pace = skimmed ? "fast" : wpm < 150 ? "slow" : wpm < 280 ? "moderate" : "fast";

  const attentionSpan: PreferenceLevel =
    signals.wantedMore && explored >= 3 && !skimmed
      ? "high"
      : skimmed || (!signals.wantedMore && explored <= 1)
        ? "low"
        : "medium";

  const depth = signals.wantedMore ? "deep" : skimmed || pace === "fast" ? "overview" : "balanced";

  const correct = signals.challenge.filter((c, i) => c.answer === CHALLENGE_QUESTIONS[i].correctIndex).length;
  const sure = signals.challenge.filter((c) => c.sure).length;
  // Calibrated confidence: being sure only counts when the answers back it up.
  const confidence: PreferenceLevel =
    sure >= 2 && correct >= 2 ? "high" : sure === 0 || (sure >= 2 && correct === 0) ? "low" : "medium";

  const levelShift = correct === CHALLENGE_QUESTIONS.length ? 1 : correct === 0 ? -1 : 0;
  const knowledgeLevel = LEVELS[Math.min(2, Math.max(0, LEVELS.indexOf(signals.startLevel) + levelShift))];

  const recalled = signals.recallAnswer === RECALL_CORRECT_INDEX;
  const revisionFrequency: PreferenceLevel =
    !recalled || signals.goal === "exam" ? "high" : signals.goal === "hobby" ? "low" : "medium";

  return {
    learningStyle: signals.clickedFormat,
    attentionSpan,
    pace,
    knowledgeLevel,
    tone: signals.teacherPick,
    depth,
    visualPreference:
      signals.clickedFormat === "visual" ? "high" : signals.clickedFormat === "reading" ? "low" : "medium",
    examplePreference:
      signals.explanationPick === "example" ? "high" : signals.explanationPick === "analogy" ? "medium" : "low",
    motivation: signals.goal,
    memoryType: signals.memoryPick,
    confidence,
    revisionFrequency,
  };
}
