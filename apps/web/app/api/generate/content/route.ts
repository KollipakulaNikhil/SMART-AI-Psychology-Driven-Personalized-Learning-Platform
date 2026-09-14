export const maxDuration = 90;

import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkGenerationRateLimit } from "@/lib/api/rateLimit";
import { generateContent, generateContentSchema } from "@/lib/controllers/generate.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  checkGenerationRateLimit(req, user.firebaseUid);
  const body = await parseJson(generateContentSchema, req);
  return generateContent(user, body);
});
