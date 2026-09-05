export type LearningStyle = "visual" | "auditory" | "reading" | "kinesthetic";
export type AttentionSpan = "low" | "medium" | "high";
export type Pace = "slow" | "moderate" | "fast";
export type KnowledgeLevel = "beginner" | "intermediate" | "advanced";
export type Tone = "friendly" | "professional" | "academic";
export type Depth = "overview" | "balanced" | "deep";
export type PreferenceLevel = "low" | "medium" | "high";
export type Motivation = "curiosity" | "career" | "exam" | "hobby";
export type MemoryType = "story" | "repetition" | "association" | "structure";

export interface LearnerTraits {
  learningStyle: LearningStyle;
  attentionSpan: AttentionSpan;
  pace: Pace;
  knowledgeLevel: KnowledgeLevel;
  tone: Tone;
  depth: Depth;
  visualPreference: PreferenceLevel;
  examplePreference: PreferenceLevel;
  motivation: Motivation;
  memoryType: MemoryType;
  confidence: PreferenceLevel;
  revisionFrequency: PreferenceLevel;
}

export interface LearningProfileData {
  traits: LearnerTraits;
  version: number;
  completedAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  photoUrl: string | null;
  authProvider: "google" | "password" | "unknown";
  memberSince: string;
}

export interface SessionData {
  user: SessionUser;
  hasProfile: boolean;
}

export interface QuestionOptionView {
  id: string;
  label: string;
}

export interface QuestionView {
  id: string;
  category: string;
  text: string;
  multiSelect: boolean;
  options: QuestionOptionView[];
}

export interface QuestionnaireAnswer {
  questionId: string;
  /** One or more selected options per question. */
  optionIds: string[];
}

export type DetailLevel = "quick" | "standard" | "detailed";

/** Kept in sync with the server registry in `backend/src/config/languages.ts`. */
export type LessonLanguage = "en" | "hi" | "te" | "ta" | "es";

export interface LessonLanguageOption {
  code: LessonLanguage;
  label: string;
  /** The language's own name, e.g. "हिन्दी". */
  nativeLabel: string;
  /** BCP-47 tag for caption tracks and the browser voice. */
  locale: string;
}

export interface GenerationOptions {
  durationMin?: number;
  detailLevel?: DetailLevel;
  subtitles?: boolean;
  language?: LessonLanguage;
  /** Language written on the board and slides; unset = same as narration. */
  boardLanguage?: LessonLanguage;
}

export type AssetStatus = "pending" | "processing" | "ready" | "failed";

export interface PresentationStatus {
  content: AssetStatus;
  ppt: AssetStatus;
  audio: AssetStatus;
  video: AssetStatus;
}

export type DiagramType = "flow" | "cycle" | "compare" | "list" | "timeline" | "hierarchy" | "none";

export type BoardEventKind = "term" | "note" | "node";

/** When one board item is written, and how long the narrator stays on it. */
export interface BoardEvent {
  kind: BoardEventKind;
  index: number;
  at: number;
  until: number;
  /** False when the item's words weren't found in the script and its time was interpolated. */
  matched: boolean;
}

export interface BoardTimeline {
  events: BoardEvent[];
  /** Narration length the times are relative to — the player rescales to the real one. */
  durationSec: number;
  source: "spoken" | "estimated";
}

export interface SlideBoardView {
  keyTerms: string[];
  notes: string[];
  diagram: { type: DiagramType; nodes: string[] } | null;
  /** Null on lessons generated before timed boards existed. */
  timeline: BoardTimeline | null;
}

export interface StudyNotesDefinition {
  term: string;
  meaning: string;
}

export interface StudyNotesExample {
  problem: string;
  steps: string[];
}

export interface StudyNotesPractice {
  question: string;
  answer: string;
}

/** Notebook matter for a slide — what a student copies down. Null until the PPT stage writes it. */
export interface StudyNotesView {
  explanation: string;
  definitions: StudyNotesDefinition[];
  keyFacts: string[];
  example: StudyNotesExample | null;
  practice: StudyNotesPractice | null;
  commonMistake: string | null;
}

export interface SlideView {
  index: number;
  title: string;
  points: string[];
  script: string;
  board: SlideBoardView | null;
  studyNotes: StudyNotesView | null;
  imageCredit: string | null;
  imageUrl: string | null;
  renderedImageUrl: string | null;
  audioUrl: string | null;
  audioDurationSec: number | null;
}

export interface QuizQuestion {
  question: string;
  options: string[];
}

export interface LessonAssets {
  pptUrl: string | null;
  pdfUrl: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  srtUrl: string | null;
  vttUrl: string | null;
}

export interface PresentationDetail {
  id: string;
  topic: string;
  focus: string | null;
  /** Original filename of an uploaded PDF this lesson was grounded in, if any. */
  sourceFileName: string | null;
  title: string;
  subject: string;
  summary: string;
  status: PresentationStatus;
  error: string | null;
  profileSnapshot: LearnerTraits;
  slides: SlideView[];
  quiz: QuizQuestion[];
  assets: LessonAssets;
  generationOptions: GenerationOptions | null;
  /** Language the lesson is narrated in (always set; defaults to English). */
  language: LessonLanguage;
  /** BCP-47 tag for the caption track and the browser-voice fallback. */
  languageLocale: string;
  /** Language written on the board — resolved, so always set. */
  boardLanguage: LessonLanguage;
  boardLanguageLocale: string;
  videoDurationSec: number | null;
  hasAvatar: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PresentationSummary {
  id: string;
  topic: string;
  title: string;
  subject: string;
  status: PresentationStatus;
  slideCount: number;
  videoDurationSec: number | null;
  createdAt: string;
}

export interface LessonListData {
  items: PresentationSummary[];
  total: number;
  page: number;
  pages: number;
}

export interface RecentTopicView {
  topic: string;
  subject: string;
  count: number;
  lastUsedAt: string;
}

export interface AnalyticsData {
  lessonsGenerated: number;
  slidesCreated: number;
  videosGenerated: number;
  learningTimeSec: number;
  avgVideoLengthSec: number;
  favoriteSubjects: { subject: string; lessons: number }[];
  quizAttempts: number;
  avgQuizScorePct: number;
  dueReviews: number;
  studyStreak: number;
}

// ── Learning Paths ──────────────────────────────────────────────────────────
export type ModuleStatus = "pending" | "generated" | "completed";

export interface CourseModuleView {
  index: number;
  title: string;
  topic: string;
  focus: string;
  section: string;
  sectionIndex: number;
  status: ModuleStatus;
  presentationId: string | null;
  completedAt: string | null;
}

export interface CourseSectionView {
  index: number;
  title: string;
  modules: CourseModuleView[];
}

export type CourseSourceType = "goal" | "document";

export interface CourseView {
  id: string;
  goal: string;
  title: string;
  description: string;
  subject: string;
  /** Language the roadmap (and its lessons) is planned in. */
  language: LessonLanguage;
  modules: CourseModuleView[];
  sections: CourseSectionView[];
  totalModules: number;
  completedModules: number;
  progressPct: number;
  /** "document" when this path was planned from an uploaded PDF. */
  sourceType: CourseSourceType;
  sourceFileName: string | null;
  /** Useful topics the AI added beyond what the uploaded document covers. */
  enrichment: string[];
  createdAt: string;
}

// ── Smart Review ────────────────────────────────────────────────────────────
export interface ReviewEntryView {
  presentationId: string;
  topic: string;
  subject: string;
  dueAt: string;
  lastScorePct: number;
  repetitions: number;
}

export interface DueReviewsData {
  due: ReviewEntryView[];
  upcoming: ReviewEntryView[];
}

/** One question graded for the game mode; the key is revealed only after answering. */
export interface PlayAnswerResult {
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

export interface QuizAttemptResult {
  score: number;
  total: number;
  scorePct: number;
  passed: boolean;
  nextReviewAt: string;
  intervalDays: number;
  streak: number;
  answerKey: { correctIndex: number; explanation: string }[];
}
