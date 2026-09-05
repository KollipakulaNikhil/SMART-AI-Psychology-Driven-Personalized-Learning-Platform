import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadSinglePdf } from "../middleware/upload";
import { generationRateLimiter } from "../middleware/rateLimiter";
import {
  courseIdParam,
  createCourse,
  createCourseFromDocument,
  createCourseFromPdfSchema,
  createCourseSchema,
  deleteCourse,
  getCourse,
  listCourses,
} from "../controllers/course.controller";

const router = Router();

router.use(requireAuth);

router.post("/", generationRateLimiter, validate({ body: createCourseSchema }), createCourse);
router.post(
  "/from-pdf",
  generationRateLimiter,
  uploadSinglePdf("file"),
  validate({ body: createCourseFromPdfSchema }),
  createCourseFromDocument
);
router.get("/", listCourses);
router.get("/:id", validate({ params: courseIdParam }), getCourse);
router.delete("/:id", validate({ params: courseIdParam }), deleteCourse);

export default router;
