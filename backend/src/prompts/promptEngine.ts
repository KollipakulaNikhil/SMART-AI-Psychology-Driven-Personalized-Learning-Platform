import { z } from "zod";
import type { LearnerTraits } from "../models/LearningProfile";
import { deriveGenerationParams, GenerationOptions, GenerationParams } from "./profileBuilder";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

/** Strict schema for what Gemini must return. Anything else is rejected and retried. */
export const generatedContentSchema = z.object({
  title: z.string().min(3).max(120),
  subject: z.string().min(2).max(60),
  summary: z.string().min(20).max(1200),
  slides: z
    .array(
      z.object({
        title: z.string().min(2).max(120),
        points: z.array(z.string().min(2).max(220)).min(3).max(8),
        imagePrompt: z.string().min(3).max(160),
        script: z.string().min(30).max(2400),
        // Optional: what the narrator "draws" on the digital board. Omitted
        // fields are backfilled server-side from points/title so rendering
        // never breaks if a model leaves it out.
        board: z
          .object({
            keyTerms: z.array(z.string().min(1).max(48)).min(1).max(6).optional(),
            notes: z.array(z.string().min(2).max(110)).max(4).optional(),
            diagram: z
              .object({
                type: z.enum(["flow", "cycle", "compare", "list", "none"]),
                nodes: z.array(z.string().min(1).max(40)).max(6).default([]),
              })
              .optional(),
          })
          .optional(),
      })
    )
    .min(4)
    .max(16),
  quiz: z
    .array(
      z.object({
        question: z.string().min(5).max(300),
        options: z.array(z.string().min(1).max(160)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(5).max(500),
      })
    )
    .min(2)
    .max(6),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;

const STYLE_DESCRIPTIONS: Record<LearnerTraits["learningStyle"], string> = {
  visual:
    "a VISUAL learner: they think in images. Slides must be image-forward with minimal text; every slide's imagePrompt matters as much as its points.",
  auditory:
    "an AUDITORY learner: they absorb through listening. The narration script is the primary channel — make it rich and self-contained; slide text is just an anchor.",
  reading:
    "a READING/WRITING learner: they learn from well-structured text. Slides may carry more complete sentences and precise wording.",
  kinesthetic:
    "a KINESTHETIC learner: they learn by doing. Frame concepts as actions, mini-exercises and 'try this' moments the learner can perform mentally or physically.",
};

/**
 * Builds the profile-adaptive generation prompt. This is the core of the
 * product: the same topic must produce measurably different lessons for
 * different psychological profiles.
 */
export function buildContentPrompt(
  topic: string,
  traits: LearnerTraits,
  focus?: string,
  options: GenerationOptions = {}
): { prompt: string; params: GenerationParams } {
  const params = deriveGenerationParams(traits, options);

  const prompt = `You are SMART AI, an expert instructional designer who adapts lessons to the psychology of each individual learner.

## THE LEARNER
This lesson is for ${STYLE_DESCRIPTIONS[traits.learningStyle]}
- Attention span: ${traits.attentionSpan}
- Preferred pace: ${traits.pace}
- Knowledge level in this area: ${traits.knowledgeLevel}
- Preferred tone: ${traits.tone}
- Desired depth: ${traits.depth}
- Motivation for learning: ${traits.motivation}
- Memory strategy that works for them: ${traits.memoryType}

## THE TASK
Write a complete lesson that will be delivered as a VIDEO: a human-sounding narrator stands at a digital board, speaks the "script" out loud, and writes the "board" content as they go. This is NOT a slideshow of bullet points — it is a person explaining on a board. Topic: "${topic}"${focus ? `\nThe learner specifically wants to focus on: "${focus}"` : ""}

## HOW THE NARRATOR SHOULD SPEAK (this matters most)
${params.deliveryStyle}
${params.narrationStyle}

## HARD REQUIREMENTS — follow every one exactly
1. Produce EXACTLY ${params.slideCount} slides. Slide 1 opens with a hook that pulls the learner in; the final slide wraps up with the key takeaways.
2. Each slide's "script" is the spoken narration for that slide: roughly ${params.scriptWordsPerSlide} words (±20%), written as natural speech per the rules above.${params.durationLine ? `\n   ${params.durationLine}` : ""}
3. ${params.explanationRule}
4. Each slide's "board.keyTerms" are the 2-5 short words or phrases the narrator writes on the board on that slide (each under 6 words). They must be the exact terms the script emphasises.
5. ${params.boardNotesRule}
6. ${params.boardGuidance}
7. When a slide's concept is a process, relationship, cycle or comparison, include "board.diagram" with a fitting "type" ("flow" for A→B→C steps, "cycle" for a repeating loop, "compare" for two contrasting sides, "list" for grouped items) and 2-6 short "nodes". Use "none" only for a pure intro/outro slide.
8. Each slide has 3 to ${params.maxPointsPerSlide} "points" (each AT MOST ${params.maxWordsPerPoint} words). These go into a downloadable deck the learner revises from WITHOUT the narration, so every point must be a complete, self-contained statement that teaches something — a definition, a rule, a cause, a consequence, a concrete figure. Never a bare label or a two-word fragment, and never a point that only makes sense if you heard the script.
9. ${params.terminology}
10. ${params.analogyRule}
11. ${params.structureRule}
12. ${params.encouragement}
13. Each slide's "imagePrompt" is a 2–6 word ENGLISH stock-photo search query for a real photograph illustrating the slide (e.g. "neuron microscope closeup"). Real photographic subjects only — never text, charts or abstract art.
14. Include EXACTLY ${params.quizCount} quiz questions on the core ideas, each with exactly 4 options and one correct answer, at a ${traits.knowledgeLevel} difficulty.
15. "subject" is the broad category (e.g. "Physics", "Programming", "History"). "summary" is a ${traits.attentionSpan === "low" ? "3-sentence" : "short-paragraph"} recap in the narrator's spoken voice.
16. Every field must contain real, specific content. NEVER output an empty string or copy the angle-bracket hints below — they describe what belongs there, they are not literal values.
17. ACCURACY OUTRANKS EVERY OTHER RULE HERE. Definitions, formulas, figures, units, dates and quiz answers must be factually correct and match the standard treatment of the subject — the learner will memorise whatever you write, so a confident wrong statement does real damage. If you are unsure of a specific number or statistic, describe the relationship qualitatively instead of inventing a value, and never invent sources, citations or named studies.

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no commentary, no trailing commas:
{
  "title": "<catchy but accurate lesson title, at least 3 words>",
  "subject": "<broad category such as Physics, Programming, History>",
  "summary": "<lesson recap in the narrator's spoken voice>",
  "slides": [
    {
      "title": "<slide title, at least 3 words>",
      "points": ["<standalone bullet statement for the slide deck>"],
      "imagePrompt": "<2-6 word photo search query>",
      "script": "<spoken narration paragraph, natural speech>",
      "board": {
        "keyTerms": ["<short term the narrator writes>", "<another>"],
        "notes": ["<short written explanation line for the board>"],
        "diagram": { "type": "flow", "nodes": ["<step 1>", "<step 2>", "<step 3>"] }
      }
    }
  ],
  "quiz": [
    { "question": "<full question sentence>", "options": ["<option A>", "<option B>", "<option C>", "<option D>"], "correctIndex": 0, "explanation": "<why that option is correct>" }
  ]
}`;

  return { prompt, params };
}

/** Follow-up prompt used when the first response fails JSON/schema validation. */
export function buildRepairPrompt(brokenOutput: string, validationError: string): string {
  return `Your previous response failed validation and could not be used.

Validation error:
${validationError}

Your previous response (possibly truncated):
${brokenOutput.slice(0, 4000)}

Regenerate the FULL response as ONLY a valid JSON object matching the required structure exactly. No markdown fences, no commentary.`;
}

/** Strips markdown fences and leading chatter that models occasionally emit despite instructions. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return candidate.slice(start, end + 1);
}

function parseGeneratedContent(raw: string): GeneratedContent {
  const json = JSON.parse(extractJson(raw));
  return generatedContentSchema.parse(json);
}

export interface LessonGenerationResult {
  content: GeneratedContent;
  params: GenerationParams;
}

/**
 * Generic "ask → validate → repair once" for ANY strict-JSON generation
 * (course syllabi, future structured outputs). The lesson pipeline uses the
 * specialised runContentGeneration below.
 */
export async function runStructuredGeneration<T>(
  callModel: (prompt: string) => Promise<string>,
  prompt: string,
  schema: z.ZodType<T>,
  providerLabel: string
): Promise<T> {
  const firstRaw = await callModel(prompt);
  try {
    return schema.parse(JSON.parse(extractJson(firstRaw)));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`${providerLabel} structured output failed validation, attempting repair round`, { reason });
    const repairRaw = await callModel(`${prompt}\n\n${buildRepairPrompt(firstRaw, reason)}`);
    try {
      return schema.parse(JSON.parse(extractJson(repairRaw)));
    } catch (repairError) {
      logger.error(`${providerLabel} structured repair round also failed`, {
        reason: repairError instanceof Error ? repairError.message : String(repairError),
      });
      throw ApiError.serviceUnavailable(
        `The ${providerLabel} engine returned an invalid structure. Please try again.`
      );
    }
  }
}

function countScriptWords(content: GeneratedContent): number {
  return content.slides.reduce(
    (sum, slide) => sum + slide.script.split(/\s+/).filter(Boolean).length,
    0
  );
}

/**
 * Provider-agnostic "ask, validate, repair once" contract: any model call
 * that returns raw text can be plugged in here, so Gemini, Groq or a future
 * provider all get identical validation and one repair attempt on failure.
 * When a duration was chosen, the total narration length is ALSO enforced —
 * models chronically under-write, so a short lesson gets one expansion round.
 */
export async function runContentGeneration(
  callModel: (prompt: string) => Promise<string>,
  topic: string,
  traits: LearnerTraits,
  focus: string | undefined,
  providerLabel: string,
  options: GenerationOptions = {}
): Promise<LessonGenerationResult> {
  const { prompt, params } = buildContentPrompt(topic, traits, focus, options);

  let content: GeneratedContent;
  const firstRaw = await callModel(prompt);
  try {
    content = parseGeneratedContent(firstRaw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`${providerLabel} output failed validation, attempting repair round`, { reason });

    const repairRaw = await callModel(`${prompt}\n\n${buildRepairPrompt(firstRaw, reason)}`);
    try {
      content = parseGeneratedContent(repairRaw);
    } catch (repairError) {
      logger.error(`${providerLabel} repair round also failed validation`, {
        reason: repairError instanceof Error ? repairError.message : String(repairError),
      });
      throw ApiError.serviceUnavailable(
        `The ${providerLabel} content engine returned an invalid lesson structure. Please try again.`
      );
    }
  }

  // Duration contract: if the learner picked a length and the narration came
  // back >22% short, demand a fuller rewrite once and keep whichever is longer.
  if (params.targetTotalWords) {
    const words = countScriptWords(content);
    if (words < params.targetTotalWords * 0.78) {
      const minPerSlide = Math.round((params.targetTotalWords / content.slides.length) * 0.85);
      logger.warn(
        `${providerLabel} lesson too short (${words}/${params.targetTotalWords} words) — requesting expansion`
      );
      const expandPrompt = `${prompt}

## FEEDBACK ON YOUR PREVIOUS ATTEMPT
It was structurally valid but FAR TOO SHORT: only ${words} total spoken words versus the required ~${params.targetTotalWords}. The learner explicitly chose this lesson length. Regenerate the COMPLETE lesson JSON — same topic, same rules — but expand every "script" with deeper explanation, one more concrete example, and fuller spoken transitions, so each script is AT LEAST ${minPerSlide} words.`;
      try {
        const expanded = parseGeneratedContent(await callModel(expandPrompt));
        if (countScriptWords(expanded) > words) {
          logger.info(
            `${providerLabel} expansion accepted (${countScriptWords(expanded)} words, was ${words})`
          );
          content = expanded;
        }
      } catch (error) {
        logger.warn(`${providerLabel} expansion round failed — keeping the shorter lesson`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { content, params };
}
