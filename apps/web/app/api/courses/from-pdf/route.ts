export const maxDuration = 60;

import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkGenerationRateLimit } from "@/lib/api/rateLimit";
import { fetchArtifactBuffer, deleteArtifact } from "@smart-ai/core/storage/blob";
import { createCourseFromDocument, createCourseFromPdfSchema } from "@/lib/controllers/course.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  checkGenerationRateLimit(req, user.firebaseUid);
  const body = await parseJson(createCourseFromPdfSchema, req);

  const buffer = await fetchArtifactBuffer(body.pdfUrl);
  deleteArtifact(body.pdfUrl).catch(() => undefined); // ephemeral source, no need to keep it

  return createCourseFromDocument(user, body, { buffer, originalname: body.fileName });
});
