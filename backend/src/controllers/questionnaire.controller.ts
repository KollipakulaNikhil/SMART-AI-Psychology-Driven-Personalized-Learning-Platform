import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { PSYCHOLOGY_QUESTIONS } from "../prompts/questions";
import { buildLearnerProfile } from "../prompts/profileBuilder";
import { LearningProfile } from "../models/LearningProfile";
import { logHistory } from "../services/history.service";

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
export const getQuestions = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: PSYCHOLOGY_QUESTIONS.map((question) => ({
      id: question.id,
      category: question.category,
      text: question.text,
      multiSelect: true,
      options: question.options.map((option) => ({ id: option.id, label: option.label })),
    })),
  });
});

/** Scores the 20 answers into a learner profile and stores it (retakes bump the version). */
export const submitAnswers = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { answers } = req.body as z.infer<typeof submitAnswersSchema>;

  const traits = buildLearnerProfile(answers);
  const existing = await LearningProfile.findOne({ userId: user._id });

  const profile = await LearningProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: { traits, answers, completedAt: new Date() },
      // $inc on a missing field initializes it, so this yields version=1 on
      // insert and increments by 1 on every retake — no $setOnInsert needed
      // (Mongo rejects $inc and $setOnInsert touching the same path anyway).
      $inc: { version: 1 },
    },
    { upsert: true, new: true }
  );

  logHistory(user._id, existing ? "profile_updated" : "profile_created", {
    meta: { version: profile.version },
  });

  res.status(existing ? 200 : 201).json({
    success: true,
    data: { traits: profile.traits, version: profile.version, completedAt: profile.completedAt },
  });
});
