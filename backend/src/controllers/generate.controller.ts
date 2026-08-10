import fs from "fs";
import path from "path";
import { z } from "zod";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { DIRS } from "../utils/paths";
import { serializePresentation } from "../utils/serialize";
import { ensureDir } from "../utils/paths";
import { DiagramType, Presentation, PresentationDocument, SlideBoard, SlideContent } from "../models/Presentation";
import { LearningProfile, LearnerTraits } from "../models/LearningProfile";
import { GeneratedVideo } from "../models/GeneratedVideo";
import { deriveGenerationParams } from "../prompts/profileBuilder";
import { generateLessonContent } from "../services/aiContent.service";
import { fetchSlideImage } from "../services/image.service";
import { synthesizeNarration } from "../services/tts.service";
import {
  buildBoardTimeline,
  estimateNarrationDuration,
} from "../services/boardTimeline.service";
import { renderDeck } from "../services/slideRenderer.service";
import { renderBoardDeck } from "../services/boardRenderer.service";
import { buildPptx } from "../services/ppt.service";
import { buildPdfFromSlides } from "../services/pdf.service";
import {
  buildBoardVideo,
  burnSubtitles,
  concatNarrationAudio,
  extractAudioWav,
  finalizeLessonVideo,
  overlayPresenter,
  probeDurationSec,
  TAIL_PADDING,
  type BoardSegmentInput,
} from "../services/video.service";
import { buildLessonSubtitles } from "../services/subtitle.service";
import { generateTalkingHead, isAvatarAvailable } from "../services/talkingHead.service";
import { translateLessonContent } from "../services/translation.service";
import { generateStudyNotes } from "../services/studyNotes.service";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LESSON_LANGUAGES,
  resolveBoardLanguage,
  toLessonLanguage,
} from "../config/languages";
import { logHistory, touchRecentTopic } from "../services/history.service";
import { touchStudyStreak } from "../services/review.service";
import { Course } from "../models/Course";

export const generateContentSchema = z.object({
  topic: z.string().trim().min(3, "Topic must be at least 3 characters").max(200),
  focus: z.string().trim().max(300).optional(),
  /** Target lesson length in minutes; omitted = matched to the learner's profile. */
  durationMin: z.coerce.number().int().min(1).max(30).optional(),
  detailLevel: z.enum(["quick", "standard", "detailed"]).optional(),
  /** Captions: CC track in the player, SRT download, burned into the MP4. */
  subtitles: z.boolean().optional().default(true),
  /** Language the lesson is narrated in — the voice the learner hears. */
  language: z.enum(LESSON_LANGUAGES).optional().default(DEFAULT_LANGUAGE),
  /**
   * Language of the text WRITTEN on the board and slides. Omitted means "same
   * as the narration", which is how every lesson behaved before this existed.
   *
   * Splitting the two is how real teaching works in multilingual classrooms:
   * the teacher explains in Telugu but writes "Relational Database" on the
   * board, because that is the form the learner will meet in an exam, a
   * textbook or an interview.
   */
  boardLanguage: z.enum(LESSON_LANGUAGES).optional(),
  /** Present when this lesson is a module of a Learning Path. */
  courseId: z.string().refine(Types.ObjectId.isValid, "Invalid course id").optional(),
  moduleIndex: z.coerce.number().int().min(0).max(20).optional(),
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

/**
 * Normalizes the model's optional board content into something always
 * renderable: if keyTerms are missing, derive them from the slide's points so
 * the digital board is never blank. When the learner asked for a detailed
 * board, missing notes fall back to the deck bullet points.
 */
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
      ? slide.board.notes.slice(0, 4)
      : detailLevel === "detailed"
        ? slide.points.slice(0, 3)
        : [];

  const diagram =
    slide.board?.diagram && slide.board.diagram.type !== "none" && slide.board.diagram.nodes.length > 0
      ? { type: slide.board.diagram.type, nodes: slide.board.diagram.nodes.slice(0, 6) }
      : undefined;

  return { keyTerms: keyTerms.length > 0 ? keyTerms : [toKeyTerm(slide.title)], notes, diagram };
}

/**
 * Fills in the notebook matter behind each slide, once per lesson.
 *
 * Deliberately non-fatal and deliberately here rather than in the content
 * stage: the deck and handout are downloads the learner opens later, so the
 * extra AI round-trips cost them nothing, and a lesson whose notes could not
 * be written still exports fine — just with bullets alone, as it did before.
 * Lessons generated before this existed pick their notes up the next time
 * their deck is rebuilt.
 */
async function ensureStudyNotes(
  presentation: PresentationDocument,
  traits: LearnerTraits
): Promise<void> {
  if (presentation.slides.every((slide) => slide.studyNotes)) return;

  const boardLanguage = resolveBoardLanguage(
    presentation.generationOptions?.language,
    presentation.generationOptions?.boardLanguage
  );

  try {
    const notes = await generateStudyNotes(
      presentation.topic,
      presentation.slides,
      traits,
      boardLanguage
    );
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

async function loadOwnedPresentation(
  presentationId: string,
  userId: Types.ObjectId
): Promise<PresentationDocument> {
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

/**
 * Stage 1 — profile-adapted lesson content via Gemini, plus one
 * context-matched image per slide.
 */
export const generateContent = asyncHandler(async (req, res) => {
  const user = req.user!;
  const {
    topic,
    focus,
    durationMin,
    detailLevel,
    subtitles,
    language,
    boardLanguage,
    courseId,
    moduleIndex,
  } = req.body as z.infer<typeof generateContentSchema>;
  const writtenLanguage = resolveBoardLanguage(language, boardLanguage);

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  if (!profile) {
    throw ApiError.unprocessable("Complete the learning psychology questionnaire before generating lessons");
  }

  const presentation = await Presentation.create({
    userId: user._id,
    topic,
    focus,
    profileSnapshot: profile.traits,
    generationOptions: { durationMin, detailLevel, subtitles, language, boardLanguage: writtenLanguage },
    status: { content: "processing", ppt: "pending", audio: "pending", video: "pending" },
  });

  try {
    const { content: englishContent } = await generateLessonContent(topic, profile.traits, focus, {
      durationMin,
      detailLevel,
    });

    // The lesson is authored in English (where the content prompt and the models
    // are strongest) and then translated; a no-op when both languages are
    // English. The voice and the board translate independently, so "explain in
    // Telugu, write in English" only translates the narration.
    const content = await translateLessonContent(englishContent, language, writtenLanguage);

    const { ttsSpeed: plannedSpeed } = deriveGenerationParams(profile.traits, {
      durationMin,
      detailLevel,
    });

    const slides: SlideContent[] = content.slides.map((slide, index) => {
      const board = normalizeBoard(slide, detailLevel);
      return {
        index,
        title: slide.title,
        points: slide.points,
        imagePrompt: slide.imagePrompt,
        script: slide.script,
        // Timed from an estimated duration for now — the audio stage rebuilds
        // this from real word boundaries. Doing it here means the interactive
        // board is fully playable the moment content exists, even if narration
        // never succeeds and the browser voice takes over.
        board: board && {
          ...board,
          timeline: buildBoardTimeline(
            board,
            slide.script,
            estimateNarrationDuration(slide.script, plannedSpeed),
            []
          ),
        },
      };
    });

    const images = await Promise.all(
      slides.map((slide) => fetchSlideImage(presentation.id, slide.index, slide.imagePrompt, topic))
    );
    images.forEach((image, index) => {
      slides[index].imagePath = image.filePath;
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

    // Learning Path integration: link this lesson to its course module.
    if (courseId && moduleIndex !== undefined) {
      await Course.updateOne(
        { _id: courseId, userId: user._id, "modules.index": moduleIndex },
        { $set: { "modules.$.presentationId": presentation._id, "modules.$.status": "generated" } }
      );
    }

    res.status(201).json({ success: true, data: serializePresentation(presentation) });
  } catch (error) {
    await markFailed(presentation, "content", error);
    throw error;
  }
});

/**
 * Stage 2 — renders the deck PNGs (shared with video), the .pptx download
 * and the PDF handout.
 */
export const generatePpt = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { presentationId } = req.body as z.infer<typeof presentationIdSchema>;
  const presentation = await loadOwnedPresentation(presentationId, user._id);

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
    res.json({ success: true, data: serializePresentation(presentation) });
  } catch (error) {
    await markFailed(presentation, "ppt", error);
    throw error;
  }
});

/** Stage 3 — per-slide ElevenLabs narration paced to the learner, plus a combined audio track. */
export const generateAudio = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { presentationId } = req.body as z.infer<typeof presentationIdSchema>;
  const presentation = await loadOwnedPresentation(presentationId, user._id);

  if (presentation.status.content !== "ready") {
    throw ApiError.unprocessable("Lesson content must be generated before narrating it");
  }

  presentation.status.audio = "processing";
  await presentation.save();

  try {
    const traits = presentation.profileSnapshot;
    const { ttsSpeed } = deriveGenerationParams(traits);
    const language = toLessonLanguage(presentation.generationOptions?.language);

    // Per-slide resilient: if ElevenLabs quota runs out mid-lesson, keep the
    // slides that DID narrate (premium voice for those) instead of losing all
    // of them — the interactive player uses the free browser voice for the rest.
    let narrated = 0;
    let lastError: unknown;
    for (const slide of presentation.slides) {
      try {
        const narration = await synthesizeNarration({
          presentationId: presentation.id,
          slideIndex: slide.index,
          text: slide.script,
          traits,
          speed: ttsSpeed,
          // Neighbouring scripts give ElevenLabs prosody context, so the voice
          // flows like one continuous lecture rather than isolated clips.
          previousText: presentation.slides[slide.index - 1]?.script,
          nextText: presentation.slides[slide.index + 1]?.script,
          language,
        });
        slide.audioPath = narration.audioPath;
        slide.audioDurationSec = await probeDurationSec(slide.audioPath);
        slide.wordTimings = narration.wordTimings.length > 0 ? narration.wordTimings : undefined;
        narrated++;
      } catch (error) {
        lastError = error;
        logger.warn(`Narration failed for slide ${slide.index + 1}; it will use the browser voice`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Rebuild the board timeline against whatever we now know. A narrated
      // slide gets real word boundaries (or at minimum its true duration); a
      // failed one keeps the estimate it was given at content time.
      if (slide.board) {
        const duration =
          slide.audioDurationSec ?? estimateNarrationDuration(slide.script, ttsSpeed);
        slide.board.timeline = buildBoardTimeline(
          slide.board,
          slide.script,
          duration,
          slide.wordTimings ?? []
        );
      }
    }

    const spokenTimelines = presentation.slides.filter(
      (slide) => slide.board?.timeline?.source === "spoken"
    ).length;
    logger.info(
      `Board timelines built for lesson ${presentation.id}: ${spokenTimelines}/${presentation.slides.length} from real word boundaries`
    );

    // A combined downloadable track only makes sense when every slide narrated.
    if (narrated === presentation.slides.length) {
      presentation.fullAudioPath = await concatNarrationAudio(
        presentation.id,
        presentation.slides.map((slide) => slide.audioPath as string)
      );
    }

    if (narrated === 0) {
      // Nothing narrated (quota exhausted). Non-fatal: the interactive lesson
      // still plays with the free browser voice. Surface the real reason.
      presentation.status.audio = "failed";
      presentation.error = lastError instanceof Error ? lastError.message : "Narration unavailable";
      presentation.markModified("slides");
      await presentation.save();
      throw lastError instanceof Error
        ? lastError
        : ApiError.serviceUnavailable("Narration could not be generated.");
    }

    presentation.status.audio = "ready";
    presentation.markModified("slides");
    await presentation.save();

    logHistory(user._id, "audio_generated", {
      presentationId: presentation._id,
      topic: presentation.topic,
      meta: { narrated, total: presentation.slides.length },
    });
    res.json({ success: true, data: serializePresentation(presentation) });
  } catch (error) {
    // status already set to failed above when nothing narrated.
    if (presentation.status.audio !== "failed") await markFailed(presentation, "audio", error);
    throw error;
  }
});

/**
 * The heavy video render. Runs in the BACKGROUND (not awaited by the request)
 * because the optional CPU Wav2Lip avatar can take many minutes on a long
 * lesson — far longer than any HTTP timeout. Progress is tracked on
 * `status.video`; the client polls GET /generate/:id until it flips to
 * ready/failed.
 */
/**
 * A render is only ever in-process, so a job that has outlived the longest
 * possible render (the CPU avatar path) is dead — the server was restarted, or
 * ffmpeg was killed. Without this, `status.video` stays "processing" forever and
 * the lesson page shows a "Rendering…" spinner with nothing behind it.
 */
const VIDEO_JOB_STALE_MS = 45 * 60 * 1000;

function isVideoJobStalled(presentation: PresentationDocument): boolean {
  const startedAt = presentation.videoJobStartedAt;
  // Rows written before this field existed can't be dated — treat them as stale
  // so the user can always retry rather than being stuck.
  if (!startedAt) return true;
  return Date.now() - startedAt.getTime() > VIDEO_JOB_STALE_MS;
}

/**
 * Clears video jobs orphaned by a server restart. Called once at boot: any row
 * still marked "processing" has no process behind it any more.
 */
export async function reclaimOrphanedVideoJobs(): Promise<number> {
  const { modifiedCount } = await Presentation.updateMany(
    { "status.video": "processing" },
    {
      $set: {
        "status.video": "failed",
        error: "The video render was interrupted when the server restarted. Press Generate video to try again.",
      },
    }
  );
  return modifiedCount;
}

async function runVideoJob(presentationId: string, userId: Types.ObjectId): Promise<void> {
  const presentation = await Presentation.findById(presentationId);
  if (!presentation) return;

  try {
    const traits = presentation.profileSnapshot;

    // Render the board deck: cover, per-slide progressive reveal frames, closing.
    const deck = await renderBoardDeck(
      presentation.id,
      presentation.title,
      presentation.topic,
      presentation.summary,
      learnerLine(traits),
      presentation.slides
    );
    presentation.markModified("slides"); // renderer stamped boardImagePath on each slide

    const COVER_SEC = 4;
    const CLOSING_SEC = 5;
    // A slide with no narration (TTS quota ran out) still needs on-screen time —
    // estimate it from the script length so the reader can keep up.
    const silentSecForScript = (script: string) =>
      Math.min(20, Math.max(5, Math.round(script.split(/\s+/).filter(Boolean).length / 2.4)));
    const segments: BoardSegmentInput[] = [
      { frames: [deck.coverPath], silentDurationSec: COVER_SEC },
      ...presentation.slides.map((slide, index) => ({
        frames: deck.slideFrameGroups[index],
        audioPath: slide.audioPath,
        silentDurationSec: silentSecForScript(slide.script),
      })),
      { frames: [deck.closingPath], silentDurationSec: CLOSING_SEC },
    ];

    const { boardVideoPath } = await buildBoardVideo(presentation.id, segments);

    // Optional lip-synced presenter overlay (gracefully skipped if not set up).
    let baseVideo = boardVideoPath;
    let hasAvatar = false;
    const availability = isAvatarAvailable();
    if (availability.available) {
      const audioDir = ensureDir(path.join(DIRS.audio, presentation.id));
      const boardWav = await extractAudioWav(boardVideoPath, path.join(audioDir, "board-audio.wav"));
      logger.info(`Rendering talking-head presenter for lesson ${presentation.id} (this can take a while on CPU)`);
      const presenterVideo = await generateTalkingHead(presentation.id, boardWav);
      if (presenterVideo) {
        const composited = path.join(DIRS.video, `${presentation.id}-composited.mp4`);
        await overlayPresenter(boardVideoPath, presenterVideo, composited);
        fs.rmSync(boardVideoPath, { force: true });
        fs.rmSync(path.join(DIRS.video, `${presentation.id}-avatar`), { recursive: true, force: true });
        baseVideo = composited;
        hasAvatar = true;
      }
    } else {
      logger.debug(`Avatar not composited: ${availability.reason}`);
    }

    // Captions: sidecar SRT/VTT from the measured narration timings, plus a
    // burned-in pass so downloads carry subtitles too. Burn-in failure is not
    // fatal — the CC track still works in the player.
    if (presentation.generationOptions?.subtitles !== false) {
      const subtitleFiles = buildLessonSubtitles(presentation.id, {
        slides: presentation.slides,
        coverSec: COVER_SEC,
        tailPaddingSec: TAIL_PADDING,
      });
      presentation.srtPath = subtitleFiles.srtPath;
      presentation.vttPath = subtitleFiles.vttPath;

      const subtitledPath = path.join(DIRS.video, `${presentation.id}-subtitled.mp4`);
      try {
        await burnSubtitles(
          baseVideo,
          subtitleFiles.srtPath,
          subtitledPath,
          toLessonLanguage(presentation.generationOptions?.language)
        );
        fs.rmSync(baseVideo, { force: true });
        baseVideo = subtitledPath;
      } catch (error) {
        logger.warn("Subtitle burn-in failed; captions remain available as a CC track", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const result = await finalizeLessonVideo(baseVideo, presentation.id);

    presentation.videoPath = result.videoPath;
    presentation.videoDurationSec = result.durationSec;
    presentation.hasAvatar = hasAvatar;
    presentation.status.video = "ready";
    presentation.videoJobStartedAt = undefined;
    await presentation.save();

    await GeneratedVideo.create({
      userId,
      presentationId: presentation._id,
      topic: presentation.topic,
      filePath: result.videoPath,
      durationSec: result.durationSec,
      sizeBytes: result.sizeBytes,
      slideCount: presentation.slides.length,
    });

    logHistory(userId, "video_generated", {
      presentationId: presentation._id,
      topic: presentation.topic,
      meta: { durationSec: result.durationSec, hasAvatar },
    });
    logger.info(`Lesson video ready: ${presentation.id} (${result.durationSec}s, avatar: ${hasAvatar})`);
  } catch (error) {
    // A failed render leaves its half-built segments behind; they are useless on
    // retry and lessons are large, so don't let them accumulate on disk.
    fs.rmSync(path.join(DIRS.video, `${presentation.id}-work`), { recursive: true, force: true });
    presentation.videoJobStartedAt = undefined;
    await markFailed(presentation, "video", error);
  }
}

/**
 * Stage 4 — kicks off the board+avatar video render in the background and
 * returns immediately with status "processing". The client polls the lesson
 * until the video is ready, so a slow avatar render never times out the request.
 */
export const generateVideo = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { presentationId } = req.body as z.infer<typeof presentationIdSchema>;
  const presentation = await loadOwnedPresentation(presentationId, user._id);

  // Only content is required — the video builds with whatever narration exists
  // (silent, script-timed slides for any that failed), so an exhausted TTS
  // quota can't leave the video stuck "processing" forever.
  if (presentation.status.content !== "ready") {
    throw ApiError.unprocessable("Lesson content must be generated before building the video");
  }
  if (presentation.status.video === "processing" && !isVideoJobStalled(presentation)) {
    // Genuinely still running — report current state, don't start a second job
    // (two renders would fight over the same output paths).
    res.json({ success: true, data: serializePresentation(presentation) });
    return;
  }

  presentation.status.video = "processing";
  presentation.videoJobStartedAt = new Date();
  presentation.error = undefined;
  await presentation.save();

  // Fire-and-forget: the render outlives this request.
  void runVideoJob(presentation.id, user._id).catch((error) =>
    logger.error("Unhandled error in background video job", {
      presentationId: presentation.id,
      error: error instanceof Error ? error.stack : String(error),
    })
  );

  res.status(202).json({ success: true, data: serializePresentation(presentation) });
});

/**
 * The lesson languages this server can actually narrate. Served from the same
 * registry the TTS voices come from, so the picker and the synthesizer can
 * never drift apart.
 */
export const listLessonLanguages = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: LESSON_LANGUAGES.map((code) => ({
      code,
      label: LANGUAGES[code].label,
      nativeLabel: LANGUAGES[code].nativeLabel,
      locale: LANGUAGES[code].locale,
    })),
  });
});

/** Live status/detail used by the pipeline UI and the lesson page. */
export const getPresentation = asyncHandler(async (req, res) => {
  const presentation = await loadOwnedPresentation(req.params.id, req.user!._id);
  res.json({ success: true, data: serializePresentation(presentation) });
});
