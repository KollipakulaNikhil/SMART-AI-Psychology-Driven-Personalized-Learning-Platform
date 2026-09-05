import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/ApiError";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB — comfortably covers a scanned textbook chapter.

/** In-memory only: the PDF is parsed for its text and then discarded, never stored on disk. */
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(ApiError.badRequest("Only PDF files are supported"));
      return;
    }
    cb(null, true);
  },
});

/** Wraps multer's single-file upload so its errors become ApiError (multer.MulterError isn't one, and would otherwise 500). */
export function uploadSinglePdf(fieldName: string) {
  const handler = pdfUpload.single(fieldName);
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          next(ApiError.badRequest("That PDF is too large — the limit is 20MB"));
          return;
        }
        next(ApiError.badRequest(error.message));
        return;
      }
      next(error);
    });
  };
}
