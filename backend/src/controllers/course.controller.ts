import { z } from "zod";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { Course, CourseDocument } from "../models/Course";
import { LearningProfile } from "../models/LearningProfile";
import { planCourse, planCourseFromDocument } from "../services/coursePlanner.service";
import { extractPdfText } from "../services/pdfExtract.service";
import { logHistory } from "../services/history.service";
import { LESSON_LANGUAGES, DEFAULT_LANGUAGE } from "../config/languages";

export const createCourseSchema = z.object({
  goal: z.string().trim().min(8, "Describe your goal in at least 8 characters").max(300),
  language: z.enum(LESSON_LANGUAGES).optional().default(DEFAULT_LANGUAGE),
});

/**
 * Multipart body: the PDF itself arrives as `req.file` (see
 * `middleware/upload.ts`), everything else as regular form fields — multer
 * parses those into strings, hence the coercion.
 */
export const createCourseFromPdfSchema = z.object({
  language: z.enum(LESSON_LANGUAGES).optional().default(DEFAULT_LANGUAGE),
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
    language: course.language,
    modules,
    sections,
    totalModules: course.modules.length,
    completedModules: completed,
    progressPct: course.modules.length === 0 ? 0 : Math.round((completed / course.modules.length) * 100),
    sourceType: course.sourceType,
    sourceFileName: course.sourceFileName ?? null,
    enrichment: course.enrichment,
    createdAt: course.createdAt,
  };
}

/** Plans a personalized Learning Path from a goal via the AI provider chain. */
export const createCourse = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { goal, language } = req.body as z.infer<typeof createCourseSchema>;

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  if (!profile) {
    throw ApiError.unprocessable("Complete the learning psychology questionnaire before creating a path");
  }

  const plan = await planCourse(goal, profile.traits, language);

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
    language,
    modules,
  });

  logHistory(user._id, "content_generated", { topic: goal, meta: { kind: "course_created", courseId: course.id } });
  res.status(201).json({ success: true, data: serializeCourse(course) });
});

/**
 * Plans a Learning Path from an uploaded PDF instead of a typed goal: the
 * document's text is extracted, then handed to the same AI planner (grounded
 * in the source, with a small set of AI-added topics for completeness — see
 * `planCourseFromDocument`), then flattened into course modules exactly like
 * `createCourse` — so everything downstream (locked progression, lesson
 * generation, quizzes, Smart Review) works identically regardless of source.
 */
export const createCourseFromDocument = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { language } = req.body as z.infer<typeof createCourseFromPdfSchema>;
  const file = req.file;
  if (!file) throw ApiError.badRequest("Attach a PDF file");

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  if (!profile) {
    throw ApiError.unprocessable("Complete the learning psychology questionnaire before creating a path");
  }

  const { text, truncated } = await extractPdfText(file.buffer);
  const plan = await planCourseFromDocument(text, profile.traits, truncated, language);

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
    goal: `Uploaded document: ${file.originalname}`,
    title: plan.title,
    description: plan.description,
    subject: plan.subject,
    language,
    modules,
    sourceType: "document",
    sourceFileName: file.originalname,
    enrichment: plan.enrichment,
  });

  logHistory(user._id, "content_generated", {
    topic: plan.title,
    meta: { kind: "course_created_from_pdf", courseId: course.id, fileName: file.originalname },
  });
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
