import { asyncHandler } from "../utils/asyncHandler";
import { LearningProfile } from "../models/LearningProfile";

/**
 * Called right after Firebase sign-in. requireAuth has already verified the
 * token and upserted the Mongo user; this returns the session bootstrap data.
 */
export const createSession = asyncHandler(async (req, res) => {
  const user = req.user!;
  const profile = await LearningProfile.findOne({ userId: user._id }).lean();

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl ?? null,
        authProvider: user.authProvider,
        memberSince: user.createdAt,
      },
      hasProfile: Boolean(profile),
    },
  });
});

export const getMe = createSession;
