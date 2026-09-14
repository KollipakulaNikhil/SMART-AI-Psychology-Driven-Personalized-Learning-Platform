import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseParams } from "@/lib/api/validate";
import { courseIdParam, deleteCourse, getCourse } from "@/lib/controllers/course.controller";

export const GET = apiHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(courseIdParam, ctx.params);
  return getCourse(user, id);
});

export const DELETE = apiHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(courseIdParam, ctx.params);
  return deleteCourse(user, id);
});
