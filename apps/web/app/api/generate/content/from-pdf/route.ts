export const maxDuration = 90;

import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parsePdfUpload } from "@/lib/api/parsePdfUpload";
import { checkGenerationRateLimit } from "@/lib/api/rateLimit";
import { extractPdfText } from "@smart-ai/core/services/pdfExtract.service";
import { generateContentFromPdf, generateContentFromPdfSchema } from "@/lib/controllers/generate.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  checkGenerationRateLimit(req, user.firebaseUid);
  const { file, fields } = await parsePdfUpload(req, "file");
  const body = generateContentFromPdfSchema.parse(fields);
  const { text, truncated } = await extractPdfText(file.buffer);
  return generateContentFromPdf(user, body, { text, truncated, fileName: file.originalname });
});
