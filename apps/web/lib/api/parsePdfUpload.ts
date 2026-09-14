import { ApiError } from "@smart-ai/core/utils/ApiError";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB — comfortably covers a scanned textbook chapter.

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
}

export interface ParsedPdfForm {
  file: UploadedFile;
  fields: Record<string, string>;
}

/**
 * Reads a multipart FormData body with one required PDF field plus plain-text
 * fields — the native Route Handler equivalent of the old
 * `multer.memoryStorage()` single-file upload (never touches disk either way).
 */
export async function parsePdfUpload(req: Request, fieldName: string): Promise<ParsedPdfForm> {
  const formData = await req.formData().catch(() => {
    throw ApiError.badRequest("Expected multipart/form-data");
  });

  const fields: Record<string, string> = {};
  let uploaded: File | null = null;
  for (const [key, value] of formData.entries()) {
    if (key === fieldName && value instanceof File) {
      uploaded = value;
    } else if (typeof value === "string") {
      fields[key] = value;
    }
  }

  if (!uploaded) throw ApiError.badRequest("Attach a PDF file");
  if (uploaded.type !== "application/pdf") throw ApiError.badRequest("Only PDF files are supported");
  if (uploaded.size > MAX_PDF_BYTES) throw ApiError.badRequest("That PDF is too large — the limit is 20MB");

  const buffer = Buffer.from(await uploaded.arrayBuffer());
  return { file: { buffer, originalname: uploaded.name }, fields };
}
