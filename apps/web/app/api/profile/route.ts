import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { getProfile } from "@/lib/controllers/profile.controller";

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  return getProfile(user._id);
});
