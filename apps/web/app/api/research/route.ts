import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkGenerationRateLimit } from "@/lib/api/rateLimit";
import { createResearch, createResearchSchema, listResearch } from "@/lib/controllers/research.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  checkGenerationRateLimit(req, user.firebaseUid);
  const body = await parseJson(createResearchSchema, req);
  return createResearch(user, body);
});

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  return listResearch(user);
});
