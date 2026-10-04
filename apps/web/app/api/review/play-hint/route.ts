import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { playHint, playHintSchema } from "@/lib/controllers/review.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  const body = await parseJson(playHintSchema, req);
  return playHint(user, body);
});
