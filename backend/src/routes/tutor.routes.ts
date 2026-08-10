import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { chatRateLimiter } from "../middleware/rateLimiter";
import { tutorChat, tutorChatSchema } from "../controllers/tutor.controller";

const router = Router();

router.post("/chat", requireAuth, chatRateLimiter, validate({ body: tutorChatSchema }), tutorChat);

export default router;
