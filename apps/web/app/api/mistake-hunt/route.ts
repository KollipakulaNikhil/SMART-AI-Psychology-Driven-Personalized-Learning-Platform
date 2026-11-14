import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkChatRateLimit } from "@/lib/api/rateLimit";
import { createMistakeHunt, mistakeHuntSchema } from "@/lib/controllers/mistakeHunt.controller";

export const maxDuration = 60;

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  await checkChatRateLimit(req, user.firebaseUid);
  const body = await parseJson(mistakeHuntSchema, req);
  return createMistakeHunt(user, body);
});
