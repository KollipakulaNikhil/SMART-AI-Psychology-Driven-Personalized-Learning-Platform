export const maxDuration = 300;

import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkGenerationRateLimit } from "@/lib/api/rateLimit";
import { createCourse, createCourseSchema, listCourses } from "@/lib/controllers/course.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  checkGenerationRateLimit(req, user.firebaseUid);
  const body = await parseJson(createCourseSchema, req);
  return createCourse(user, body);
});

export const GET = apiHandler(async (req) => {
  const user = await requireAuth(req);
  return listCourses(user);
});
