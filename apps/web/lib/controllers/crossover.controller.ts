import { z } from "zod";
import { Types } from "mongoose";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { Presentation } from "@smart-ai/core/models/Presentation";
import { LearningProfile } from "@smart-ai/core/models/LearningProfile";
import { generateStructured } from "@smart-ai/core/services/aiContent.service";
import type { UserDocument } from "@smart-ai/core/models/User";

const lessonId = z.string().refine(Types.ObjectId.isValid, "Invalid lesson id");

export const crossoverSchema = z
  .object({ firstId: lessonId, secondId: lessonId })
  .refine((body) => body.firstId !== body.secondId, "Pick two different lessons");

const crossoverResultSchema = z.object({
  bridge: z.string().min(10).max(400),
  links: z
    .array(
      z.object({
        first: z.string().min(1).max(120),
        second: z.string().min(1).max(120),
        why: z.string().min(5).max(400),
      })
    )
    .min(2)
    .max(5),
  breaksAt: z.string().min(5).max(500),
  challenge: z.object({
    question: z.string().min(10).max(500),
    answer: z.string().min(5).max(700),
  }),
});

export type CrossoverResult = z.infer<typeof crossoverResultSchema>;

type LessonLean = NonNullable<Awaited<ReturnType<typeof loadLesson>>>;

async function loadLesson(id: string, userId: Types.ObjectId) {
  const lesson = await Presentation.findById(id).lean();
  if (!lesson) throw ApiError.notFound("Lesson not found");
  if (!lesson.userId.equals(userId)) throw ApiError.forbidden();
  return lesson;
}

/**
 * Titles, key terms and board notes only — never the narration. Two full
 * scripts would be most of a small provider's per-minute token budget, and the
 * board is already the distilled version of each slide.
 */
function outline(lesson: LessonLean): string {
  return lesson.slides
    .map((slide) => {
      const terms = slide.board?.keyTerms?.length ? ` [${slide.board.keyTerms.join(", ")}]` : "";
      const notes = slide.board?.notes?.length ? slide.board.notes : slide.points;
      return `- ${slide.title}${terms}: ${notes.slice(0, 3).join(" | ")}`;
    })
    .join("\n")
    .slice(0, 2600);
}

/**
 * Crossover: takes two lessons the learner has already studied — usually from
 * unrelated subjects — and finds the structure they share, so one becomes a
 * way of remembering the other. Stateless: nothing is stored.
 */
export async function createCrossover(user: UserDocument, body: z.infer<typeof crossoverSchema>) {
  const [first, second] = await Promise.all([
    loadLesson(body.firstId, user._id),
    loadLesson(body.secondId, user._id),
  ]);

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  const traits = profile?.traits ?? first.profileSnapshot;

  const prompt = `A student has studied two separate lessons. Your job is to connect them: find the deep structure the two topics genuinely share, so that understanding one helps the student remember and reason about the other.

## LESSON A — "${first.title}" (${first.subject})
${outline(first)}

## LESSON B — "${second.title}" (${second.subject})
${outline(second)}

## THE STUDENT
Knowledge level: ${traits.knowledgeLevel}. Tone they respond to: ${traits.tone}. Write in plain, direct language at that level.

## RULES
- ACCURACY OUTRANKS CLEVERNESS. Every link must be a real structural or functional parallel (same role, same mechanism, same trade-off, same failure mode) — never a pun, a shared word, or a vague "both are important".
- Use concepts that actually appear in the lesson outlines above. Do not invent content the lessons did not teach.
- "first" is a concept from Lesson A, "second" is the matching concept from Lesson B, "why" explains in one or two sentences what makes them play the same role.
- "breaksAt" must honestly say where the comparison stops working, so the student does not over-trust it. If the two topics are barely related, say so there.
- "challenge.question" must require BOTH lessons to answer: the student applies an idea from one lesson to a situation from the other. "challenge.answer" is a clear model answer.
- No markdown symbols.

Return ONLY this JSON:
{
  "bridge": "<one or two sentences: the single big idea both lessons share>",
  "links": [
    { "first": "<concept from Lesson A>", "second": "<matching concept from Lesson B>", "why": "<why they play the same role>" }
  ],
  "breaksAt": "<where the comparison fails>",
  "challenge": { "question": "<a question that needs both lessons>", "answer": "<model answer>" }
}
Give 3 to 5 links.`;

  const result = await generateStructured(prompt, crossoverResultSchema, "lesson crossover");

  return {
    first: { id: first._id.toString(), title: first.title || first.topic, subject: first.subject },
    second: { id: second._id.toString(), title: second.title || second.topic, subject: second.subject },
    ...result,
  };
}
