import { z } from "zod";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { Presentation } from "../models/Presentation";
import { ReviewItem } from "../models/ReviewItem";
import { QuizAttempt } from "../models/QuizAttempt";
import { Course } from "../models/Course";
import { touchStudyStreak, updateReviewSchedule } from "../services/review.service";
import { logHistory } from "../services/history.service";

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
 * answered (or timed out), which is what makes the score honest. The game
 * records the whole run through `submitQuizAttempt` at the summit, so this
 * endpoint deliberately writes nothing.
 */
export const checkPlayAnswer = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { presentationId, questionIndex, answer } = req.body as z.infer<typeof playAnswerSchema>;

  const presentation = await Presentation.findById(presentationId).select("userId quiz").lean();
  if (!presentation) throw ApiError.notFound("Lesson not found");
  if (String(presentation.userId) !== String(user._id)) throw ApiError.forbidden();

  const question = presentation.quiz[questionIndex];
  if (!question) throw ApiError.badRequest("No such question");

  res.json({
    success: true,
    data: {
      correct: answer !== null && answer === question.correctIndex,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    },
  });
});

/** Lessons due (or overdue) for a Smart Review, most overdue first. */
export const listDueReviews = asyncHandler(async (req, res) => {
  const userId = req.user!._id;
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

  res.json({
    success: true,
    data: { due: due.map(serialize), upcoming: upcoming.map(serialize) },
  });
});

/**
 * Grades a quiz server-side, records the attempt, feeds the SM-2 review
 * schedule, counts the study streak, and completes the course module the
 * lesson belongs to (at ≥60%).
 */
export const submitQuizAttempt = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { presentationId, answers } = req.body as z.infer<typeof submitQuizSchema>;

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

  res.json({
    success: true,
    data: {
      score,
      total,
      scorePct: Math.round(scorePct),
      passed: scorePct >= 60,
      nextReviewAt: reviewItem.dueAt,
      intervalDays: reviewItem.intervalDays,
      streak,
      answerKey: presentation.quiz.map((q) => ({ correctIndex: q.correctIndex, explanation: q.explanation })),
    },
  });
});
