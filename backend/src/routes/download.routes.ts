import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { downloadAsset, downloadParamsSchema } from "../controllers/download.controller";

const router = Router();

router.get("/:id/:asset", requireAuth, validate({ params: downloadParamsSchema }), downloadAsset);

export default router;
