import { z } from "zod";
import { logger } from "../utils/logger";
import { languageDefinition, type LessonLanguage } from "../config/languages";
import { generateStructured } from "./aiContent.service";
import type { LessonGenerationResult } from "../prompts/promptEngine";

type LessonContent = LessonGenerationResult["content"];
type LessonSlide = LessonContent["slides"][number];

/**
 * The lesson is always written in English first — the content prompt is tuned
 * for it and the models are strongest there — then translated. Translating a
 * finished lesson also keeps one English source of truth that can be dubbed
 * into any number of languages later.
 *
 * Translation runs PER SLIDE rather than in one giant call. Two reasons: the
 * free Groq tier has a tight per-minute token budget that a whole-lesson
 * payload blows through, and a slide that fails to translate can simply stay in
 * English instead of failing the lesson.
 *
 * SPOKEN vs WRITTEN
 * -----------------
 * A lesson has two independent languages: the one the narrator SPEAKS and the
 * one that gets WRITTEN on the board. In a real multilingual classroom these
 * are routinely different — the teacher explains in Telugu but writes
 * "Relational Database" on the board, because that is the form the learner will
 * meet in the textbook and the exam. So the fields are split:
 *
 *   spoken  → script                        (narration language)
 *   written → title, points, keyTerms,      (board language)
 *             notes, diagram nodes
 *
 * When both languages are the same we translate them in ONE call per slide, as
 * before. When the board stays English there is nothing to translate for the
 * written half at all — the lesson was authored in English — which makes the
 * common "speak Telugu, write English" case *cheaper* than full translation,
 * not more expensive. That matters on a 12k-tokens-per-minute free tier.
 */

const spokenSchema = z.object({
  script: z.string().min(1),
});

const writtenSchema = z.object({
  title: z.string().min(1),
  points: z.array(z.string().min(1)),
  keyTerms: z.array(z.string()),
  notes: z.array(z.string()),
  diagramNodes: z.array(z.string()),
});

const fullSlideSchema = spokenSchema.merge(writtenSchema);

const metaTranslationSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
});

const quizTranslationSchema = z.object({
  quiz: z.array(
    z.object({
      question: z.string().min(1),
      options: z.array(z.string().min(1)).length(4),
      explanation: z.string(),
    })
  ),
});

/** Shared rules — the model must translate, not re-teach or re-order. */
function rules(language: LessonLanguage): string {
  const { label } = languageDefinition(language);
  return `You are a professional educational translator. Translate the given lesson material from English into ${label}.

HARD RULES
1. Translate meaning, not word-for-word. The result must sound like a native ${label} teacher wrote it.
2. Write the way teachers and students ACTUALLY talk — the everyday spoken register, not a formal or literary one. Do NOT reach for rare, bookish or purist vocabulary when an ordinary word exists.
3. KEEP TECHNICAL TERMS IN ENGLISH. Domain terms, product names, units and acronyms stay in the Latin alphabet exactly as written ("machine learning", "database", "photosynthesis", "CPU"). Real ${label} teachers say these in English, and a learner who only meets an invented native coinage cannot follow a textbook, an exam paper or an interview. Never transliterate a technical term into ${label} script, and never invent a native equivalent for one.
4. The narration script is SPOKEN ALOUD by a text-to-speech voice. Write it the way a teacher talks: natural, flowing, no markdown, no symbols, no bullet characters. Ordinary ${label} words use the native ${label} script; technical terms stay in English per rule 3.
5. Keep every array the SAME LENGTH and the SAME ORDER as the input. Never add, drop, merge or reorder items.
6. Keep numbers, formulas and proper nouns exactly as they are.
7. Return ONLY the JSON object described below — no commentary, no code fences.`;
}

interface SlideParts {
  keyTerms: string[];
  notes: string[];
  diagramNodes: string[];
}

function partsOf(slide: LessonSlide): SlideParts {
  return {
    keyTerms: slide.board?.keyTerms ?? [],
    notes: slide.board?.notes ?? [],
    diagramNodes: slide.board?.diagram?.nodes ?? [],
  };
}

/**
 * Length drift would desync the board reveal from the narration (the timeline
 * is built per item) and quiz grading is positional, so any array the model
 * resized falls back to the English original for that field only.
 */
function sameLength<T>(next: T[], original: T[]): T[] {
  return next.length === original.length ? next : original;
}

function writtenShape(slide: LessonSlide, parts: SlideParts): string {
  return `  "title": "<translated slide title>",
  "points": [${slide.points.map(() => '"<translated point>"').join(", ")}],
  "keyTerms": [${parts.keyTerms.map(() => '"<translated term>"').join(", ")}],
  "notes": [${parts.notes.map(() => '"<translated note>"').join(", ")}],
  "diagramNodes": [${parts.diagramNodes.map(() => '"<translated node>"').join(", ")}]`;
}

function applyWritten(
  slide: LessonSlide,
  parts: SlideParts,
  translated: z.infer<typeof writtenSchema>
): LessonSlide {
  return {
    ...slide,
    title: translated.title,
    points: sameLength(translated.points, slide.points),
    board: slide.board
      ? {
          ...slide.board,
          keyTerms: sameLength(translated.keyTerms, parts.keyTerms),
          notes: sameLength(translated.notes, parts.notes),
          diagram: slide.board.diagram
            ? {
                ...slide.board.diagram,
                nodes: sameLength(translated.diagramNodes, parts.diagramNodes),
              }
            : slide.board.diagram,
        }
      : slide.board,
  };
}

/**
 * MEASURED: the small fallback model emits strings of valid-looking Telugu
 * codepoints that are not real words. Translation must never silently drop to
 * it — a slide left in English is recoverable, gibberish is not.
 */
const STRONG = { requireStrongModel: true } as const;

/** Both halves in one call — used when the board and the voice share a language. */
async function translateSlideFully(
  slide: LessonSlide,
  language: LessonLanguage,
  index: number
): Promise<LessonSlide> {
  const parts = partsOf(slide);
  const prompt = `${rules(language)}

## INPUT (English)
${JSON.stringify({ title: slide.title, points: slide.points, script: slide.script, ...parts }, null, 2)}

## REQUIRED OUTPUT SHAPE
{
${writtenShape(slide, parts)},
  "script": "<translated narration, spoken style>"
}`;

  const translated = await generateStructured(
    prompt,
    fullSlideSchema,
    `slide ${index + 1} translation → ${language}`,
    STRONG
  );

  return { ...applyWritten(slide, parts, translated), script: translated.script };
}

/** Narration only — the board is staying in another language. */
async function translateSlideSpoken(
  slide: LessonSlide,
  language: LessonLanguage,
  index: number
): Promise<LessonSlide> {
  const prompt = `${rules(language)}

This is the narration a teacher speaks aloud while writing on the board. The board itself is in a different language, so the spoken words must still make sense to someone reading English terms on the board — which is exactly why rule 3 matters here.

## INPUT (English)
${JSON.stringify({ script: slide.script }, null, 2)}

## REQUIRED OUTPUT SHAPE
{ "script": "<translated narration, spoken style>" }`;

  const translated = await generateStructured(
    prompt,
    spokenSchema,
    `slide ${index + 1} narration → ${language}`,
    STRONG
  );

  return { ...slide, script: translated.script };
}

/** Board text only — the narration is staying in another language. */
async function translateSlideWritten(
  slide: LessonSlide,
  language: LessonLanguage,
  index: number
): Promise<LessonSlide> {
  const parts = partsOf(slide);
  const prompt = `${rules(language)}

This text is WRITTEN ON A BOARD, so it must be short and scannable — keep each item about as long as the English original.

## INPUT (English)
${JSON.stringify({ title: slide.title, points: slide.points, ...parts }, null, 2)}

## REQUIRED OUTPUT SHAPE
{
${writtenShape(slide, parts)}
}`;

  const translated = await generateStructured(
    prompt,
    writtenSchema,
    `slide ${index + 1} board text → ${language}`,
    STRONG
  );

  return applyWritten(slide, parts, translated);
}

async function translateMeta(
  content: LessonContent,
  language: LessonLanguage
): Promise<{ title: string; summary: string }> {
  const prompt = `${rules(language)}

## INPUT (English)
${JSON.stringify({ title: content.title, summary: content.summary }, null, 2)}

## REQUIRED OUTPUT SHAPE
{ "title": "<translated lesson title>", "summary": "<translated summary>" }`;

  return generateStructured(prompt, metaTranslationSchema, `lesson meta translation → ${language}`, STRONG);
}

async function translateQuiz(
  content: LessonContent,
  language: LessonLanguage
): Promise<LessonContent["quiz"]> {
  const prompt = `${rules(language)}

Each question has exactly 4 options. Keep them in the SAME ORDER — the correct answer is tracked by position, so reordering options would break the grading.

## INPUT (English)
${JSON.stringify(
  content.quiz.map((q) => ({ question: q.question, options: q.options, explanation: q.explanation })),
  null,
  2
)}

## REQUIRED OUTPUT SHAPE
{ "quiz": [ { "question": "<translated>", "options": ["<a>", "<b>", "<c>", "<d>"], "explanation": "<translated>" } ] }`;

  const translated = await generateStructured(
    prompt,
    quizTranslationSchema,
    `quiz translation → ${language}`,
    STRONG
  );

  // The correct answer is an index, so a resized quiz must not be applied.
  if (translated.quiz.length !== content.quiz.length) return content.quiz;

  return content.quiz.map((question, index) => ({
    ...question,
    question: translated.quiz[index].question,
    options: translated.quiz[index].options,
    explanation: translated.quiz[index].explanation,
  }));
}

/**
 * Translates a generated lesson in place.
 *
 * `language` is what the learner HEARS; `boardLanguage` is what they READ on the
 * board and slides. Passing the same value for both reproduces the original
 * single-language behaviour exactly.
 *
 * Every part is individually resilient: whatever fails to translate stays in
 * English rather than failing generation, because a mostly-Telugu lesson is far
 * more useful than no lesson.
 */
export async function translateLessonContent(
  content: LessonContent,
  language: LessonLanguage,
  boardLanguage: LessonLanguage = language
): Promise<LessonContent> {
  const translateSpoken = language !== "en";
  const translateWritten = boardLanguage !== "en";
  if (!translateSpoken && !translateWritten) return content;

  const combined = translateSpoken && translateWritten && language === boardLanguage;
  const failed: string[] = [];

  // Lesson title and summary are prose the learner reads about the lesson, so
  // they follow the narration language — the language of the person, not of the
  // board. When only the board is translated they follow that instead.
  const metaLanguage = translateSpoken ? language : boardLanguage;
  const meta = await translateMeta(content, metaLanguage).catch((error) => {
    failed.push("title/summary");
    logger.warn(`Lesson meta translation to ${metaLanguage} failed; keeping English`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { title: content.title, summary: content.summary };
  });

  // Sequential on purpose: the free Groq tier is rate-limited per minute, and
  // firing every slide at once reliably trips it.
  const slides: LessonSlide[] = [];
  for (const [index, slide] of content.slides.entries()) {
    try {
      if (combined) {
        slides.push(await translateSlideFully(slide, language, index));
        continue;
      }
      let next = slide;
      if (translateSpoken) next = await translateSlideSpoken(next, language, index);
      if (translateWritten) next = await translateSlideWritten(next, boardLanguage, index);
      slides.push(next);
    } catch (error) {
      failed.push(`slide ${index + 1}`);
      logger.warn(`Slide ${index + 1} translation failed; keeping English`, {
        error: error instanceof Error ? error.message : String(error),
      });
      slides.push(slide);
    }
  }

  // The quiz is read by the learner, not written on the board, so it follows
  // the narration language.
  const quiz = await translateQuiz(content, metaLanguage).catch((error) => {
    failed.push("quiz");
    logger.warn(`Quiz translation to ${metaLanguage} failed; keeping English`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return content.quiz;
  });

  const describe =
    language === boardLanguage ? language : `voice ${language} / board ${boardLanguage}`;
  if (failed.length > 0) {
    logger.warn(`Partial translation (${describe}) — left in English: ${failed.join(", ")}`);
  } else {
    logger.info(`Lesson translated (${describe}), ${slides.length} slides`);
  }

  return { ...content, title: meta.title, summary: meta.summary, slides, quiz };
}
