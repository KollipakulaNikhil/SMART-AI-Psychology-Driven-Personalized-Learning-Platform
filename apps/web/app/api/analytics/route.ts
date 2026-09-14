import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { getAnalytics } from "@/lib/controllers/analytics.controller";

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  return getAnalytics(user);
});
