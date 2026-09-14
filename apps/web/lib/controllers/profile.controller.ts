import { LearningProfile } from "@smart-ai/core/models/LearningProfile";
import type { Types } from "mongoose";

/** Returns the learner's psychology profile, or null when the questionnaire is pending. */
export async function getProfile(userId: Types.ObjectId) {
  const profile = await LearningProfile.findOne({ userId }).lean();
  return profile
    ? { traits: profile.traits, version: profile.version, completedAt: profile.completedAt }
    : null;
}
