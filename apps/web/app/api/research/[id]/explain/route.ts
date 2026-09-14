import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseParams, parseJson } from "@/lib/api/validate";
import { checkChatRateLimit } from "@/lib/api/rateLimit";
import { explainResearchSource, explainSourceSchema, researchIdParam } from "@/lib/controllers/research.controller";

export const POST = apiHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  checkChatRateLimit(req, user.firebaseUid);
  const { id } = await parseParams(researchIdParam, ctx.params);
  const body = await parseJson(explainSourceSchema, req);
  return explainResearchSource(user, id, body);
});
