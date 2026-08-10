import { asyncHandler } from "../utils/asyncHandler";
import { LearningProfile } from "../models/LearningProfile";

/** Returns the learner's psychology profile, or null when the questionnaire is pending. */
export const getProfile = asyncHandler(async (req, res) => {
  const profile = await LearningProfile.findOne({ userId: req.user!._id }).lean();

  res.json({
    success: true,
    data: profile
      ? {
          traits: profile.traits,
          version: profile.version,
          completedAt: profile.completedAt,
        }
      : null,
  });
});
