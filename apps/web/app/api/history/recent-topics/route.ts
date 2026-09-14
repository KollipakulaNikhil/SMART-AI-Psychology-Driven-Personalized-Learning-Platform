import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { listRecentTopics } from "@/lib/controllers/history.controller";

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  return listRecentTopics(user._id);
});
