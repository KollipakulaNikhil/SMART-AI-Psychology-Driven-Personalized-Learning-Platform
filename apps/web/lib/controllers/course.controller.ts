import { z } from "zod";
import { Types } from "mongoose";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { Course, type CourseDocument } from "@smart-ai/core/models/Course";
import { LearningProfile } from "@smart-ai/core/models/LearningProfile";
import { planCourse, planCourseFromDocument } from "@smart-ai/core/services/coursePlanner.service";
import { extractPdfText } from "@smart-ai/core/services/pdfExtract.service";
import { logHistory } from "@smart-ai/core/services/history.service";
import { LESSON_LANGUAGES, DEFAULT_LANGUAGE } from "@smart-ai/core/config/languages";
import type { UserDocument } from "@smart-ai/core/models/User";
import { withStatus } from "@/lib/api/apiHandler";

export const createCourseSchema = z.object({
  goal: z.string().trim().min(8, "Describe your goal in at least 8 characters").max(300),
  language: z.enum(LESSON_LANGUAGES).optional().default(DEFAULT_LANGUAGE),
});

export const createCourseFromPdfSchema = z.object({
  language: z.enum(LESSON_LANGUAGES).optional().default(DEFAULT_LANGUAGE),
  /** Blob URL of the PDF the browser already uploaded directly to Vercel Blob. */
  pdfUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(200),
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

function flattenModules(sections: { title: string; subtopics: { title: string; topic: string; focus: string }[] }[]) {
  let globalIndex = 0;
  return sections.flatMap((section, sectionIndex) =>
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
}

/** Plans a personalized Learning Path from a goal via the AI provider chain. */
export async function createCourse(user: UserDocument, body: z.infer<typeof createCourseSchema>) {
  const { goal, language } = body;

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  if (!profile) {
    throw ApiError.unprocessable("Complete the learning psychology questionnaire before creating a path");
  }

  const plan = await planCourse(goal, profile.traits, language);
  const modules = flattenModules(plan.sections);

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
  return withStatus(serializeCourse(course), 201);
}

/**
 * Plans a Learning Path from an uploaded PDF instead of a typed goal. `file`
 * arrives already read into memory by the route handler (`formData.get("file")`
 * → `arrayBuffer()`), mirroring the old `multer.memoryStorage()` behavior.
 */
export async function createCourseFromDocument(
  user: UserDocument,
  body: z.infer<typeof createCourseFromPdfSchema>,
  file: { buffer: Buffer; originalname: string }
) {
  const { language } = body;

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  if (!profile) {
    throw ApiError.unprocessable("Complete the learning psychology questionnaire before creating a path");
  }

  const { text, truncated } = await extractPdfText(file.buffer);
  const plan = await planCourseFromDocument(text, profile.traits, truncated, language);
  const modules = flattenModules(plan.sections);

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
  return withStatus(serializeCourse(course), 201);
}

export async function listCourses(user: UserDocument) {
  const courses = await Course.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30);
  return courses.map(serializeCourse);
}

export async function getCourse(user: UserDocument, courseId: string) {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("Learning path not found");
  if (!course.userId.equals(user._id)) throw ApiError.forbidden();
  return serializeCourse(course);
}

export async function deleteCourse(user: UserDocument, courseId: string) {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("Learning path not found");
  if (!course.userId.equals(user._id)) throw ApiError.forbidden();
  await course.deleteOne();
  return { deleted: true };
}
