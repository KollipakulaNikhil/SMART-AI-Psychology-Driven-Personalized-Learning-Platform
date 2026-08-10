import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { listActivity, listPresentations, listQuerySchema, listRecentTopics } from "../controllers/history.controller";

const router = Router();

router.use(requireAuth);

router.get("/", validate({ query: listQuerySchema }), listPresentations);
router.get("/recent-topics", listRecentTopics);
router.get("/activity", listActivity);

export default router;
