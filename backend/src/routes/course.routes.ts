import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generationRateLimiter } from "../middleware/rateLimiter";
import {
  courseIdParam,
  createCourse,
  createCourseSchema,
  deleteCourse,
  getCourse,
  listCourses,
} from "../controllers/course.controller";

const router = Router();

router.use(requireAuth);

router.post("/", generationRateLimiter, validate({ body: createCourseSchema }), createCourse);
router.get("/", listCourses);
router.get("/:id", validate({ params: courseIdParam }), getCourse);
router.delete("/:id", validate({ params: courseIdParam }), deleteCourse);

export default router;
