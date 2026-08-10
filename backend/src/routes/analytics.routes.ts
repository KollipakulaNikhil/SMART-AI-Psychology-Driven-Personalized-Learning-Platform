import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getAnalytics } from "../controllers/analytics.controller";

const router = Router();

router.get("/", requireAuth, getAnalytics);

export default router;
