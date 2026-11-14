import { z } from "zod";
import { PSYCHOLOGY_QUESTIONS } from "@smart-ai/core/prompts/questions";
import { buildLearnerProfile } from "@smart-ai/core/prompts/profileBuilder";
import { CHALLENGE_QUESTIONS, buildProfileFromDiscovery, discoverySignalsSchema } from "@smart-ai/core/prompts/discovery";
import { LearningProfile } from "@smart-ai/core/models/LearningProfile";
import { logHistory } from "@smart-ai/core/services/history.service";
import type { UserDocument } from "@smart-ai/core/models/User";
import { withStatus } from "@/lib/api/apiHandler";

export const submitAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        // Multi-select: one or more options per question, each casting its votes.
        optionIds: z.array(z.string().min(1)).min(1).max(4),
      })
    )
    .length(PSYCHOLOGY_QUESTIONS.length),
});

/** Public question set — trait votes are stripped so scoring cannot be gamed from the client. */
export function getQuestions() {
  return PSYCHOLOGY_QUESTIONS.map((question) => ({
    id: question.id,
    category: question.category,
    text: question.text,
    multiSelect: true,
    options: question.options.map((option) => ({ id: option.id, label: option.label })),
  }));
}

/** Scores the 20 answers into a learner profile and stores it (retakes bump the version). */
export async function submitAnswers(user: UserDocument, { answers }: z.infer<typeof submitAnswersSchema>) {
  const traits = buildLearnerProfile(answers);
  const existing = await LearningProfile.findOne({ userId: user._id });

  const profile = await LearningProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: { traits, answers, completedAt: new Date() },
      $inc: { version: 1 },
    },
    { upsert: true, new: true }
  );

  logHistory(user._id, existing ? "profile_updated" : "profile_created", {
    meta: { version: profile.version },
  });

  return withStatus(
    { traits: profile.traits, version: profile.version, completedAt: profile.completedAt },
    existing ? 200 : 201
  );
}

export const submitDiscoverySchema = z.object({ signals: discoverySignalsSchema });

/** The reasoning questions for the discovery flow — answer key withheld. */
export function getDiscoveryChallenge() {
  return CHALLENGE_QUESTIONS.map((q) => ({ id: q.id, text: q.text, options: [...q.options] }));
}

/**
 * Scores what the learner actually did in the discovery activities into the
 * same LearnerTraits the survey used to produce (retakes bump the version).
 */
export async function submitDiscovery(user: UserDocument, { signals }: z.infer<typeof submitDiscoverySchema>) {
  const traits = buildProfileFromDiscovery(signals);
  const existing = await LearningProfile.findOne({ userId: user._id });

  const profile = await LearningProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: { traits, answers: [], method: "discovery", signals, completedAt: new Date() },
      $inc: { version: 1 },
    },
    { upsert: true, new: true }
  );

  logHistory(user._id, existing ? "profile_updated" : "profile_created", {
    meta: { version: profile.version, method: "discovery" },
  });

  return withStatus(
    { traits: profile.traits, version: profile.version, completedAt: profile.completedAt },
    existing ? 200 : 201
  );
}
