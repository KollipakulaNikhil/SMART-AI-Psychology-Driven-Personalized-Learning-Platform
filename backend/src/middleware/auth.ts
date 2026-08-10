import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { firebaseAuth } from "../config/firebase";
import { User } from "../models/User";

/**
 * Verifies the Firebase ID token from the Authorization header and attaches
 * the corresponding Mongo user to the request, creating it on first sight.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing bearer token");
  }

  let decoded;
  try {
    decoded = await firebaseAuth().verifyIdToken(header.slice("Bearer ".length));
  } catch {
    throw ApiError.unauthorized("Invalid or expired session token");
  }

  const provider = decoded.firebase?.sign_in_provider;
  const authProvider = provider === "google.com" ? "google" : provider === "password" ? "password" : "unknown";

  const user = await User.findOneAndUpdate(
    { firebaseUid: decoded.uid },
    {
      $set: {
        email: decoded.email ?? "",
        name: decoded.name ?? decoded.email?.split("@")[0] ?? "Learner",
        photoUrl: decoded.picture,
        authProvider,
        lastLoginAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  req.user = user;
  next();
});
