import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadSinglePdf } from "../middleware/upload";
import { generationRateLimiter } from "../middleware/rateLimiter";
import {
  generateAudio,
  generateContent,
  generateContentFromPdf,
  generateContentFromPdfSchema,
  generateContentSchema,
  generatePpt,
  generateVideo,
  getPresentation,
  listLessonLanguages,
  presentationIdSchema,
} from "../controllers/generate.controller";

const router = Router();

const idParam = z.object({ id: z.string().refine(Types.ObjectId.isValid, "Invalid lesson id") });

router.use(requireAuth);

/** The languages a lesson can be generated in — the picker reads this so the
 *  UI can never offer a language the server doesn't have a voice for. */
router.get("/languages", listLessonLanguages);

router.post("/content", generationRateLimiter, validate({ body: generateContentSchema }), generateContent);
router.post(
  "/content/from-pdf",
  generationRateLimiter,
  uploadSinglePdf("file"),
  validate({ body: generateContentFromPdfSchema }),
  generateContentFromPdf
);
router.post("/ppt", generationRateLimiter, validate({ body: presentationIdSchema }), generatePpt);
router.post("/audio", generationRateLimiter, validate({ body: presentationIdSchema }), generateAudio);
router.post("/video", generationRateLimiter, validate({ body: presentationIdSchema }), generateVideo);
router.get("/:id", validate({ params: idParam }), getPresentation);

export default router;
