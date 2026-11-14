import { z } from "zod";
import { LearningProfile } from "@smart-ai/core/models/LearningProfile";
import { generateStructured } from "@smart-ai/core/services/aiContent.service";
import type { UserDocument } from "@smart-ai/core/models/User";

export const mistakeHuntSchema = z.object({
  topic: z.string().trim().min(2).max(120),
  difficulty: z.enum(["obvious", "subtle"]).default("subtle"),
});

const SENTENCES = 8;
const MISTAKES = 3;

const huntResultSchema = z
  .object({
    title: z.string().min(2).max(120),
    sentences: z
      .array(
        z.object({
          text: z.string().min(10).max(320),
          isWrong: z.boolean(),
          /** The sentence as it should read. Empty when the sentence is already right. */
          correction: z.string().max(320).default(""),
          /** Why it is wrong, or the fact that makes it right. */
          reason: z.string().min(5).max(400),
        })
      )
      .min(6)
      .max(10),
  })
  .refine((hunt) => {
    const wrong = hunt.sentences.filter((sentence) => sentence.isWrong);
    return wrong.length >= 2 && wrong.length <= 4 && wrong.every((sentence) => sentence.correction.trim().length > 0);
  }, `Between 2 and 4 sentences must have isWrong true, each with a non-empty correction`);

/**
 * Mistake Hunt: a short explanation of any topic with a few deliberate errors
 * planted in it, for the learner to catch. It trains the one reading skill that
 * matters more every year — not trusting a fluent, confident paragraph.
 *
 * Stateless and independent of lessons. The answer key ships with the passage:
 * this is solo practice with nothing riding on the score, so a second graded
 * round-trip would only add latency.
 */
export async function createMistakeHunt(user: UserDocument, body: z.infer<typeof mistakeHuntSchema>) {
  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  const level = profile?.traits?.knowledgeLevel ?? "intermediate";

  const difficultyRule =
    body.difficulty === "obvious"
      ? "Make each planted mistake clearly wrong to someone who knows the basics: a swapped cause and effect, a wrong well-known name, number or direction."
      : "Make each planted mistake subtle and plausible: a reversed relationship, a wrong-but-nearby number or unit, a true statement about the wrong thing, an overgeneralisation stated as a rule. It must still be unambiguously false, not a matter of opinion or wording.";

  const prompt = `Write a short explanation of "${body.topic}" as ${SENTENCES} separate sentences that read as one flowing paragraph, for a ${level}-level student. Exactly ${MISTAKES} of the sentences must contain one deliberate factual mistake each; all the others must be fully correct.

## RULES
- ${difficultyRule}
- The correct sentences must be CERTAINLY true and uncontroversial. If you are not sure of a fact, do not use it. A "correct" sentence that is actually wrong ruins the exercise.
- Every sentence must be checkable on its own: one clear claim, no "it" or "this" that depends on a previous sentence.
- Mistaken sentences must sound exactly as confident and natural as the correct ones. No hedging words, no hints.
- Spread the mistakes out. Do not put them all at the start or the end, and do not make the first sentence wrong.
- For a mistaken sentence: "correction" is the full corrected sentence, "reason" says in one or two sentences what was wrong.
- For a correct sentence: "correction" is an empty string, "reason" briefly confirms why it is true.
- No markdown symbols.

Return ONLY this JSON:
{
  "title": "<a short title for the passage>",
  "sentences": [
    { "text": "<the sentence as shown to the student>", "isWrong": <true or false>, "correction": "<corrected sentence, or empty>", "reason": "<why it is wrong, or why it is right>" }
  ]
}`;

  const hunt = await generateStructured(prompt, huntResultSchema, "mistake hunt");
  return { topic: body.topic, difficulty: body.difficulty, ...hunt };
}
