import { z } from "zod";
import { logger } from "../utils/logger";
import { languageDefinition, type LessonLanguage } from "../config/languages";
import { generateStructured } from "./aiContent.service";
import type { LearnerTraits } from "../models/LearningProfile";
import type { SlideContent, SlideStudyNotes } from "../models/Presentation";

/**
 * The second pass: the WRITTEN notes behind a lesson.
 *
 * A slide's bullets and narration are built to be watched — three short lines
 * and a voice. That is fine while the lesson is playing and useless a week
 * later, which is the complaint this exists to answer: a student could see the
 * topic but had nothing to write down and nothing to practise on.
 *
 * So the deck gets a companion page per topic, written the way a teacher fills
 * a board once the explaining is done: the idea in full sentences, the terms
 * defined precisely, the facts worth memorising, one example worked step by
 * step, and a problem the learner solves alone.
 *
 * WHY A SEPARATE PASS rather than more fields on the lesson prompt: the lesson
 * prompt is already ~6.7k tokens against a 12k-per-minute free tier, and this
 * material would roughly double the output. Batching a few slides at a time
 * into small calls keeps every request well inside the budget, and it means a
 * batch that fails leaves those slides without notes instead of failing the
 * lesson. It also runs in the PPT stage, not the content stage, so it never
 * delays the interactive player the learner is waiting on.
 */

/**
 * Slides per request. Three keeps a call around 2k tokens — small enough for
 * the per-minute budget, large enough that the (long) instructions are
 * amortised rather than re-sent for every single slide.
 */
const BATCH_SIZE = 3;

/** Trimmed so a batch stays small; the opening of a script carries its point. */
const SCRIPT_EXCERPT_CHARS = 700;

const noteSchema = z.object({
  explanation: z.string().min(40).max(700),
  definitions: z
    .array(
      z.object({
        term: z.string().min(1).max(60),
        meaning: z.string().min(4).max(170),
      })
    )
    .max(4)
    .optional(),
  keyFacts: z.array(z.string().min(3).max(150)).max(5).optional(),
  example: z
    .object({
      problem: z.string().min(5).max(260),
      steps: z.array(z.string().min(3).max(200)).min(1).max(6),
    })
    .nullish(),
  practice: z
    .object({
      question: z.string().min(5).max(260),
      answer: z.string().min(1).max(320),
    })
    .nullish(),
  commonMistake: z.string().max(190).nullish(),
});

const batchSchema = z.object({
  notes: z.array(noteSchema),
});

type RawNote = z.infer<typeof noteSchema>;

/**
 * The model may answer `null` or omit the optional blocks entirely; Mongoose
 * wants them absent, and the renderers want the arrays to exist.
 */
function toStudyNotes(raw: RawNote): SlideStudyNotes {
  return {
    explanation: raw.explanation.trim(),
    definitions: raw.definitions ?? [],
    keyFacts: raw.keyFacts ?? [],
    example: raw.example ?? undefined,
    practice: raw.practice ?? undefined,
    commonMistake: raw.commonMistake?.trim() || undefined,
  };
}

function languageRule(language: LessonLanguage): string {
  if (language === "en") return "";
  const { label } = languageDefinition(language);
  return `
## LANGUAGE
Write every field in ${label}, in the everyday register a ${label} teacher and student actually speak — not a literary or purist one. Technical terms, formulas, units, symbols and numbers stay in English/Latin script exactly as they appear in the slide, because that is the form the learner will meet in the textbook and the exam. Never transliterate a technical term into ${label} script.`;
}

interface SlideInput {
  title: string;
  points: string[];
  script: string;
  keyTerms: string[];
}

function toSlideInput(slide: Pick<SlideContent, "title" | "points" | "script" | "board">): SlideInput {
  return {
    title: slide.title,
    points: slide.points,
    script: slide.script.slice(0, SCRIPT_EXCERPT_CHARS),
    keyTerms: slide.board?.keyTerms ?? [],
  };
}

function buildPrompt(
  topic: string,
  traits: LearnerTraits,
  language: LessonLanguage,
  batch: SlideInput[]
): string {
  return `You are an experienced teacher writing up the notes for a class you have just taught on "${topic}".

A student will read these notes days later with nobody there to explain them. From the notes alone they must be able to (1) understand the idea properly, (2) copy something worth keeping into their notebook, and (3) practise a problem and check their own working. Assume the student is at a ${traits.knowledgeLevel} level.

The slide text you are given is only the headline — three or four short lines meant to be glanced at while the teacher talks. Your job is the substance behind it. Go a level deeper than the slide: explain the thing itself, not the bullet points about it.

## FOR EACH SLIDE, WRITE
1. "explanation" — 4 to 6 complete sentences in your own teaching voice. Say WHAT the concept is, WHY it exists or matters, and HOW it actually works. Use plain words for the reasoning and precise words for the technicalities. Do NOT restate or reword the bullet points; a student who has the slide must still learn something new from this paragraph.
2. "definitions" — 2 to 4 terms from this slide, each defined in one exact sentence the student could reproduce in an exam. Define the real term, not a vague gloss of it.
3. "keyFacts" — 2 to 5 short lines worth memorising: a formula, a rule, a threshold, a unit, a condition, or the correct order of steps. Be specific and exact. If the topic has a formula, it belongs here, written out properly.
4. "example" — one example worked all the way through, with each step on its own line, so the METHOD is visible and not just the answer. Show the reasoning between steps ("so...", "which gives..."). Use null ONLY for a pure opening-hook or closing-summary slide where an example would be artificial.
5. "practice" — one problem the student solves on their own, plus its answer. It must be solvable using only this slide's notes, and it must require actual work — never a yes/no or "what is the definition of" question. Use null only on the same opening/closing slides as above.
6. "commonMistake" — the single error students genuinely make on this concept, in one sentence. Use null if there honestly isn't one.

## ACCURACY — THIS IS THE RULE THAT MATTERS MOST
Every definition, formula, figure, unit and worked step must be factually correct and match the standard textbook treatment of the subject. A confident wrong note is worse than no note, because the student will memorise it. If you are not certain of a specific number, statistic or date, describe the relationship qualitatively instead of inventing a value. Never invent sources, citations, named studies or statistics. Check that each worked example's steps really do lead to the answer you state.

## FORMAT
Plain sentences only — no markdown, no bullet characters, no headings, no numbering inside a string. Return one entry in "notes" for EACH of the ${batch.length} slides below, in the SAME ORDER.${languageRule(language)}

## SLIDES
${JSON.stringify(batch, null, 2)}

## OUTPUT — return ONLY this JSON object, no commentary, no code fences
{
  "notes": [
    {
      "explanation": "<4-6 sentence written explanation of the concept>",
      "definitions": [{ "term": "<term>", "meaning": "<one exact sentence>" }],
      "keyFacts": ["<formula, rule or fact worth memorising>"],
      "example": { "problem": "<the example question>", "steps": ["<step 1>", "<step 2>"] },
      "practice": { "question": "<problem for the student to solve>", "answer": "<the answer, with the key working>" },
      "commonMistake": "<the mistake students make here>"
    }
  ]
}`;
}

/**
 * Writes study notes for every slide.
 *
 * Resilient by design: a batch that fails, times out or comes back the wrong
 * length yields `undefined` for those slides and the deck simply renders
 * without their notes pages. Batches run sequentially — firing them in
 * parallel reliably trips the free tier's per-minute token limit.
 */
export async function generateStudyNotes(
  topic: string,
  slides: Pick<SlideContent, "title" | "points" | "script" | "board">[],
  traits: LearnerTraits,
  language: LessonLanguage
): Promise<(SlideStudyNotes | undefined)[]> {
  const results: (SlideStudyNotes | undefined)[] = new Array(slides.length).fill(undefined);

  for (let start = 0; start < slides.length; start += BATCH_SIZE) {
    const batch = slides.slice(start, start + BATCH_SIZE);
    const label = `study notes for slides ${start + 1}-${start + batch.length}`;

    try {
      const { notes } = await generateStructured(
        buildPrompt(topic, traits, language, batch.map(toSlideInput)),
        batchSchema,
        label
      );

      // Positional: entry i describes slide start+i. A short or long array means
      // the model dropped or merged a slide, so we cannot trust the alignment.
      if (notes.length !== batch.length) {
        logger.warn(
          `${label} returned ${notes.length} entries for ${batch.length} slides — skipping the batch rather than misaligning notes`
        );
        continue;
      }

      notes.forEach((note, offset) => {
        results[start + offset] = toStudyNotes(note);
      });
    } catch (error) {
      logger.warn(`${label} failed — those slides get no notes page`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const written = results.filter(Boolean).length;
  logger.info(`Study notes written for ${written}/${slides.length} slides`);
  return results;
}

/** Every practice problem in the lesson, numbered for the practice-set pages. */
export function collectPractice(
  slides: Pick<SlideContent, "title" | "studyNotes">[]
): { slideTitle: string; question: string; answer: string }[] {
  return slides.flatMap((slide) =>
    slide.studyNotes?.practice
      ? [
          {
            slideTitle: slide.title,
            question: slide.studyNotes.practice.question,
            answer: slide.studyNotes.practice.answer,
          },
        ]
      : []
  );
}
