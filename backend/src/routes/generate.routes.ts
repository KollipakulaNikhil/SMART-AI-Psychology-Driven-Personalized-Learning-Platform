import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generationRateLimiter } from "../middleware/rateLimiter";
import {
  generateAudio,
  generateContent,
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
router.post("/ppt", validate({ body: presentationIdSchema }), generatePpt);
router.post("/audio", validate({ body: presentationIdSchema }), generateAudio);
router.post("/video", validate({ body: presentationIdSchema }), generateVideo);
router.get("/:id", validate({ params: idParam }), getPresentation);

export default router;
