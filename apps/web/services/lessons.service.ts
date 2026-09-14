import { apiDelete, apiDownload, apiGet, apiPost } from "./api";
import { uploadPdfToBlob } from "@/lib/uploadPdfToBlob";
import type {
  AnalyticsData,
  CourseView,
  DueReviewsData,
  LearningProfileData,
  LessonLanguage,
  LessonLanguageOption,
  LessonListData,
  PlayAnswerResult,
  PresentationDetail,
  QuestionnaireAnswer,
  QuestionView,
  QuizAttemptResult,
  RecentTopicView,
  ResearchExplainResult,
  ResearchProjectSummary,
  ResearchProjectView,
  SessionData,
} from "@/lib/types";

// ── Auth / profile ──────────────────────────────────────────────────────────
export const createSession = () => apiPost<SessionData>("/auth/session");
export const getProfile = () => apiGet<LearningProfileData | null>("/profile");

// ── Questionnaire ───────────────────────────────────────────────────────────
export const getQuestions = () => apiGet<QuestionView[]>("/questionnaire");
export const submitQuestionnaire = (answers: QuestionnaireAnswer[]) =>
  apiPost<LearningProfileData>("/questionnaire", { answers });

// ── Generation pipeline ─────────────────────────────────────────────────────
export interface GenerateContentPayload {
  topic: string;
  focus?: string;
  durationMin?: number;
  detailLevel?: "quick" | "standard" | "detailed";
  subtitles?: boolean;
  /** Language the narrator speaks. */
  language?: LessonLanguage;
  /** Language written on the board and slides; omit to follow the narration. */
  boardLanguage?: LessonLanguage;
  /** Present when generating a Learning Path module. */
  courseId?: string;
  moduleIndex?: number;
}

/** Languages this server can narrate — sourced from the server voice registry. */
export const getLessonLanguages = () => apiGet<LessonLanguageOption[]>("/generate/languages");

export const generateContent = (payload: GenerateContentPayload) =>
  apiPost<PresentationDetail>("/generate/content", {
    ...payload,
    focus: payload.focus || undefined,
  });
/**
 * Same as `generateContent`, but grounds the lesson in an uploaded PDF's
 * text. The file goes straight from the browser to Vercel Blob storage
 * first (serverless functions cap request bodies at ~4.5MB, well under
 * what a real PDF can be) — only the resulting Blob URL is posted here.
 */
export const generateContentFromPdf = async (file: File, payload: GenerateContentPayload) => {
  const { url, fileName } = await uploadPdfToBlob(file);
  return apiPost<PresentationDetail>("/generate/content/from-pdf", {
    ...payload,
    focus: payload.focus || undefined,
    pdfUrl: url,
    fileName,
  });
};
export const generatePpt = (presentationId: string) =>
  apiPost<PresentationDetail>("/generate/ppt", { presentationId });
export const generateAudio = (presentationId: string) =>
  apiPost<PresentationDetail>("/generate/audio", { presentationId });
export const generateVideo = (presentationId: string) =>
  apiPost<PresentationDetail>("/generate/video", { presentationId });
export const getLesson = (id: string) => apiGet<PresentationDetail>(`/generate/${id}`);

// ── History & analytics ─────────────────────────────────────────────────────
export const listLessons = (limit = 20, page = 1) =>
  apiGet<LessonListData>("/history", { limit, page });
export const listRecentTopics = () => apiGet<RecentTopicView[]>("/history/recent-topics");
export const getAnalytics = () => apiGet<AnalyticsData>("/analytics");

// ── Learning Paths ──────────────────────────────────────────────────────────
export const createCourse = (goal: string, language: LessonLanguage) =>
  apiPost<CourseView>("/courses", { goal, language });
export const createCourseFromPdf = async (file: File, language: LessonLanguage) => {
  const { url, fileName } = await uploadPdfToBlob(file);
  return apiPost<CourseView>("/courses/from-pdf", { language, pdfUrl: url, fileName });
};
export const listCourses = () => apiGet<CourseView[]>("/courses");
export const getCourse = (id: string) => apiGet<CourseView>(`/courses/${id}`);

// ── Smart Review ────────────────────────────────────────────────────────────
export const getDueReviews = () => apiGet<DueReviewsData>("/review/due");
export const submitQuizAttempt = (presentationId: string, answers: number[]) =>
  apiPost<QuizAttemptResult>("/review/quiz-attempt", { presentationId, answers });
/** Game mode: grade a single question (answer `null` = the timer ran out). */
export const checkPlayAnswer = (presentationId: string, questionIndex: number, answer: number | null) =>
  apiPost<PlayAnswerResult>("/review/play-answer", { presentationId, questionIndex, answer });

// ── AI Tutor ────────────────────────────────────────────────────────────────
export interface TutorTurn {
  role: "user" | "tutor";
  content: string;
}

export interface TutorReply {
  reply: string;
  slideIndex: number | null;
  slideTitle: string | null;
}

export const askTutor = (
  presentationId: string,
  message: string,
  slideIndex: number | undefined,
  history: TutorTurn[]
) => apiPost<TutorReply>("/tutor/chat", { presentationId, message, slideIndex, history });

// ── Research Lab ────────────────────────────────────────────────────────────
/** Shares a research idea; the server answers 202 and works in the background. */
export const createResearch = (idea: string, title?: string) =>
  apiPost<ResearchProjectView>("/research", { idea, title: title || undefined });
export const listResearch = () => apiGet<ResearchProjectSummary[]>("/research");
export const getResearch = (id: string) => apiGet<ResearchProjectView>(`/research/${id}`);
export const deleteResearch = (id: string) => apiDelete<{ deleted: boolean }>(`/research/${id}`);
/** Deep, plain-language walkthrough of one paper/patent in the learner's style. */
export const explainResearchSource = (id: string, kind: "paper" | "patent", index: number) =>
  apiPost<ResearchExplainResult>(`/research/${id}/explain`, { kind, index });

// ── Downloads ───────────────────────────────────────────────────────────────
export type DownloadableAsset = "ppt" | "pdf" | "audio" | "video" | "subtitles";

const ASSET_EXTENSIONS: Record<DownloadableAsset, string> = {
  ppt: "pptx",
  pdf: "pdf",
  audio: "mp3",
  video: "mp4",
  subtitles: "srt",
};

export const downloadLessonAsset = (id: string, asset: DownloadableAsset) =>
  apiDownload(`/download/${id}/${asset}`, `smart-ai-lesson.${ASSET_EXTENSIONS[asset]}`);
