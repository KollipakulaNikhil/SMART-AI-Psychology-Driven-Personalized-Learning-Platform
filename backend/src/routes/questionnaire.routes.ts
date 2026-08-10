import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { getQuestions, submitAnswers, submitAnswersSchema } from "../controllers/questionnaire.controller";

const router = Router();

router.get("/", requireAuth, getQuestions);
router.post("/", requireAuth, validate({ body: submitAnswersSchema }), submitAnswers);

export default router;
