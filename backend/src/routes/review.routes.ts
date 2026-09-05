import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  checkPlayAnswer,
  listDueReviews,
  playAnswerSchema,
  submitQuizAttempt,
  submitQuizSchema,
} from "../controllers/review.controller";

const router = Router();

router.use(requireAuth);

router.get("/due", listDueReviews);
router.post("/quiz-attempt", validate({ body: submitQuizSchema }), submitQuizAttempt);
router.post("/play-answer", validate({ body: playAnswerSchema }), checkPlayAnswer);

export default router;
