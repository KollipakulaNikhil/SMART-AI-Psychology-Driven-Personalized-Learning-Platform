import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getProfile } from "../controllers/profile.controller";

const router = Router();

router.get("/", requireAuth, getProfile);

export default router;
