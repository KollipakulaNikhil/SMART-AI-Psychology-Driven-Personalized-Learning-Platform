import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { createSession } from "@/lib/controllers/auth.controller";

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  return createSession(user);
});
