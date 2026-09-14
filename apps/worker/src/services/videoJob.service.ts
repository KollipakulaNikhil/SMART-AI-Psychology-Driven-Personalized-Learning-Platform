import { Types } from "mongoose";
import { Presentation, type PresentationDocument } from "@smart-ai/core/models/Presentation";
import { GeneratedVideo } from "@smart-ai/core/models/GeneratedVideo";
import { logger } from "@smart-ai/core/utils/logger";
import { logHistory } from "@smart-ai/core/services/history.service";
import { toLessonLanguage } from "@smart-ai/core/config/languages";
import { renderBoardDeck } from "./boardRenderer.service";
import { buildBoardVideo, burnSubtitles, finalizeLessonVideo, TAIL_PADDING, type BoardSegmentInput } from "./video.service";
import { buildLessonSubtitles } from "./subtitle.service";
import { removeScratch } from "../utils/scratch";

function learnerLine(traits: PresentationDocument["profileSnapshot"]): string {
  return `Tailored for a ${traits.knowledgeLevel} · ${traits.learningStyle} learner · ${traits.pace} pace`;
}

async function markFailed(presentation: PresentationDocument, error: unknown): Promise<void> {
  presentation.status.video = "failed";
  presentation.error = error instanceof Error ? error.message : String(error);
  presentation.videoJobStartedAt = undefined;
  await presentation.save().catch((saveError) =>
    logger.error("Failed to persist video failure state", { presentationId: presentation.id, saveError })
  );
}

/**
 * The heavy video render, claimed and run by this worker (see
 * polling/videoJobs.ts). Board reveal frames + narration are assembled by
 * ffmpeg into the board video, optionally captioned, then uploaded to Blob
 * as the final lesson MP4.
 *
 * The talking-head avatar overlay that used to run here has been dropped
 * entirely — it required a local Python/PyTorch environment that cannot
 * exist in any deployed target, serverless or otherwise.
 */
export async function runVideoJob(presentationId: string, userId: Types.ObjectId): Promise<void> {
  const presentation = await Presentation.findById(presentationId);
  if (!presentation) return;

  try {
    const traits = presentation.profileSnapshot;

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
    const silentSecForScript = (script: string) =>
      Math.min(20, Math.max(5, Math.round(script.split(/\s+/).filter(Boolean).length / 2.4)));
    const segments: BoardSegmentInput[] = [
      { frames: [deck.coverPath], silentDurationSec: COVER_SEC },
      ...presentation.slides.map((slide, index) => ({
        frames: deck.slideFrameGroups[index],
        audioUrl: slide.audioPath,
        silentDurationSec: silentSecForScript(slide.script),
      })),
      { frames: [deck.closingPath], silentDurationSec: CLOSING_SEC },
    ];

    const { boardVideoPath } = await buildBoardVideo(presentation.id, segments);
    let baseVideo = boardVideoPath;

    if (presentation.generationOptions?.subtitles !== false) {
      const subtitleFiles = await buildLessonSubtitles(presentation.id, {
        slides: presentation.slides,
        coverSec: COVER_SEC,
        tailPaddingSec: TAIL_PADDING,
      });
      presentation.srtPath = subtitleFiles.srtUrl;
      presentation.vttPath = subtitleFiles.vttUrl;

      const subtitledPath = boardVideoPath.replace(/\.mp4$/, "-subtitled.mp4");
      try {
        await burnSubtitles(
          baseVideo,
          subtitleFiles.localSrtPath,
          subtitledPath,
          toLessonLanguage(presentation.generationOptions?.language)
        );
        baseVideo = subtitledPath;
      } catch (error) {
        logger.warn("Subtitle burn-in failed; captions remain available as a CC track", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const result = await finalizeLessonVideo(baseVideo, presentation.id);

    presentation.videoPath = result.url;
    presentation.videoDurationSec = result.durationSec;
    presentation.hasAvatar = false;
    presentation.status.video = "ready";
    presentation.videoJobStartedAt = undefined;
    await presentation.save();

    await GeneratedVideo.create({
      userId,
      presentationId: presentation._id,
      topic: presentation.topic,
      filePath: result.url,
      durationSec: result.durationSec,
      sizeBytes: result.sizeBytes,
      slideCount: presentation.slides.length,
    });

    logHistory(userId, "video_generated", {
      presentationId: presentation._id,
      topic: presentation.topic,
      meta: { durationSec: result.durationSec, hasAvatar: false },
    });
    logger.info(`Lesson video ready: ${presentation.id} (${result.durationSec}s)`);
  } catch (error) {
    removeScratch(presentation.id);
    await markFailed(presentation, error);
  }
}
