import { LearningProfile } from "@smart-ai/core/models/LearningProfile";
import type { UserDocument } from "@smart-ai/core/models/User";

/**
 * Called right after Firebase sign-in. `requireAuth` has already verified the
 * token and upserted the Mongo user; this returns the session bootstrap data.
 */
export async function createSession(user: UserDocument) {
  const profile = await LearningProfile.findOne({ userId: user._id }).lean();

  return {
    user: {
      id: user.id as string,
      email: user.email,
      name: user.name,
      photoUrl: user.photoUrl ?? null,
      authProvider: user.authProvider,
      memberSince: user.createdAt,
    },
    hasProfile: Boolean(profile),
  };
}
