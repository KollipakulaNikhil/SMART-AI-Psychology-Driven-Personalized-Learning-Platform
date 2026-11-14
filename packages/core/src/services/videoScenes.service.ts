import { z } from "zod";
import { logger } from "../utils/logger";
import { generateStructured } from "./aiContent.service";
import type { SlideContent } from "../models/Presentation";

/**
 * Turns a lesson's slides into shot prompts for a text-to-video model
 * (Wan 2.2), so the lesson video is drawn as animated scenes instead of
 * slide stills.
 *
 * A video model needs a very different brief from a slide: one concrete
 * subject, visible motion, a camera move, a look — and NO words, because
 * diffusion video models render text as garbled glyphs. The narration and
 * the burned-in captions carry the language; these shots carry the picture.
 *
 * Same resilience contract as studyNotes.service: small sequential batches,
 * and a batch that fails falls back to a prompt derived from the slide
 * itself, so the video job never dies on a prompt-writing error.
 */

const BATCH_SIZE = 4;
const SCRIPT_EXCERPT_CHARS = 600;

/** Appended to every prompt so all shots in one lesson share a look. */
export const SCENE_STYLE =
  "2D animated explainer style, clean flat vector illustration, soft cinematic lighting, harmonious colour palette, smooth fluid motion, highly detailed, no text, no letters, no captions, no watermark";

const batchSchema = z.object({
  slides: z.array(z.object({ scenes: z.array(z.string().min(15).max(600)).min(1) })),
});

function fallbackPrompt(slide: Pick<SlideContent, "title" | "imagePrompt">, variant: number): string {
  const subject = slide.imagePrompt?.trim() || slide.title;
  const camera = variant % 2 === 0 ? "slow push-in camera" : "gentle sideways tracking shot";
  return `An animated illustration of ${subject}, visually explaining "${slide.title}", elements moving and transforming gently, ${camera}. ${SCENE_STYLE}`;
}

function buildPrompt(topic: string, batch: { title: string; points: string[]; script: string; shots: number }[]): string {
  return `You are the storyboard artist for a short animated educational video about "${topic}". For each slide below, write the text-to-video prompts ("shots") that will be drawn by an AI video model while the narration plays.

## RULES FOR EVERY SHOT
1. One shot = one continuous 5-second moving image. Describe, in 35 to 70 words: the main subject, what is MOVING or CHANGING, the setting, and one camera move (slow push-in, pan, orbit, tracking shot).
2. Show the IDEA itself as a concrete visual or visual metaphor a student would recognise — the actual process, object, organism, machine or situation the slide teaches. Never a classroom, a teacher, a person at a whiteboard, a slide, a screen or a chart with labels.
3. NO text of any kind in the picture: no words, letters, numbers, formulas, labels, signs or captions. The model cannot draw text.
4. Be factually faithful to the slide: the right parts, in the right order and relationship. If the concept is abstract, pick a simple, accurate physical metaphor.
5. Write "scenes" with EXACTLY the number of shots given in that slide's "shots" field. When a slide has several shots, they must show different moments of the explanation, in narration order.
6. Plain English sentences only. Do not mention style, resolution or quality — that is added separately.

## SLIDES
${JSON.stringify(batch, null, 2)}

## OUTPUT — return ONLY this JSON object, no commentary, no code fences. One entry in "slides" per slide above, in the SAME ORDER.
{
  "slides": [
    { "scenes": ["<shot description>", "<next shot description>"] }
  ]
}`;
}

/**
 * Writes `counts[i]` shot prompts for slide i (0 = slide gets no shots).
 * Always returns exactly that many prompts per slide.
 */
export async function generateScenePrompts(
  topic: string,
  slides: Pick<SlideContent, "title" | "points" | "script" | "imagePrompt">[],
  counts: number[]
): Promise<string[][]> {
  const results: string[][] = slides.map((slide, i) =>
    Array.from({ length: counts[i] ?? 0 }, (_, variant) => fallbackPrompt(slide, variant))
  );

  const wanted = slides.map((_, i) => i).filter((i) => (counts[i] ?? 0) > 0);

  for (let start = 0; start < wanted.length; start += BATCH_SIZE) {
    const indexes = wanted.slice(start, start + BATCH_SIZE);
    const label = `video scenes for slides ${indexes.map((i) => i + 1).join(",")}`;
    try {
      const { slides: written } = await generateStructured(
        buildPrompt(
          topic,
          indexes.map((i) => ({
            title: slides[i].title,
            points: slides[i].points,
            script: slides[i].script.slice(0, SCRIPT_EXCERPT_CHARS),
            shots: counts[i],
          }))
        ),
        batchSchema,
        label
      );
      if (written.length !== indexes.length) {
        logger.warn(`${label} returned ${written.length} entries for ${indexes.length} slides — using fallback prompts`);
        continue;
      }
      written.forEach((entry, offset) => {
        const slideIndex = indexes[offset];
        // Too few shots: keep the fallback for the missing ones. Too many: drop the extras.
        entry.scenes.slice(0, counts[slideIndex]).forEach((scene, j) => {
          results[slideIndex][j] = `${scene.trim().replace(/\s+/g, " ")} ${SCENE_STYLE}`;
        });
      });
    } catch (error) {
      logger.warn(`${label} failed — using prompts derived from the slides`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * How many shots each slide gets: roughly one per `secPerShot` of narration,
 * capped per slide, and trimmed so the whole lesson stays inside its budget
 * (every slide gets one shot before any slide gets a second).
 */
export function planSceneCounts(
  durationsSec: number[],
  limits: { perSlide: number; perLesson: number; secPerShot?: number }
): number[] {
  const secPerShot = limits.secPerShot ?? 18;
  const desired = durationsSec.map((d) => Math.min(limits.perSlide, Math.max(1, Math.ceil(d / secPerShot))));
  const counts = durationsSec.map(() => 0);
  let remaining = limits.perLesson;
  for (let round = 0; round < limits.perSlide && remaining > 0; round++) {
    for (let i = 0; i < counts.length && remaining > 0; i++) {
      if (counts[i] === round && desired[i] > round) {
        counts[i]++;
        remaining--;
      }
    }
  }
  return counts;
}
