import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { listActivity } from "@/lib/controllers/history.controller";

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  return listActivity(user._id);
});
