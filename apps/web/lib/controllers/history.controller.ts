import { z } from "zod";
import { Presentation } from "@smart-ai/core/models/Presentation";
import { RecentTopic } from "@smart-ai/core/models/RecentTopic";
import { History } from "@smart-ai/core/models/History";
import { serializePresentationSummary } from "@smart-ai/core/utils/serialize";
import type { Types } from "mongoose";

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

/** Paginated list of the learner's generated lessons, newest first. */
export async function listPresentations(
  userId: Types.ObjectId,
  { limit, page }: z.infer<typeof listQuerySchema>
) {
  const [items, total] = await Promise.all([
    Presentation.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Presentation.countDocuments({ userId }),
  ]);

  return {
    items: items.map(serializePresentationSummary),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Recently used topics for quick re-generation. */
export async function listRecentTopics(userId: Types.ObjectId) {
  const topics = await RecentTopic.find({ userId }).sort({ lastUsedAt: -1 }).limit(8).lean();
  return topics.map((topic) => ({
    topic: topic.topic,
    subject: topic.subject,
    count: topic.count,
    lastUsedAt: topic.lastUsedAt,
  }));
}

/** Raw activity feed (profile updates, generations, downloads). */
export async function listActivity(userId: Types.ObjectId) {
  const entries = await History.find({ userId }).sort({ createdAt: -1 }).limit(30).lean();
  return entries.map((entry) => ({
    id: String(entry._id),
    action: entry.action,
    topic: entry.topic ?? null,
    presentationId: entry.presentationId ? String(entry.presentationId) : null,
    meta: entry.meta ?? null,
    createdAt: entry.createdAt,
  }));
}
