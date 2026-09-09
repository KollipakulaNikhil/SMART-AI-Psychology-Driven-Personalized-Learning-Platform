import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { chatRateLimiter, generationRateLimiter } from "../middleware/rateLimiter";
import {
  createResearch,
  createResearchSchema,
  deleteResearch,
  explainResearchSource,
  explainSourceSchema,
  getResearch,
  listResearch,
  researchIdParam,
} from "../controllers/research.controller";

const router = Router();

router.use(requireAuth);

router.post("/", generationRateLimiter, validate({ body: createResearchSchema }), createResearch);
router.get("/", listResearch);
router.get("/:id", validate({ params: researchIdParam }), getResearch);
router.delete("/:id", validate({ params: researchIdParam }), deleteResearch);
router.post(
  "/:id/explain",
  chatRateLimiter,
  validate({ params: researchIdParam, body: explainSourceSchema }),
  explainResearchSource
);

export default router;
