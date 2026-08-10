import { z } from "zod";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { Course, CourseDocument } from "../models/Course";
import { LearningProfile } from "../models/LearningProfile";
import { planCourse } from "../services/coursePlanner.service";
import { logHistory } from "../services/history.service";

export const createCourseSchema = z.object({
  goal: z.string().trim().min(8, "Describe your goal in at least 8 characters").max(300),
});

export const courseIdParam = z.object({
  id: z.string().refine(Types.ObjectId.isValid, "Invalid course id"),
});

function serializeCourse(course: CourseDocument) {
  const completed = course.modules.filter((m) => m.status === "completed").length;
  const modules = course.modules.map((module) => ({
    index: module.index,
    title: module.title,
    topic: module.topic,
    focus: module.focus,
    section: module.section,
    sectionIndex: module.sectionIndex,
    status: module.status,
    presentationId: module.presentationId ? String(module.presentationId) : null,
    completedAt: module.completedAt ?? null,
  }));

  // Group modules into their sections (chapters) for the roadmap hierarchy.
  const sectionMap = new Map<number, { index: number; title: string; modules: typeof modules }>();
  for (const module of modules) {
    const section = sectionMap.get(module.sectionIndex) ?? {
      index: module.sectionIndex,
      title: module.section || `Section ${module.sectionIndex + 1}`,
      modules: [],
    };
    section.modules.push(module);
    sectionMap.set(module.sectionIndex, section);
  }
  const sections = [...sectionMap.values()].sort((a, b) => a.index - b.index);

  return {
    id: course.id as string,
    goal: course.goal,
    title: course.title,
    description: course.description,
    subject: course.subject,
    modules,
    sections,
    totalModules: course.modules.length,
    completedModules: completed,
    progressPct: course.modules.length === 0 ? 0 : Math.round((completed / course.modules.length) * 100),
    createdAt: course.createdAt,
  };
}

/** Plans a personalized Learning Path from a goal via the AI provider chain. */
export const createCourse = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { goal } = req.body as z.infer<typeof createCourseSchema>;

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  if (!profile) {
    throw ApiError.unprocessable("Complete the learning psychology questionnaire before creating a path");
  }

  const plan = await planCourse(goal, profile.traits);

  // Flatten sections → a single ordered module list, tagging each with its
  // section so the roadmap can group them back into chapters.
  let globalIndex = 0;
  const modules = plan.sections.flatMap((section, sectionIndex) =>
    section.subtopics.map((subtopic) => ({
      index: globalIndex++,
      title: subtopic.title,
      topic: subtopic.topic,
      focus: subtopic.focus,
      section: section.title,
      sectionIndex,
      status: "pending" as const,
    }))
  );

  const course = await Course.create({
    userId: user._id,
    goal,
    title: plan.title,
    description: plan.description,
    subject: plan.subject,
    modules,
  });

  logHistory(user._id, "content_generated", { topic: goal, meta: { kind: "course_created", courseId: course.id } });
  res.status(201).json({ success: true, data: serializeCourse(course) });
});

export const listCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ userId: req.user!._id }).sort({ createdAt: -1 }).limit(30);
  res.json({ success: true, data: courses.map(serializeCourse) });
});

export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound("Learning path not found");
  if (!course.userId.equals(req.user!._id)) throw ApiError.forbidden();
  res.json({ success: true, data: serializeCourse(course) });
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound("Learning path not found");
  if (!course.userId.equals(req.user!._id)) throw ApiError.forbidden();
  await course.deleteOne();
  res.json({ success: true, data: { deleted: true } });
});
