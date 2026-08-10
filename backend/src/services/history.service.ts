import { Types } from "mongoose";
import { History, HistoryAction } from "../models/History";
import { RecentTopic } from "../models/RecentTopic";
import { logger } from "../utils/logger";

/** Fire-and-forget activity log — history failures must never break generation. */
export function logHistory(
  userId: Types.ObjectId,
  action: HistoryAction,
  data: { presentationId?: Types.ObjectId; topic?: string; meta?: Record<string, unknown> } = {}
): void {
  History.create({ userId, action, ...data }).catch((error) =>
    logger.warn("Failed to write history entry", { action, error: error.message })
  );
}

export async function touchRecentTopic(
  userId: Types.ObjectId,
  topic: string,
  subject: string
): Promise<void> {
  await RecentTopic.findOneAndUpdate(
    { userId, topic: topic.trim() },
    { $inc: { count: 1 }, $set: { lastUsedAt: new Date(), subject } },
    { upsert: true, setDefaultsOnInsert: true }
  );
}
