import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { listDueReviews } from "@/lib/controllers/review.controller";

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  return listDueReviews(user);
});
