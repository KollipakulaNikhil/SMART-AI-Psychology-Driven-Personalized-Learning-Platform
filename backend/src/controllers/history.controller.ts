import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { Presentation } from "../models/Presentation";
import { RecentTopic } from "../models/RecentTopic";
import { History } from "../models/History";
import { serializePresentationSummary } from "../utils/serialize";

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

/** Paginated list of the learner's generated lessons, newest first. */
export const listPresentations = asyncHandler(async (req, res) => {
  const { limit, page } = req.query as unknown as z.infer<typeof listQuerySchema>;
  const userId = req.user!._id;

  const [items, total] = await Promise.all([
    Presentation.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Presentation.countDocuments({ userId }),
  ]);

  res.json({
    success: true,
    data: {
      items: items.map(serializePresentationSummary),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

/** Recently used topics for quick re-generation. */
export const listRecentTopics = asyncHandler(async (req, res) => {
  const topics = await RecentTopic.find({ userId: req.user!._id })
    .sort({ lastUsedAt: -1 })
    .limit(8)
    .lean();

  res.json({
    success: true,
    data: topics.map((topic) => ({
      topic: topic.topic,
      subject: topic.subject,
      count: topic.count,
      lastUsedAt: topic.lastUsedAt,
    })),
  });
});

/** Raw activity feed (profile updates, generations, downloads). */
export const listActivity = asyncHandler(async (req, res) => {
  const entries = await History.find({ userId: req.user!._id })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  res.json({
    success: true,
    data: entries.map((entry) => ({
      id: String(entry._id),
      action: entry.action,
      topic: entry.topic ?? null,
      presentationId: entry.presentationId ? String(entry.presentationId) : null,
      meta: entry.meta ?? null,
      createdAt: entry.createdAt,
    })),
  });
});
