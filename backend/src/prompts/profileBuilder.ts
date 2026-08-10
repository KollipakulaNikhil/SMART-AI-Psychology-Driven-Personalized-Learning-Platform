import { ApiError } from "../utils/ApiError";
import type { LearnerTraits, QuestionnaireAnswer } from "../models/LearningProfile";
import { PSYCHOLOGY_QUESTIONS, TraitDimension } from "./questions";

/** Fallbacks used when a dimension receives no votes (shouldn't happen with all 20 answered). */
const DEFAULTS: LearnerTraits = {
  learningStyle: "visual",
  attentionSpan: "medium",
  pace: "moderate",
  knowledgeLevel: "beginner",
  tone: "friendly",
  depth: "balanced",
  visualPreference: "medium",
  examplePreference: "medium",
  motivation: "curiosity",
  memoryType: "structure",
  confidence: "medium",
  revisionFrequency: "medium",
};

/**
 * Tallies weighted trait votes across all answers and picks the dominant
 * value per dimension. Learners can select MORE THAN ONE option per question —
 * every selected option casts its votes, so mixed preferences (e.g. visual AND
 * reading) genuinely blend into the profile. Ties resolve toward the option
 * voted on most recently, which biases toward the later, more specific questions.
 */
export function buildLearnerProfile(answers: QuestionnaireAnswer[]): LearnerTraits {
  const questionById = new Map(PSYCHOLOGY_QUESTIONS.map((q) => [q.id, q]));

  if (answers.length !== PSYCHOLOGY_QUESTIONS.length) {
    throw ApiError.badRequest(
      `Expected ${PSYCHOLOGY_QUESTIONS.length} answers, received ${answers.length}`
    );
  }

  const tally = new Map<TraitDimension, Map<string, number>>();

  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    if (!question) throw ApiError.badRequest(`Unknown question id: ${answer.questionId}`);
    if (answer.optionIds.length === 0) {
      throw ApiError.badRequest(`Question ${answer.questionId} needs at least one selected option`);
    }
    const uniqueOptionIds = [...new Set(answer.optionIds)];
    for (const optionId of uniqueOptionIds) {
      const option = question.options.find((o) => o.id === optionId);
      if (!option) {
        throw ApiError.badRequest(`Unknown option "${optionId}" for question ${answer.questionId}`);
      }
      for (const vote of option.votes) {
        const dimension = tally.get(vote.dimension) ?? new Map<string, number>();
        dimension.set(vote.value, (dimension.get(vote.value) ?? 0) + (vote.weight ?? 1));
        tally.set(vote.dimension, dimension);
      }
    }
  }

  const traits = { ...DEFAULTS };
  for (const [dimension, counts] of tally) {
    let best = "";
    let bestScore = -1;
    for (const [value, score] of counts) {
      if (score >= bestScore) {
        best = value;
        bestScore = score;
      }
    }
    (traits as Record<TraitDimension, string>)[dimension] = best;
  }
  return traits;
}

export type DetailLevel = "quick" | "standard" | "detailed";

export interface GenerationOptions {
  /** Target lesson length in minutes (2–30); omitted = derived from profile. */
  durationMin?: number;
  detailLevel?: DetailLevel;
}

/**
 * Concrete generation knobs derived from the psychological profile.
 * Every downstream stage (prompt, PPT layout, TTS, video) reads from this
 * single object, so the same topic genuinely renders differently per learner.
 */
export interface GenerationParams {
  slideCount: number;
  maxPointsPerSlide: number;
  maxWordsPerPoint: number;
  scriptWordsPerSlide: number;
  quizCount: number;
  ttsSpeed: number;
  imageEmphasis: "low" | "medium" | "high";
  terminology: string;
  analogyRule: string;
  narrationStyle: string;
  structureRule: string;
  encouragement: string;
  /** How the narrator should "speak" the script — drives the human, spoken delivery. */
  deliveryStyle: string;
  /** What each slide's digital board should favour (diagram vs story beats vs structure). */
  boardGuidance: string;
  /** Preferred diagram type the model should lean toward for this learner. */
  preferredDiagram: "flow" | "cycle" | "compare" | "list";
  /** How much written explanation the board itself carries. */
  boardNotesRule: string;
  /** Depth-of-explanation rule for the narration (driven by detail level). */
  explanationRule: string;
  /** Prompt line pinning the total spoken runtime, when a duration was chosen. */
  durationLine: string;
  /** Total spoken-word target across all scripts, when a duration was chosen. */
  targetTotalWords?: number;
}

export function deriveGenerationParams(
  traits: LearnerTraits,
  options: GenerationOptions = {}
): GenerationParams {
  const detailLevel: DetailLevel = options.detailLevel ?? "standard";

  // Slide count: attention sets the base, depth adjusts it.
  let slideCount = traits.attentionSpan === "low" ? 6 : traits.attentionSpan === "medium" ? 8 : 10;
  if (traits.depth === "deep") slideCount += 2;
  if (traits.depth === "overview") slideCount -= 1;
  slideCount = Math.min(12, Math.max(5, slideCount));

  // Bullet density. The floors here are deliberately not tiny: a slide of two
  // three-word fragments is unreadable a week later, and the deck is a handout
  // the learner revises from, not just a backdrop for the narration. Attention
  // span still shapes the density — it just no longer strips the slide bare.
  let maxPointsPerSlide = traits.attentionSpan === "low" ? 4 : traits.attentionSpan === "medium" ? 5 : 6;
  if (traits.learningStyle === "reading") maxPointsPerSlide = Math.min(7, maxPointsPerSlide + 1);
  if (traits.visualPreference === "high") maxPointsPerSlide = Math.max(4, maxPointsPerSlide - 1);

  let maxWordsPerPoint = traits.knowledgeLevel === "beginner" ? 14 : traits.knowledgeLevel === "intermediate" ? 18 : 22;
  if (traits.attentionSpan === "low") maxWordsPerPoint = Math.max(11, maxWordsPerPoint - 3);

  // Narration length per slide, in words. Attention drives it; depth stretches it.
  let scriptWordsPerSlide = traits.attentionSpan === "low" ? 60 : traits.attentionSpan === "medium" ? 90 : 120;
  if (traits.depth === "deep") scriptWordsPerSlide += 25;
  if (traits.depth === "overview") scriptWordsPerSlide -= 15;
  if (detailLevel === "detailed") scriptWordsPerSlide = Math.round(scriptWordsPerSlide * 1.2);
  if (detailLevel === "quick") scriptWordsPerSlide = Math.round(scriptWordsPerSlide * 0.8);

  const quizCount = traits.revisionFrequency === "high" ? 5 : traits.revisionFrequency === "medium" ? 4 : 3;

  const ttsSpeed = traits.pace === "slow" ? 0.9 : traits.pace === "fast" ? 1.1 : 1.0;

  // A chosen duration overrides the profile-derived length: spoken narration
  // averages ~150 wpm at 1.0x, and each slide plays for its narration length.
  let durationLine = "";
  let targetTotalWords: number | undefined;
  if (options.durationMin) {
    const durationMin = Math.min(30, Math.max(1, options.durationMin));
    targetTotalWords = Math.round(durationMin * 150 * ttsSpeed);
    // Models reliably write ~120 words of narration per slide but chronically
    // under-write when asked for very long single scripts. So hit the duration
    // by SLIDE COUNT (more slides, each a comfortable length) rather than by
    // forcing each script to be huge — this is what actually lands the runtime.
    const reliableWordsPerSlide = 105;
    slideCount = Math.min(16, Math.max(4, Math.round(targetTotalWords / reliableWordsPerSlide)));
    scriptWordsPerSlide = Math.min(200, Math.max(70, Math.round(targetTotalWords / slideCount)));
    const minWordsPerSlide = Math.round(scriptWordsPerSlide * 0.85);
    durationLine = `The learner chose a ${durationMin}-minute lesson, so length is a CONTRACT: produce all ${slideCount} slides, and every slide's "script" must be AT LEAST ${minWordsPerSlide} words (target ~${scriptWordsPerSlide}), for ~${targetTotalWords} spoken words total. Do NOT cut the lesson short or merge slides — under-writing is the #1 failure. When unsure, add another example or a deeper "why", never less.`;
  }

  const imageEmphasis =
    traits.learningStyle === "visual" || traits.visualPreference === "high"
      ? "high"
      : traits.visualPreference === "low"
        ? "low"
        : "medium";

  const terminology =
    traits.knowledgeLevel === "beginner"
      ? "Use plain everyday language. Introduce at most one technical term per slide and immediately explain it in simple words."
      : traits.knowledgeLevel === "intermediate"
        ? "Use standard terminology but briefly define specialised terms on first use."
        : "Use precise technical terminology freely; do not water down concepts or over-explain fundamentals.";

  const analogyRule =
    traits.examplePreference === "high"
      ? "Every key concept must include a vivid real-world analogy or example tied to daily life."
      : traits.examplePreference === "medium"
        ? "Include a concrete example for the harder concepts only."
        : "Prefer precise definitions over analogies; use an example only when strictly necessary.";

  const narrationStyle = [
    traits.tone === "friendly"
      ? "Narration is warm and conversational, like a supportive mentor speaking directly to the learner."
      : traits.tone === "professional"
        ? "Narration is crisp, confident and efficient, like a top-tier industry instructor."
        : "Narration is measured and rigorous, like a university lecture, with careful logical progression.",
    traits.pace === "slow"
      ? "Use short sentences with natural pauses; repeat the key idea of each slide once in different words."
      : traits.pace === "fast"
        ? "Keep momentum high; no filler phrases, no recaps of what was just said."
        : "Maintain a steady, natural rhythm.",
    traits.memoryType === "story"
      ? "Weave the explanation into a light narrative thread that continues across slides."
      : traits.memoryType === "repetition"
        ? "End each slide's narration by restating its single most important takeaway."
        : traits.memoryType === "association"
          ? "Anchor new ideas to familiar concepts the learner likely already knows."
          : "Signal structure verbally: first, second, the key point here, and so on.",
  ].join(" ");

  const structureRule =
    traits.memoryType === "structure"
      ? "Organise slides as a clear numbered progression where each slide builds on the previous one."
      : traits.memoryType === "story"
        ? "Open with a hook slide framing a real problem, and resolve that problem by the final slide."
        : "Order slides from most familiar ideas to least familiar.";

  const encouragement =
    traits.confidence === "low"
      ? "Sprinkle brief encouraging remarks into the narration (never condescending), and frame mistakes as normal."
      : "Do not add motivational filler; let the material speak for itself.";

  // Spoken delivery: the script is voiced by a human-sounding narrator on a
  // digital board, so it must read like natural speech, not written prose.
  const deliveryStyle = [
    "Write the script the way a real teacher TALKS out loud at a whiteboard, not the way an article is written.",
    "Use contractions (it's, you'll, let's), address the learner directly as 'you', and open the very first slide with a hook — a question, a surprising fact, or a tiny story.",
    "Use real teacher moves throughout: ask a rhetorical question and answer it yourself (\"So why does this happen? Well...\"), think aloud (\"okay, so what happens if we...\"), flag the good bits (\"now here's the part I love\"), call back to earlier slides by name (\"remember that kitchen-counter idea from before?\"), and occasionally restate a hard idea a second time in totally different words.",
    "Vary the rhythm like real speech: mix short punchy sentences with longer flowing ones. Never open two slides with the same phrase, and never sound like you're reading a list.",
    traits.memoryType === "story"
      ? "Carry a single running story or scenario across all slides so it feels like one continuous tale."
      : "Connect each slide to the previous one with a spoken transition (\"so now that we know X, here's the interesting part...\").",
    traits.tone === "friendly"
      ? "Sound warm and a little playful, like a favourite tutor."
      : traits.tone === "academic"
        ? "Sound composed and authoritative, but still human and spoken."
        : "Sound sharp, confident and practical.",
    "Insert natural pauses using commas and ellipses (...) where a speaker would breathe. Never use markdown, bullet symbols, headings, stage directions, or emoji in the script.",
  ].join(" ");

  const preferredDiagram: GenerationParams["preferredDiagram"] =
    traits.memoryType === "story"
      ? "flow"
      : traits.memoryType === "structure"
        ? "list"
        : traits.examplePreference === "high"
          ? "compare"
          : "cycle";

  const boardNotesRule =
    detailLevel === "detailed"
      ? 'Every slide\'s "board.notes" must contain 2-4 short written explanation lines (each under 12 words) that expand the key terms — definitions, the "why", or a worked micro-example — exactly what a teacher writes under headings on a board.'
      : detailLevel === "quick"
        ? 'Keep "board.notes" minimal: at most 1 line, only when a term is genuinely non-obvious.'
        : 'Give the important slides 1-3 "board.notes": short written lines (under 12 words each) that explain or define the key terms on the board.';

  const explanationRule =
    detailLevel === "detailed"
      ? "Explain the WHY and HOW behind every concept, not just the what. Walk through one concrete worked example or scenario per major concept, step by step, in the narration."
      : detailLevel === "quick"
        ? "Keep explanations tight and high-level; skip derivations and edge cases entirely."
        : "Balance clarity and depth: explain the reasoning behind the key ideas without exhaustive detail.";

  const boardGuidance = [
    traits.learningStyle === "visual" || traits.visualPreference === "high"
      ? "This learner is highly visual, so almost every slide's board should include a simple diagram (boxes, arrows, a cycle or a comparison) — not just words."
      : traits.learningStyle === "kinesthetic"
        ? "This learner learns by doing, so frame boards as steps or a process they could follow along with."
        : traits.learningStyle === "reading"
          ? "This learner likes text, so boards can lean on a few precise key terms; add a diagram only when it genuinely clarifies."
          : "Balance a few key terms with a diagram when the concept is a process or relationship.",
    `When a diagram fits, prefer a "${preferredDiagram}" layout, but choose whatever type actually matches the concept.`,
    "keyTerms are the 2-5 short words/phrases the narrator 'writes' on the board as they say them — keep each under 6 words.",
  ].join(" ");

  return {
    slideCount,
    maxPointsPerSlide,
    maxWordsPerPoint,
    scriptWordsPerSlide,
    quizCount,
    ttsSpeed,
    imageEmphasis,
    terminology,
    analogyRule,
    narrationStyle,
    structureRule,
    encouragement,
    deliveryStyle,
    boardGuidance,
    preferredDiagram,
    boardNotesRule,
    explanationRule,
    durationLine,
    targetTotalWords,
  };
}
