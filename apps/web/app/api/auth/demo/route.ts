import { apiHandler } from "@/lib/api/apiHandler";
import { checkChatRateLimit } from "@/lib/api/rateLimit";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { firebaseAuth } from "@smart-ai/core/config/firebase";

/**
 * One-click sign in to the shared demo account. The account is named only in
 * server env (DEMO_ACCOUNT_EMAIL); the browser gets a short-lived custom token
 * and never sees an email or a password.
 */
export const POST = apiHandler(async (req) => {
  const email = process.env.DEMO_ACCOUNT_EMAIL?.trim();
  if (!email) throw new ApiError(404, "The demo account is not available right now.");

  // per address, since the caller is not signed in yet
  await checkChatRateLimit(req);

  const auth = firebaseAuth();
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user || user.disabled) throw new ApiError(404, "The demo account is not available right now.");

  const token = await auth.createCustomToken(user.uid, { demo: true });
  return { token };
});
