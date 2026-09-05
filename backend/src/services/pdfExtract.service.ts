import { PDFParse } from "pdf-parse";
import { ApiError } from "../utils/ApiError";

/**
 * Cap on how much extracted text is fed to the planner prompt. A whole
 * textbook chapter is easily 40k+ characters — far past what a free-tier
 * model's per-minute token budget can take in one call (the course planner
 * is a single, un-batched generateStructured call, unlike the lesson content
 * pipeline). Truncating here keeps the prompt affordable; the model is told
 * the text was trimmed so it doesn't assume the excerpt is the whole document.
 */
const MAX_CHARS = 18_000;

const MIN_READABLE_CHARS = 200;

export interface ExtractedDocument {
  text: string;
  pageCount: number;
  truncated: boolean;
}

/** Collapses PDF text-extraction noise (repeated blank lines, stray form-feeds) without losing paragraph breaks. */
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extracts readable text from an uploaded PDF buffer. Scanned/image-only PDFs
 * (no text layer) come back near-empty — that's treated as a user-facing
 * error rather than silently planning a course from nothing.
 */
export async function extractPdfText(buffer: Buffer): Promise<ExtractedDocument> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const cleaned = cleanText(result.text ?? "");

    if (cleaned.length < MIN_READABLE_CHARS) {
      throw ApiError.unprocessable(
        "Couldn't find readable text in this PDF — it may be a scanned image with no text layer."
      );
    }

    const truncated = cleaned.length > MAX_CHARS;
    return {
      text: truncated ? cleaned.slice(0, MAX_CHARS) : cleaned,
      pageCount: result.pages?.length ?? result.total ?? 0,
      truncated,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest(
      `Couldn't read that PDF (${error instanceof Error ? error.message : "unknown error"})`
    );
  } finally {
    await parser.destroy();
  }
}
