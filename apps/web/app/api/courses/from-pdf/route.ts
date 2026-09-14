import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parsePdfUpload } from "@/lib/api/parsePdfUpload";
import { checkGenerationRateLimit } from "@/lib/api/rateLimit";
import { createCourseFromDocument, createCourseFromPdfSchema } from "@/lib/controllers/course.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  checkGenerationRateLimit(req, user.firebaseUid);
  const { file, fields } = await parsePdfUpload(req, "file");
  const body = createCourseFromPdfSchema.parse(fields);
  return createCourseFromDocument(user, body, file);
});
