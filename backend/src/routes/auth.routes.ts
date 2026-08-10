import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createSession, getMe } from "../controllers/auth.controller";

const router = Router();

router.post("/session", requireAuth, createSession);
router.get("/me", requireAuth, getMe);

export default router;
