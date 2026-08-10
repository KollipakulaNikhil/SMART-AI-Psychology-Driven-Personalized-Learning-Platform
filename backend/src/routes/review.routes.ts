import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { listDueReviews, submitQuizAttempt, submitQuizSchema } from "../controllers/review.controller";

const router = Router();

router.use(requireAuth);

router.get("/due", listDueReviews);
router.post("/quiz-attempt", validate({ body: submitQuizSchema }), submitQuizAttempt);

export default router;
