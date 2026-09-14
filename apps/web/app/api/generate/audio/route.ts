export const maxDuration = 300;

import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkGenerationRateLimit } from "@/lib/api/rateLimit";
import { generateAudio, presentationIdSchema } from "@/lib/controllers/generate.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  checkGenerationRateLimit(req, user.firebaseUid);
  const body = await parseJson(presentationIdSchema, req);
  return generateAudio(user, body);
});
