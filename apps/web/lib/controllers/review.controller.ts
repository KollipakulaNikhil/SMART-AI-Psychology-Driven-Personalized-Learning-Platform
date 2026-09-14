import { z } from "zod";
import { Types } from "mongoose";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { Presentation } from "@smart-ai/core/models/Presentation";
import { ReviewItem } from "@smart-ai/core/models/ReviewItem";
import { QuizAttempt } from "@smart-ai/core/models/QuizAttempt";
import { Course } from "@smart-ai/core/models/Course";
import { touchStudyStreak, updateReviewSchedule } from "@smart-ai/core/services/review.service";
import { logHistory } from "@smart-ai/core/services/history.service";
import type { UserDocument } from "@smart-ai/core/models/User";

export const submitQuizSchema = z.object({
  presentationId: z.string().refine(Types.ObjectId.isValid, "Invalid lesson id"),
  /** Chosen option index per quiz question, in order. */
  answers: z.array(z.number().int().min(0).max(3)).min(1).max(10),
});

export const playAnswerSchema = z.object({
  presentationId: z.string().refine(Types.ObjectId.isValid, "Invalid lesson id"),
  questionIndex: z.number().int().min(0).max(9),
  /** Chosen option, or null when the round timer ran out. */
  answer: z.number().int().min(0).max(3).nullable(),
});

/**
 * Grades ONE question for the game mode. The answer key never reaches the
 * client ahead of time — each question is revealed only after it has been
 * answered (or timed out). The game records the whole run through
 * `submitQuizAttempt` at the summit, so this endpoint writes nothing.
 */
export async function checkPlayAnswer(user: UserDocument, body: z.infer<typeof playAnswerSchema>) {
  const { presentationId, questionIndex, answer } = body;
  const presentation = await Presentation.findById(presentationId).select("userId quiz").lean();
  if (!presentation) throw ApiError.notFound("Lesson not found");
  if (String(presentation.userId) !== String(user._id)) throw ApiError.forbidden();

  const question = presentation.quiz[questionIndex];
  if (!question) throw ApiError.badRequest("No such question");

  return {
    correct: answer !== null && answer === question.correctIndex,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
  };
}

/** Lessons due (or overdue) for a Smart Review, most overdue first. */
export async function listDueReviews(user: UserDocument) {
  const userId = user._id;
  const now = new Date();

  const [due, upcoming] = await Promise.all([
    ReviewItem.find({ userId, dueAt: { $lte: now } }).sort({ dueAt: 1 }).limit(10).lean(),
    ReviewItem.find({ userId, dueAt: { $gt: now } }).sort({ dueAt: 1 }).limit(3).lean(),
  ]);

  const serialize = (item: (typeof due)[number]) => ({
    presentationId: String(item.presentationId),
    topic: item.topic,
    subject: item.subject,
    dueAt: item.dueAt,
    lastScorePct: item.lastScorePct,
    repetitions: item.repetitions,
  });

  return { due: due.map(serialize), upcoming: upcoming.map(serialize) };
}

/**
 * Grades a quiz server-side, records the attempt, feeds the SM-2 review
 * schedule, counts the study streak, and completes the course module the
 * lesson belongs to (at ≥60%).
 */
export async function submitQuizAttempt(user: UserDocument, body: z.infer<typeof submitQuizSchema>) {
  const { presentationId, answers } = body;
  const presentation = await Presentation.findById(presentationId);
  if (!presentation) throw ApiError.notFound("Lesson not found");
  if (!presentation.userId.equals(user._id)) throw ApiError.forbidden();
  if (presentation.quiz.length === 0) throw ApiError.unprocessable("This lesson has no quiz");
  if (answers.length !== presentation.quiz.length) {
    throw ApiError.badRequest(`Expected ${presentation.quiz.length} answers, received ${answers.length}`);
  }

  const score = presentation.quiz.reduce(
    (sum, question, index) => sum + (question.correctIndex === answers[index] ? 1 : 0),
    0
  );
  const total = presentation.quiz.length;
  const scorePct = (score / total) * 100;

  const priorAttempts = await QuizAttempt.countDocuments({ userId: user._id, presentationId: presentation._id });

  await QuizAttempt.create({
    userId: user._id,
    presentationId: presentation._id,
    topic: presentation.topic,
    answers,
    score,
    total,
    isReview: priorAttempts > 0,
  });

  const reviewItem = await updateReviewSchedule(
    user._id,
    presentation._id,
    presentation.topic,
    presentation.subject,
    scorePct
  );
  const streak = await touchStudyStreak(user);

  // Course integration: a passing score completes the module this lesson belongs to.
  if (scorePct >= 60) {
    await Course.updateOne(
      { userId: user._id, "modules.presentationId": presentation._id },
      { $set: { "modules.$.status": "completed", "modules.$.completedAt": new Date() } }
    );
  }

  logHistory(user._id, "quiz_completed", {
    presentationId: presentation._id,
    topic: presentation.topic,
    meta: { score, total, scorePct: Math.round(scorePct) },
  });

  return {
    score,
    total,
    scorePct: Math.round(scorePct),
    passed: scorePct >= 60,
    nextReviewAt: reviewItem.dueAt,
    intervalDays: reviewItem.intervalDays,
    streak,
    answerKey: presentation.quiz.map((q) => ({ correctIndex: q.correctIndex, explanation: q.explanation })),
  };
}
