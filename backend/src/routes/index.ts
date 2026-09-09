import { Router } from "express";
import authRoutes from "./auth.routes";
import profileRoutes from "./profile.routes";
import questionnaireRoutes from "./questionnaire.routes";
import generateRoutes from "./generate.routes";
import historyRoutes from "./history.routes";
import downloadRoutes from "./download.routes";
import analyticsRoutes from "./analytics.routes";
import courseRoutes from "./course.routes";
import reviewRoutes from "./review.routes";
import tutorRoutes from "./tutor.routes";
import researchRoutes from "./research.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, service: "smart-ai-api", uptime: process.uptime() });
});

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/questionnaire", questionnaireRoutes);
router.use("/generate", generateRoutes);
router.use("/history", historyRoutes);
router.use("/download", downloadRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/courses", courseRoutes);
router.use("/review", reviewRoutes);
router.use("/tutor", tutorRoutes);
router.use("/research", researchRoutes);

export default router;
