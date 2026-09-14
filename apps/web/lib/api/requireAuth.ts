import { ApiError } from "@smart-ai/core/utils/ApiError";
import { firebaseAuth } from "@smart-ai/core/config/firebase";
import { User, type UserDocument } from "@smart-ai/core/models/User";

/**
 * Verifies the Firebase ID token from the Authorization header and returns
 * the corresponding Mongo user, creating it on first sight. Call at the top
 * of any route handler that requires auth (mirrors the old Express
 * `requireAuth` middleware, minus the middleware chaining).
 */
export async function requireAuth(req: Request): Promise<UserDocument> {
  const header = req.headers.get("authorization");
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

  return user;
}
