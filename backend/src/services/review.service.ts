import { Types } from "mongoose";
import { ReviewItem, ReviewItemDocument } from "../models/ReviewItem";
import { User, UserDocument } from "../models/User";
import { logger } from "../utils/logger";

/**
 * Smart Review scheduling — an SM-2-style spaced-repetition algorithm.
 * Quiz performance maps to SM-2 "quality" (0-5); good recalls stretch the
 * interval (1 → 3 → interval×EF days), a failed recall resets to tomorrow.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduleUpdate {
  nextReviewAt: Date;
  intervalDays: number;
  repetitions: number;
}

export function computeNextSchedule(
  current: { easiness: number; intervalDays: number; repetitions: number },
  scorePct: number
): { easiness: number; intervalDays: number; repetitions: number } {
  const quality = Math.round((Math.max(0, Math.min(100, scorePct)) / 100) * 5);

  // Standard SM-2 easiness update, floored at 1.3.
  const easiness = Math.max(
    1.3,
    current.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  if (quality < 3) {
    // Failed recall: start over, see it again tomorrow.
    return { easiness, intervalDays: 1, repetitions: 0 };
  }

  const repetitions = current.repetitions + 1;
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(current.intervalDays * easiness);
  return { easiness, intervalDays: Math.min(180, intervalDays), repetitions };
}

/** Records a quiz result into the lesson's review schedule (upserting on first attempt). */
export async function updateReviewSchedule(
  userId: Types.ObjectId,
  presentationId: Types.ObjectId,
  topic: string,
  subject: string,
  scorePct: number
): Promise<ReviewItemDocument> {
  const existing = await ReviewItem.findOne({ userId, presentationId });
  const base = existing ?? { easiness: 2.5, intervalDays: 1, repetitions: 0 };
  const next = computeNextSchedule(base, scorePct);

  return ReviewItem.findOneAndUpdate(
    { userId, presentationId },
    {
      $set: {
        topic,
        subject,
        easiness: next.easiness,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        dueAt: new Date(Date.now() + next.intervalDays * DAY_MS),
        lastScorePct: Math.round(scorePct),
        lastReviewedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ) as Promise<ReviewItemDocument>;
}

function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Counts today toward the study streak: same day is idempotent, consecutive
 * days increment, a gap resets to 1. Fire-and-forget safe.
 */
export async function touchStudyStreak(user: UserDocument): Promise<number> {
  const today = localDateKey(new Date());
  if (user.lastStudyDate === today) return user.studyStreak;

  const yesterday = localDateKey(new Date(Date.now() - DAY_MS));
  const nextStreak = user.lastStudyDate === yesterday ? user.studyStreak + 1 : 1;

  try {
    await User.updateOne(
      { _id: user._id },
      { $set: { studyStreak: nextStreak, lastStudyDate: today } }
    );
    user.studyStreak = nextStreak;
    user.lastStudyDate = today;
  } catch (error) {
    logger.warn("Failed to update study streak", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return nextStreak;
}
