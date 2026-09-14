import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { listLessonLanguages } from "@/lib/controllers/generate.controller";

export const GET = apiHandler(async (req) => {
  await requireAuth(req);
  return listLessonLanguages();
});
