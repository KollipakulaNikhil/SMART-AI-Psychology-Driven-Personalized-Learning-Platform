import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkChatRateLimit } from "@/lib/api/rateLimit";
import { tutorChat, tutorChatSchema } from "@/lib/controllers/tutor.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  checkChatRateLimit(req, user.firebaseUid);
  const body = await parseJson(tutorChatSchema, req);
  return tutorChat(user, body);
});
