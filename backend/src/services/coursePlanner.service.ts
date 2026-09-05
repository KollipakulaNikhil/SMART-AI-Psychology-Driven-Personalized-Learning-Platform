import { z } from "zod";
import type { LearnerTraits } from "../models/LearningProfile";
import { generateStructured } from "./aiContent.service";
import { languageDefinition, type LessonLanguage } from "../config/languages";
import { logger } from "../utils/logger";

/**
 * Plans a personalized multi-lesson Learning Path from a single goal.
 * Module count and progression are shaped by the learner's psychology:
 * short attention spans get more, smaller modules; advanced learners skip
 * fundamentals; the motivation frames how the arc is pitched.
 */

export const coursePlanSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(20).max(600),
  subject: z.string().min(2).max(60),
  // A roadmap of sections, each with its own subtopic lessons.
  sections: z
    .array(
      z.object({
        title: z.string().min(3).max(100),
        subtopics: z
          .array(
            z.object({
              title: z.string().min(3).max(120),
              topic: z.string().min(3).max(200),
              focus: z.string().min(3).max(300),
            })
          )
          .min(1)
          .max(6),
      })
    )
    .min(2)
    .max(6),
});

export type CoursePlan = z.infer<typeof coursePlanSchema>;

/**
 * Same roadmap shape as `coursePlanSchema`, plus the list of genuinely useful
 * additions the AI made beyond what the source document actually contains —
 * surfaced to the learner so it's clear what came from their upload vs. what
 * SMART AI added to make the material complete.
 */
export const documentCoursePlanSchema = coursePlanSchema.extend({
  enrichment: z
    .array(z.string().min(10).max(240))
    .min(2)
    .max(6),
});

export type DocumentCoursePlan = z.infer<typeof documentCoursePlanSchema>;

function buildCoursePrompt(goal: string, traits: LearnerTraits): string {
  const moduleGuidance =
    traits.attentionSpan === "low"
      ? "Break the journey into 6-8 small, self-contained modules so each session feels finishable."
      : traits.attentionSpan === "high"
        ? "Use 4-6 substantial modules that each go properly deep."
        : "Use 5-7 well-balanced modules.";

  const startPoint =
    traits.knowledgeLevel === "beginner"
      ? "Assume zero prior knowledge; module 1 must build intuition before any formalism."
      : traits.knowledgeLevel === "advanced"
        ? "Skip fundamentals entirely; start from the intermediate frontier and push into advanced territory."
        : "Open with a rapid refresher of the basics, then move into new ground quickly.";

  const motivationFrame =
    traits.motivation === "career"
      ? "Frame modules around employable, practical skills and real work scenarios."
      : traits.motivation === "exam"
        ? "Sequence modules the way an exam syllabus builds, with heavy emphasis on testable mastery."
        : traits.motivation === "hobby"
          ? "Keep the arc project-flavoured and fun — each module should unlock something the learner can try."
          : "Let curiosity lead: order modules so each one opens an intriguing question the next answers.";

  return `You are SMART AI's curriculum designer. Design a personalized learning roadmap organised into SECTIONS, where each section contains several subtopic lessons.

## THE LEARNER
- Knowledge level: ${traits.knowledgeLevel}
- Attention span: ${traits.attentionSpan}
- Learning style: ${traits.learningStyle}
- Motivation: ${traits.motivation}
- Preferred depth: ${traits.depth}

## THE GOAL
"${goal}"

## REQUIREMENTS — follow exactly
1. Organise the roadmap into 3-5 SECTIONS (major stages/chapters of the journey), each with a clear title.
2. ${moduleGuidance} Distribute those lessons as subtopics across the sections (2-4 subtopics per section).
3. ${startPoint}
4. ${motivationFrame}
5. Sections AND the subtopics within them must build strictly in order — no forward references, no repeats. Early sections are foundational; later sections advance.
6. Each subtopic's "topic" is a self-contained lesson topic (it becomes its own generated lesson). Its "focus" tells the lesson generator what to emphasise so it fits the roadmap.
7. "subject" is the broad category (e.g. "Programming", "Physics", "Business").
8. Every field must contain real, specific content — never an empty string or a placeholder.

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no commentary:
{
  "title": "<inspiring but accurate roadmap title>",
  "description": "<2-3 sentences on where this roadmap takes the learner>",
  "subject": "<broad category>",
  "sections": [
    {
      "title": "<section / chapter name>",
      "subtopics": [
        { "title": "<lesson name>", "topic": "<lesson topic>", "focus": "<what this lesson must emphasise>" }
      ]
    }
  ]
}`;
}

/**
 * Same roadmap-building contract as `buildCoursePrompt`, but grounded in an
 * uploaded document instead of a free-text goal: the sections/subtopics must
 * come from what the source actually covers, plus AI-added topics that round
 * the material out into a complete course (prerequisites the source assumes,
 * follow-on topics it gestures at but doesn't explain, adjacent concepts a
 * learner would need next). Every added topic must be named in "enrichment"
 * so the learner can see what came from their document vs. what SMART AI
 * contributed — the same way a real teacher supplements a chapter with
 * context the textbook alone doesn't give.
 */
function buildDocumentCoursePrompt(sourceText: string, traits: LearnerTraits, truncated: boolean): string {
  const moduleGuidance =
    traits.attentionSpan === "low"
      ? "Break the material into 6-8 small, self-contained modules so each session feels finishable."
      : traits.attentionSpan === "high"
        ? "Use 4-6 substantial modules that each go properly deep."
        : "Use 5-7 well-balanced modules.";

  const startPoint =
    traits.knowledgeLevel === "beginner"
      ? "Assume zero prior knowledge; module 1 must build intuition before the document's own formalism."
      : traits.knowledgeLevel === "advanced"
        ? "Skip anything the document treats as basic; start from its intermediate content and push deeper."
        : "Open with a rapid refresher of what the document assumes the reader already knows, then move on.";

  return `You are SMART AI's curriculum designer. A learner has uploaded a document (textbook chapter, article, or notes). Turn it into a complete learning roadmap, organised into SECTIONS, where each section contains several subtopic lessons.

## THE LEARNER
- Knowledge level: ${traits.knowledgeLevel}
- Attention span: ${traits.attentionSpan}
- Learning style: ${traits.learningStyle}
- Depth preference: ${traits.depth}

## THE SOURCE DOCUMENT${truncated ? " (excerpt — the document continues beyond what's shown; plan for the subject it's clearly building toward, not only the literal text below)" : ""}
"""
${sourceText}
"""

## REQUIREMENTS — follow exactly
1. Organise the roadmap into 3-5 SECTIONS (major stages/chapters), each with a clear title.
2. ${moduleGuidance} Distribute those lessons as subtopics across the sections (2-4 subtopics per section).
3. ${startPoint}
4. MOST subtopics must come directly from what the document actually covers — real topics, terms and structure it contains. Do not invent content the document doesn't support.
5. ADD a small number of genuinely useful subtopics the document does not cover but a learner would need for full understanding: a prerequisite it assumes, a follow-on concept it references but doesn't explain, or an adjacent topic that completes the picture. Mark these the same way as any other subtopic (they become normal lessons), but ALSO list each one in "enrichment" as one sentence explaining what it adds and why it's useful given the document's content.
6. Sections AND the subtopics within them must build strictly in order — no forward references, no repeats. Early sections are foundational; later sections advance.
7. Each subtopic's "topic" is a self-contained lesson topic (it becomes its own generated lesson). Its "focus" tells the lesson generator what to emphasise so it fits the roadmap.
8. "subject" is the broad category (e.g. "Biology", "Data Structures", "History").
9. Every field must contain real, specific content grounded in the document — never an empty string, a placeholder, or a fact you're not confident the document supports.

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no commentary:
{
  "title": "<roadmap title reflecting the document's actual subject>",
  "description": "<2-3 sentences on what this roadmap covers and where it takes the learner>",
  "subject": "<broad category>",
  "sections": [
    {
      "title": "<section / chapter name>",
      "subtopics": [
        { "title": "<lesson name>", "topic": "<lesson topic>", "focus": "<what this lesson must emphasise>" }
      ]
    }
  ],
  "enrichment": ["<one sentence: an AI-added topic and why it's useful given the document>"]
}`;
}

/** Shared rules — mirrors `rules()` in translation.service.ts for the same reasons. */
function translationRules(language: LessonLanguage): string {
  const { label } = languageDefinition(language);
  return `You are a professional educational translator. Translate the given learning roadmap from English into ${label}.

HARD RULES
1. Translate meaning, not word-for-word. The result must sound like a native ${label} curriculum designer wrote it.
2. Write the way teachers and students ACTUALLY talk — the everyday spoken register, not a formal or literary one. Do NOT reach for rare, bookish or purist vocabulary when an ordinary word exists.
3. KEEP TECHNICAL TERMS IN ENGLISH. Domain terms, product names, units and acronyms stay in the Latin alphabet exactly as written ("machine learning", "database", "photosynthesis", "CPU"). Never transliterate a technical term into ${label} script, and never invent a native equivalent for one.
4. Keep every array the SAME LENGTH and the SAME ORDER as the input. Never add, drop, merge or reorder items.
5. Keep numbers, formulas and proper nouns exactly as they are.
6. Return ONLY the JSON object described below — no commentary, no code fences.`;
}

const coursePlanTranslationSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  sectionTitles: z.array(z.string().min(1)),
  subtopics: z.array(
    z.object({
      title: z.string().min(1),
      topic: z.string().min(1),
      focus: z.string().min(1),
    })
  ),
});

/**
 * MEASURED (see translation.service.ts's `STRONG` const): the small fallback
 * model produces plausible-looking but fake text in non-Latin scripts, so
 * translation must never silently drop to it.
 */
const STRONG = { requireStrongModel: true } as const;

/**
 * Translates a generated course plan in place. The plan is authored in
 * English first (same pattern as `translateLessonContent`), then translated
 * in a single call — the payload is small enough (one title, one
 * description, a handful of section titles and subtopics) that it doesn't
 * need the per-slide chunking the lesson translator uses.
 *
 * Resilient by design: any failure, or any array the model resized, falls
 * back to the original English plan rather than throwing — a course plan in
 * English is far more useful than a failed course-creation request. Arrays
 * are positionally referenced by `sectionIndex`/`index` downstream, so a
 * resized array must never be applied.
 */
export async function translateCoursePlan(plan: CoursePlan, language: LessonLanguage): Promise<CoursePlan> {
  const subtopicsFlat = plan.sections.flatMap((section) => section.subtopics);

  const prompt = `${translationRules(language)}

## INPUT (English)
${JSON.stringify(
  {
    title: plan.title,
    description: plan.description,
    sectionTitles: plan.sections.map((section) => section.title),
    subtopics: subtopicsFlat.map((subtopic) => ({
      title: subtopic.title,
      topic: subtopic.topic,
      focus: subtopic.focus,
    })),
  },
  null,
  2
)}

## REQUIRED OUTPUT SHAPE
{
  "title": "<translated roadmap title>",
  "description": "<translated description>",
  "sectionTitles": [${plan.sections.map(() => '"<translated section title>"').join(", ")}],
  "subtopics": [${subtopicsFlat.map(() => '{ "title": "<translated>", "topic": "<translated>", "focus": "<translated>" }').join(", ")}]
}`;

  try {
    const translated = await generateStructured(
      prompt,
      coursePlanTranslationSchema,
      `course plan translation → ${language}`,
      STRONG
    );

    if (
      translated.sectionTitles.length !== plan.sections.length ||
      translated.subtopics.length !== subtopicsFlat.length
    ) {
      logger.warn(`Course plan translation to ${language} resized an array; keeping English plan`);
      return plan;
    }

    let cursor = 0;
    const sections = plan.sections.map((section, sectionIndex) => ({
      title: translated.sectionTitles[sectionIndex],
      subtopics: section.subtopics.map((subtopic) => {
        const translatedSubtopic = translated.subtopics[cursor++];
        return {
          title: translatedSubtopic.title,
          topic: translatedSubtopic.topic,
          focus: translatedSubtopic.focus,
        };
      }),
    }));

    return {
      ...plan,
      title: translated.title,
      description: translated.description,
      sections,
    };
  } catch (error) {
    logger.warn(`Course plan translation to ${language} failed; keeping English plan`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return plan;
  }
}

export async function planCourse(
  goal: string,
  traits: LearnerTraits,
  language: LessonLanguage = "en"
): Promise<CoursePlan> {
  const plan = await generateStructured(buildCoursePrompt(goal, traits), coursePlanSchema, "course plan");
  return language === "en" ? plan : translateCoursePlan(plan, language);
}

const enrichmentTranslationSchema = z.object({
  lines: z.array(z.string().min(1)),
});

/**
 * Translates just the enrichment lines. Kept separate from
 * `translateCoursePlan` (which handles title/description/sections) so that
 * shared, already-verified function stays untouched — this is small, isolated
 * and, like the rest of this file's translations, non-fatal: any failure or
 * length mismatch keeps the English lines rather than losing them.
 */
async function translateEnrichment(lines: string[], language: LessonLanguage): Promise<string[]> {
  if (lines.length === 0) return lines;
  const { label } = languageDefinition(language);
  const prompt = `Translate each of these ${lines.length} sentences into ${label}, in the everyday spoken register a teacher would use (not literary/purist). Keep technical terms in English/Latin script. Keep the same order and count. Return ONLY JSON: { "lines": [${lines.map(() => '"<translated>"').join(", ")}] }

${JSON.stringify(lines, null, 2)}`;

  try {
    const { lines: translated } = await generateStructured(
      prompt,
      enrichmentTranslationSchema,
      `course enrichment translation → ${language}`
    );
    return translated.length === lines.length ? translated : lines;
  } catch (error) {
    logger.warn(`Course enrichment translation to ${language} failed; keeping English lines`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return lines;
  }
}

/**
 * Plans a roadmap grounded in an uploaded document rather than a typed goal —
 * same personalization and section/subtopic shape as `planCourse`, but the
 * content comes from what the source actually covers plus a small set of
 * AI-added topics (see `plan.enrichment`) that round the material into a
 * complete course.
 */
export async function planCourseFromDocument(
  sourceText: string,
  traits: LearnerTraits,
  truncated: boolean,
  language: LessonLanguage = "en"
): Promise<DocumentCoursePlan> {
  const plan = await generateStructured(
    buildDocumentCoursePrompt(sourceText, traits, truncated),
    documentCoursePlanSchema,
    "document course plan"
  );
  if (language === "en") return plan;

  const [translatedBase, enrichment] = await Promise.all([
    translateCoursePlan(plan, language),
    translateEnrichment(plan.enrichment, language),
  ]);
  return { ...translatedBase, enrichment };
}
