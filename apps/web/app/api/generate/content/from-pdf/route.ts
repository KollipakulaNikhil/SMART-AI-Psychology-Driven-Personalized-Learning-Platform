export const maxDuration = 300;

import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { checkGenerationRateLimit } from "@/lib/api/rateLimit";
import { extractPdfText } from "@smart-ai/core/services/pdfExtract.service";
import { deleteArtifact } from "@smart-ai/core/storage/blob";
import { fetchOwnSourcePdf } from "@/lib/api/sourcePdf";
import { generateContentFromPdf, generateContentFromPdfSchema } from "@/lib/controllers/generate.controller";

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  await checkGenerationRateLimit(req, user.firebaseUid);
  const body = await parseJson(generateContentFromPdfSchema, req);

  // Only a PDF this user uploaded through our own upload route is ever fetched or deleted.
  const buffer = await fetchOwnSourcePdf(body.pdfUrl, user);
  const { text, truncated } = await extractPdfText(buffer);
  deleteArtifact(body.pdfUrl).catch(() => undefined); // ephemeral source, no need to keep it

  return generateContentFromPdf(user, body, { text, truncated, fileName: body.fileName });
});
