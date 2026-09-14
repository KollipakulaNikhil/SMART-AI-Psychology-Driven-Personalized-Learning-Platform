import { z } from "zod";
import { Types } from "mongoose";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { logger } from "@smart-ai/core/utils/logger";
import { serializePresentation } from "@smart-ai/core/utils/serialize";
import { DiagramType, Presentation, type PresentationDocument, type SlideBoard, type SlideContent } from "@smart-ai/core/models/Presentation";
import { LearningProfile, type LearnerTraits } from "@smart-ai/core/models/LearningProfile";
import { deriveGenerationParams } from "@smart-ai/core/prompts/profileBuilder";
import { generateLessonContent } from "@smart-ai/core/services/aiContent.service";
import { fetchSlideImage } from "@smart-ai/core/services/image.service";
import { synthesizeNarration } from "@smart-ai/core/services/tts.service";
import { buildBoardTimeline, estimateNarrationDuration } from "@smart-ai/core/services/boardTimeline.service";
import { renderDeck } from "@smart-ai/core/services/slideRenderer.service";
import { buildPptx } from "@smart-ai/core/services/ppt.service";
import { buildPdfFromSlides } from "@smart-ai/core/services/pdf.service";
import { probeDurationSecFromBuffer } from "@smart-ai/core/services/media/ffprobe";
import { concatNarrationAudioBuffers } from "@smart-ai/core/services/media/audioConcat";
import { uploadArtifact } from "@smart-ai/core/storage/blob";
import { translateLessonContent } from "@smart-ai/core/services/translation.service";
import { generateStudyNotes } from "@smart-ai/core/services/studyNotes.service";
import { DEFAULT_LANGUAGE, LANGUAGES, LESSON_LANGUAGES, resolveBoardLanguage, toLessonLanguage } from "@smart-ai/core/config/languages";
import { logHistory, touchRecentTopic } from "@smart-ai/core/services/history.service";
import { touchStudyStreak } from "@smart-ai/core/services/review.service";
import { Course } from "@smart-ai/core/models/Course";
import type { UserDocument } from "@smart-ai/core/models/User";
import { withStatus } from "@/lib/api/apiHandler";

export const generateContentSchema = z.object({
  topic: z.string().trim().min(3, "Topic must be at least 3 characters").max(200),
  focus: z.string().trim().max(300).optional(),
  durationMin: z.coerce.number().int().min(1).max(30).optional(),
  detailLevel: z.enum(["quick", "standard", "detailed"]).optional(),
  subtitles: z.boolean().optional().default(true),
  language: z.enum(LESSON_LANGUAGES).optional().default(DEFAULT_LANGUAGE),
  boardLanguage: z.enum(LESSON_LANGUAGES).optional(),
  courseId: z.string().refine(Types.ObjectId.isValid, "Invalid course id").optional(),
  moduleIndex: z.coerce.number().int().min(0).max(20).optional(),
});

export const generateContentFromPdfSchema = generateContentSchema.extend({
  subtitles: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .default(true)
    .transform((value) => value === true || value === "true"),
});

export const presentationIdSchema = z.object({
  presentationId: z.string().refine(Types.ObjectId.isValid, "Invalid presentation id"),
});

function learnerLine(traits: LearnerTraits): string {
  return `Tailored for a ${traits.knowledgeLevel} · ${traits.learningStyle} learner · ${traits.pace} pace`;
}

/** Trims a sentence into a short board-friendly phrase (≤5 words). */
function toKeyTerm(text: string): string {
  return text.split(/\s+/).slice(0, 5).join(" ").replace(/[.,;:]+$/, "");
}

function normalizeBoard(
  slide: {
    title: string;
    points: string[];
    board?: { keyTerms?: string[]; notes?: string[]; diagram?: { type: DiagramType; nodes: string[] } };
  },
  detailLevel?: string
): SlideBoard {
  const keyTerms =
    slide.board?.keyTerms && slide.board.keyTerms.length > 0
      ? slide.board.keyTerms.slice(0, 5)
      : slide.points.slice(0, 4).map(toKeyTerm).filter(Boolean);

  const notes =
    slide.board?.notes && slide.board.notes.length > 0
      ? slide.board.notes.slice(0, 6)
      : slide.points.slice(0, detailLevel === "detailed" ? 4 : 2);

  const diagram =
    slide.board?.diagram && slide.board.diagram.type !== "none" && slide.board.diagram.nodes.length > 0
      ? { type: slide.board.diagram.type, nodes: slide.board.diagram.nodes.slice(0, 7) }
      : undefined;

  return { keyTerms: keyTerms.length > 0 ? keyTerms : [toKeyTerm(slide.title)], notes, diagram };
}

async function ensureStudyNotes(presentation: PresentationDocument, traits: LearnerTraits): Promise<void> {
  if (presentation.slides.every((slide) => slide.studyNotes)) return;

  const boardLanguage = resolveBoardLanguage(
    presentation.generationOptions?.language,
    presentation.generationOptions?.boardLanguage
  );

  try {
    const notes = await generateStudyNotes(presentation.topic, presentation.slides, traits, boardLanguage);
    notes.forEach((note, index) => {
      if (note) presentation.slides[index].studyNotes = note;
    });
    presentation.markModified("slides");
  } catch (error) {
    logger.warn("Study notes pass failed entirely — exporting the deck without notes pages", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadOwnedPresentation(presentationId: string, userId: Types.ObjectId): Promise<PresentationDocument> {
  const presentation = await Presentation.findById(presentationId);
  if (!presentation) throw ApiError.notFound("Lesson not found");
  if (!presentation.userId.equals(userId)) throw ApiError.forbidden();
  return presentation;
}

async function markFailed(
  presentation: PresentationDocument,
  stage: "content" | "ppt" | "audio" | "video",
  error: unknown
): Promise<void> {
  presentation.status[stage] = "failed";
  presentation.error = error instanceof Error ? error.message : String(error);
  await presentation.save().catch((saveError) =>
    logger.error("Failed to persist failure state", { presentationId: presentation.id, saveError })
  );
}

interface CreateLessonContentInput {
  topic: string;
  focus?: string;
  durationMin?: number;
  detailLevel?: "quick" | "standard" | "detailed";
  subtitles: boolean;
  language: (typeof LESSON_LANGUAGES)[number];
  boardLanguage?: (typeof LESSON_LANGUAGES)[number];
  courseId?: string;
  moduleIndex?: number;
}

interface LessonSource {
  text: string;
  truncated: boolean;
  fileName: string;
}

async function createLessonContent(
  user: UserDocument,
  input: CreateLessonContentInput,
  source?: LessonSource
): Promise<PresentationDocument> {
  const { topic, focus, durationMin, detailLevel, subtitles, language, boardLanguage, courseId, moduleIndex } = input;
  const writtenLanguage = resolveBoardLanguage(language, boardLanguage);

  if (courseId && moduleIndex !== undefined) {
    const course = await Course.findOne({ _id: courseId, userId: user._id });
    if (!course) throw ApiError.notFound("Learning path not found");
    const isUnlocked = course.modules
      .filter((module) => module.index < moduleIndex)
      .every((module) => module.status === "completed");
    if (!isUnlocked) {
      throw ApiError.forbidden("Finish the previous lesson before starting this one");
    }
  }

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  if (!profile) {
    throw ApiError.unprocessable("Complete the learning psychology questionnaire before generating lessons");
  }

  const presentation = await Presentation.create({
    userId: user._id,
    topic,
    focus,
    sourceFileName: source?.fileName,
    profileSnapshot: profile.traits,
    generationOptions: { durationMin, detailLevel, subtitles, language, boardLanguage: writtenLanguage },
    status: { content: "processing", ppt: "pending", audio: "pending", video: "pending" },
  });

  try {
    const { content: englishContent } = await generateLessonContent(topic, profile.traits, focus, {
      durationMin,
      detailLevel,
      sourceText: source?.text,
      sourceTruncated: source?.truncated,
    });

    const content = await translateLessonContent(englishContent, language, writtenLanguage);

    const { ttsSpeed: plannedSpeed } = deriveGenerationParams(profile.traits, { durationMin, detailLevel });

    const slides: SlideContent[] = content.slides.map((slide, index) => {
      const board = normalizeBoard(slide, detailLevel);
      return {
        index,
        title: slide.title,
        points: slide.points,
        imagePrompt: slide.imagePrompt,
        script: slide.script,
        board: board && {
          ...board,
          timeline: buildBoardTimeline(board, slide.script, estimateNarrationDuration(slide.script, plannedSpeed), []),
        },
      };
    });

    const images = await Promise.all(
      slides.map((slide) => fetchSlideImage(presentation.id, slide.index, slide.imagePrompt, topic))
    );
    images.forEach((image, index) => {
      slides[index].imagePath = image.url;
      slides[index].imageCredit = image.credit;
    });

    presentation.title = content.title;
    presentation.subject = content.subject;
    presentation.summary = content.summary;
    presentation.slides = slides;
    presentation.quiz = content.quiz;
    presentation.status.content = "ready";
    presentation.error = undefined;
    await presentation.save();

    await touchRecentTopic(user._id, topic, content.subject);
    await touchStudyStreak(user);
    logHistory(user._id, "content_generated", { presentationId: presentation._id, topic });

    if (courseId && moduleIndex !== undefined) {
      await Course.updateOne(
        { _id: courseId, userId: user._id, "modules.index": moduleIndex },
        { $set: { "modules.$.presentationId": presentation._id, "modules.$.status": "generated" } }
      );
    }

    return presentation;
  } catch (error) {
    await markFailed(presentation, "content", error);
    throw error;
  }
}

/** Stage 1 — profile-adapted lesson content, plus one context-matched image per slide. */
export async function generateContent(user: UserDocument, body: z.infer<typeof generateContentSchema>) {
  const presentation = await createLessonContent(user, body);
  return withStatus(serializePresentation(presentation), 201);
}

/** Same as generateContent, but grounded in an uploaded PDF's extracted text. */
export async function generateContentFromPdf(
  user: UserDocument,
  body: z.infer<typeof generateContentFromPdfSchema>,
  source: LessonSource
) {
  const presentation = await createLessonContent(user, body, source);
  return withStatus(serializePresentation(presentation), 201);
}

/** Stage 2 — renders the deck PNGs (shared with the worker's video job), the .pptx and the PDF handout. */
export async function generatePpt(user: UserDocument, body: z.infer<typeof presentationIdSchema>) {
  const presentation = await loadOwnedPresentation(body.presentationId, user._id);

  if (presentation.status.content !== "ready") {
    throw ApiError.unprocessable("Lesson content must be generated before building the presentation");
  }

  presentation.status.ppt = "processing";
  await presentation.save();

  try {
    const traits = presentation.profileSnapshot;
    const { imageEmphasis } = deriveGenerationParams(traits);

    await ensureStudyNotes(presentation, traits);

    const deck = await renderDeck({
      presentationId: presentation.id,
      title: presentation.title,
      topic: presentation.topic,
      summary: presentation.summary,
      learnerLine: learnerLine(traits),
      slides: presentation.slides,
      quiz: presentation.quiz,
      imageEmphasis,
    });
    presentation.slides.forEach((slide, index) => {
      slide.renderedImagePath = deck.contentPaths[index];
    });

    presentation.pptPath = await buildPptx({
      presentationId: presentation.id,
      title: presentation.title,
      topic: presentation.topic,
      summary: presentation.summary,
      slides: presentation.slides,
      quiz: presentation.quiz,
      traits,
      imageEmphasis,
    });

    presentation.pdfPath = await buildPdfFromSlides(presentation.id, deck.allPaths, presentation.title);

    presentation.status.ppt = "ready";
    presentation.markModified("slides");
    await presentation.save();

    logHistory(user._id, "ppt_generated", { presentationId: presentation._id, topic: presentation.topic });
    return serializePresentation(presentation);
  } catch (error) {
    await markFailed(presentation, "ppt", error);
    throw error;
  }
}

/** Stage 3 — per-slide TTS narration paced to the learner, plus a combined audio track. */
export async function generateAudio(user: UserDocument, body: z.infer<typeof presentationIdSchema>) {
  const presentation = await loadOwnedPresentation(body.presentationId, user._id);

  if (presentation.status.content !== "ready") {
    throw ApiError.unprocessable("Lesson content must be generated before narrating it");
  }

  presentation.status.audio = "processing";
  await presentation.save();

  try {
    const traits = presentation.profileSnapshot;
    const { ttsSpeed } = deriveGenerationParams(traits);
    const language = toLessonLanguage(presentation.generationOptions?.language);

    let narrated = 0;
    let lastError: unknown;
    const narratedBuffers: (Buffer | undefined)[] = new Array(presentation.slides.length).fill(undefined);

    for (const slide of presentation.slides) {
      try {
        const narration = await synthesizeNarration({
          presentationId: presentation.id,
          slideIndex: slide.index,
          text: slide.script,
          traits,
          speed: ttsSpeed,
          previousText: presentation.slides[slide.index - 1]?.script,
          nextText: presentation.slides[slide.index + 1]?.script,
          language,
        });
        const durationSec = await probeDurationSecFromBuffer(narration.audioBuffer, "mp3");
        const uploaded = await uploadArtifact("audio", presentation.id, `slide-${slide.index + 1}.mp3`, narration.audioBuffer, {
          contentType: "audio/mpeg",
        });
        slide.audioPath = uploaded.url;
        slide.audioDurationSec = durationSec;
        slide.wordTimings = narration.wordTimings.length > 0 ? narration.wordTimings : undefined;
        narratedBuffers[slide.index] = narration.audioBuffer;
        narrated++;
      } catch (error) {
        lastError = error;
        logger.warn(`Narration failed for slide ${slide.index + 1}; it will use the browser voice`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (slide.board) {
        const duration = slide.audioDurationSec ?? estimateNarrationDuration(slide.script, ttsSpeed);
        slide.board.timeline = buildBoardTimeline(slide.board, slide.script, duration, slide.wordTimings ?? []);
      }
    }

    const spokenTimelines = presentation.slides.filter((slide) => slide.board?.timeline?.source === "spoken").length;
    logger.info(
      `Board timelines built for lesson ${presentation.id}: ${spokenTimelines}/${presentation.slides.length} from real word boundaries`
    );

    if (narrated === presentation.slides.length) {
      const combined = await concatNarrationAudioBuffers(narratedBuffers as Buffer[]);
      const uploaded = await uploadArtifact("audio", presentation.id, "lesson-full.mp3", combined, {
        contentType: "audio/mpeg",
      });
      presentation.fullAudioPath = uploaded.url;
    }

    if (narrated === 0) {
      presentation.status.audio = "failed";
      presentation.error = lastError instanceof Error ? lastError.message : "Narration unavailable";
      presentation.markModified("slides");
      await presentation.save();
      throw lastError instanceof Error ? lastError : ApiError.serviceUnavailable("Narration could not be generated.");
    }

    presentation.status.audio = "ready";
    presentation.markModified("slides");
    await presentation.save();

    logHistory(user._id, "audio_generated", {
      presentationId: presentation._id,
      topic: presentation.topic,
      meta: { narrated, total: presentation.slides.length },
    });
    return serializePresentation(presentation);
  } catch (error) {
    if (presentation.status.audio !== "failed") await markFailed(presentation, "audio", error);
    throw error;
  }
}

/**
 * A render is only ever claimed by the worker, so a job that has outlived any
 * plausible render is dead — the worker crashed or was redeployed mid-job.
 */
const VIDEO_JOB_STALE_MS = 45 * 60 * 1000;

function isVideoJobStalled(presentation: PresentationDocument): boolean {
  const startedAt = presentation.videoJobStartedAt;
  if (!startedAt) return true;
  return Date.now() - startedAt.getTime() > VIDEO_JOB_STALE_MS;
}

/**
 * Stage 4 — marks the lesson "processing" so the worker's poll loop picks it
 * up (see apps/worker/src/polling/videoJobs.ts) and returns immediately. The
 * client polls GET /api/generate/:id until status.video flips to ready/failed.
 */
export async function generateVideo(user: UserDocument, body: z.infer<typeof presentationIdSchema>) {
  const presentation = await loadOwnedPresentation(body.presentationId, user._id);

  if (presentation.status.content !== "ready") {
    throw ApiError.unprocessable("Lesson content must be generated before building the video");
  }
  if (presentation.status.video === "processing" && !isVideoJobStalled(presentation)) {
    // Genuinely still running — report current state, don't queue a second job.
    return serializePresentation(presentation);
  }

  presentation.status.video = "processing";
  presentation.videoJobStartedAt = new Date();
  presentation.error = undefined;
  await presentation.save();

  return withStatus(serializePresentation(presentation), 202);
}

export function listLessonLanguages() {
  return LESSON_LANGUAGES.map((code) => ({
    code,
    label: LANGUAGES[code].label,
    nativeLabel: LANGUAGES[code].nativeLabel,
    locale: LANGUAGES[code].locale,
  }));
}

export async function getPresentation(user: UserDocument, presentationId: string) {
  const presentation = await loadOwnedPresentation(presentationId, user._id);
  return serializePresentation(presentation);
}
