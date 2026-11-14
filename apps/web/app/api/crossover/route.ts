import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkChatRateLimit } from "@/lib/api/rateLimit";
import { createCrossover, crossoverSchema } from "@/lib/controllers/crossover.controller";

export const maxDuration = 60;

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  await checkChatRateLimit(req, user.firebaseUid);
  const body = await parseJson(crossoverSchema, req);
  return createCrossover(user, body);
});
