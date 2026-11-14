import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { getDiscoveryChallenge, submitDiscovery, submitDiscoverySchema } from "@/lib/controllers/questionnaire.controller";

export const GET = apiHandler(async (req) => {
  await requireAuth(req);
  return getDiscoveryChallenge();
});

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  const body = await parseJson(submitDiscoverySchema, req);
  return submitDiscovery(user, body);
});
