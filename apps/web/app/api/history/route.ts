import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseQuery } from "@/lib/api/validate";
import { listPresentations, listQuerySchema } from "@/lib/controllers/history.controller";

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  const query = parseQuery(listQuerySchema, req.url);
  return listPresentations(user._id, query);
});
