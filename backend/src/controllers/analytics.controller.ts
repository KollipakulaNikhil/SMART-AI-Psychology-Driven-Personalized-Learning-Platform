import { asyncHandler } from "../utils/asyncHandler";
import { Presentation } from "../models/Presentation";
import { GeneratedVideo } from "../models/GeneratedVideo";
import { RecentTopic } from "../models/RecentTopic";
import { QuizAttempt } from "../models/QuizAttempt";
import { ReviewItem } from "../models/ReviewItem";

/** Dashboard analytics: volumes, learning time, favorite subjects, mastery, streak. */
export const getAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user!._id;

  const [lessonStats, videoStats, favoriteSubjects, quizStats, dueReviewCount] = await Promise.all([
    Presentation.aggregate<{ _id: null; lessons: number; slides: number }>([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          lessons: { $sum: 1 },
          slides: { $sum: { $size: { $ifNull: ["$slides", []] } } },
        },
      },
    ]),
    GeneratedVideo.aggregate<{ _id: null; videos: number; totalSec: number; avgSec: number }>([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          videos: { $sum: 1 },
          totalSec: { $sum: "$durationSec" },
          avgSec: { $avg: "$durationSec" },
        },
      },
    ]),
    RecentTopic.aggregate<{ _id: string; count: number }>([
      { $match: { userId } },
      { $group: { _id: "$subject", count: { $sum: "$count" } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    QuizAttempt.aggregate<{ _id: null; attempts: number; avgPct: number }>([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          attempts: { $sum: 1 },
          avgPct: { $avg: { $multiply: [{ $divide: ["$score", "$total"] }, 100] } },
        },
      },
    ]),
    ReviewItem.countDocuments({ userId, dueAt: { $lte: new Date() } }),
  ]);

  const lessons = lessonStats[0] ?? { lessons: 0, slides: 0 };
  const videos = videoStats[0] ?? { videos: 0, totalSec: 0, avgSec: 0 };
  const quizzes = quizStats[0] ?? { attempts: 0, avgPct: 0 };

  res.json({
    success: true,
    data: {
      lessonsGenerated: lessons.lessons,
      slidesCreated: lessons.slides,
      videosGenerated: videos.videos,
      learningTimeSec: Math.round(videos.totalSec),
      avgVideoLengthSec: Math.round(videos.avgSec ?? 0),
      favoriteSubjects: favoriteSubjects.map((subject) => ({
        subject: subject._id || "General",
        lessons: subject.count,
      })),
      quizAttempts: quizzes.attempts,
      avgQuizScorePct: Math.round(quizzes.avgPct ?? 0),
      dueReviews: dueReviewCount,
      studyStreak: req.user!.studyStreak ?? 0,
    },
  });
});
