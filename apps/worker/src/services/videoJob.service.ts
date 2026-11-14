import { Types } from "mongoose";
import { Presentation, type PresentationDocument } from "@smart-ai/core/models/Presentation";
import { GeneratedVideo } from "@smart-ai/core/models/GeneratedVideo";
import { logger } from "@smart-ai/core/utils/logger";
import { logHistory } from "@smart-ai/core/services/history.service";
import { toLessonLanguage } from "@smart-ai/core/config/languages";
import { renderBoardDeck } from "./boardRenderer.service";
import { buildBoardVideo, burnSubtitles, finalizeLessonVideo, TAIL_PADDING, type BoardSegmentInput, type TeacherBubble } from "./video.service";
import { buildLessonSubtitles } from "./subtitle.service";
import { removeScratch, scratchDir } from "../utils/scratch";
import fs from "fs";
import path from "path";
import { env } from "@smart-ai/core/config/env";
import { uploadArtifact, fetchArtifactBuffer } from "@smart-ai/core/storage/blob";
import { generateScenePrompts, planSceneCounts, SCENE_STYLE } from "@smart-ai/core/services/videoScenes.service";
import { generateWanClip, isWanConfigured } from "./wan.service";
import { renderBubbleMask, renderSceneOverlay, renderTitleCard } from "./sceneOverlay.service";

const silentSecForScript = (script: string) =>
  Math.min(20, Math.max(5, Math.round(script.split(/\s+/).filter(Boolean).length / 2.4)));

/** Stable per-scene seed: a retry of the same lesson redraws the same shot. */
function sceneSeed(presentationId: string, slideIndex: number, sceneIndex: number): number {
  let hash = 0;
  for (const ch of `${presentationId}:${slideIndex}:${sceneIndex}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

/** Bump when the teacher prompts change, so cached clips are redrawn. */
const TEACHER_VERSION = "v1";

/**
 * One presenter per teaching tone. A fixed, very specific description plus a
 * static camera keeps the character centred, which is what lets the same clip
 * serve as the full-screen intro/outro AND be cropped into the corner bubble.
 */
const TEACHER_LOOK: Record<string, string> = {
  friendly:
    "a cheerful young woman teacher with shoulder-length dark hair, round glasses and a mustard yellow cardigan, in a bright colourful classroom with plants and shelves",
  professional:
    "a confident man teacher in his thirties with short dark hair, a neat navy blazer and a light blue shirt, in a clean modern classroom with a large window",
  academic:
    "a thoughtful grey-haired professor with a trimmed beard, tweed jacket and glasses, in a warm study lined with bookshelves",
};

/**
 * The animated teacher who opens the lesson, stays on screen in a bubble
 * while explaining, and closes it. Drawn once per tone and reused by every
 * later lesson — it is the same character each time, and a Wan clip costs
 * minutes of GPU.
 */
async function ensureTeacherClip(presentation: PresentationDocument): Promise<string | undefined> {
  const tone = TEACHER_LOOK[presentation.profileSnapshot.tone] ? presentation.profileSnapshot.tone : "friendly";
  const name = `teacher-${TEACHER_VERSION}-${tone}.mp4`;
  const localPath = path.join(scratchDir(presentation.id, "video-work", "wan"), "teacher.mp4");

  try {
    let url = presentation.teacherClipPath?.endsWith(name) ? presentation.teacherClipPath : undefined;
    if (!url) {
      const earlier = await Presentation.findOne({ teacherClipPath: { $regex: `${name}$` } })
        .select("teacherClipPath")
        .lean();
      url = earlier?.teacherClipPath;
    }
    if (url) {
      fs.writeFileSync(localPath, await fetchArtifactBuffer(url));
    } else {
      logger.info(`Wan teacher clip (${tone}) for ${presentation.id}: generating`);
      await generateWanClip(
        `Animated cartoon character, ${TEACHER_LOOK[tone]}, standing in the exact centre of the frame facing the camera, upper body shot, smiling warmly and talking directly to the viewer while gesturing with both hands as if explaining an idea, natural head movement, static camera. ${SCENE_STYLE}`,
        sceneSeed("teacher", 0, 0),
        localPath
      );
      const uploaded = await uploadArtifact("video", "shared", name, await fs.promises.readFile(localPath), {
        contentType: "video/mp4",
      });
      url = uploaded.url;
    }
    if (presentation.teacherClipPath !== url) {
      presentation.teacherClipPath = url;
      presentation.videoJobStartedAt = new Date();
      await presentation.save();
    }
    return localPath;
  } catch (error) {
    logger.warn("Teacher clip unavailable — the video will have no presenter", {
      presentationId: presentation.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Draws the lesson as AI-animated scenes: plans how many shots each slide
 * gets, has the content model write a text-to-video prompt per shot, then
 * renders each with Wan 2.2. Returns, per slide, the local clip paths that
 * succeeded (empty = that slide keeps its board frames).
 *
 * Prompts and finished clips are persisted on the slide as they land, so a
 * job that dies or is restarted resumes instead of paying for clips twice —
 * and every save re-stamps videoJobStartedAt, which is the heartbeat that
 * stops the web app from declaring a long GPU render stalled.
 */
async function renderWanScenes(presentation: PresentationDocument): Promise<string[][]> {
  const slides = presentation.slides;
  const counts = planSceneCounts(
    slides.map((slide) => slide.audioDurationSec ?? silentSecForScript(slide.script)),
    { perSlide: env.WAN_MAX_CLIPS_PER_SLIDE, perLesson: env.WAN_MAX_CLIPS_PER_LESSON }
  );

  const checkpoint = async () => {
    presentation.markModified("slides");
    presentation.videoJobStartedAt = new Date();
    await presentation.save();
  };

  // Only slides whose stored shot list doesn't match the plan need new prompts.
  const needsPrompts = counts.map((count, i) => ((slides[i].videoScenes?.length ?? 0) === count ? 0 : count));
  if (needsPrompts.some((count) => count > 0)) {
    const prompts = await generateScenePrompts(presentation.topic, slides, needsPrompts);
    slides.forEach((slide, i) => {
      if (needsPrompts[i] > 0) slide.videoScenes = prompts[i].map((prompt) => ({ prompt }));
    });
    await checkpoint();
  }

  const dir = scratchDir(presentation.id, "video-work", "wan");
  const clipPaths: string[][] = slides.map(() => []);
  let failures = 0;

  for (let i = 0; i < slides.length; i++) {
    const scenes = slides[i].videoScenes ?? [];
    for (let j = 0; j < Math.min(scenes.length, counts[i]); j++) {
      const scene = scenes[j];
      const name = `scene-${String(i + 1).padStart(2, "0")}-${j + 1}.mp4`;
      const localPath = path.join(dir, name);
      try {
        if (scene.clipPath) {
          fs.writeFileSync(localPath, await fetchArtifactBuffer(scene.clipPath));
        } else {
          // Three failures with nothing to show means the GPU endpoint is down
          // or misconfigured — stop burning long timeouts on the rest.
          if (failures >= 3 && clipPaths.every((paths) => paths.length === 0)) continue;
          logger.info(`Wan clip ${name} for ${presentation.id}: generating`);
          await generateWanClip(scene.prompt, sceneSeed(presentation.id, i, j), localPath);
          const uploaded = await uploadArtifact("video", presentation.id, name, await fs.promises.readFile(localPath), {
            contentType: "video/mp4",
          });
          scene.clipPath = uploaded.url;
          await checkpoint();
        }
        clipPaths[i].push(localPath);
      } catch (error) {
        failures++;
        logger.warn(`Wan clip ${name} failed — that shot falls back to the board`, {
          presentationId: presentation.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return clipPaths;
}

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

    // AI-animated scenes when a Wan endpoint is configured; any slide whose
    // clips fail (or the whole lot, if the endpoint is down) keeps the board.
    let sceneClips: string[][] = presentation.slides.map(() => []);
    let bubbleSlides: boolean[] = [];
    let overlays: (string | undefined)[] = [];
    let teacherClip: string | undefined;
    let bubble: TeacherBubble | undefined;
    let coverCard: string | undefined;
    let closingCard: string | undefined;
    if (isWanConfigured()) {
      try {
        teacherClip = await ensureTeacherClip(presentation);
        const conceptClips = await renderWanScenes(presentation);
        if (teacherClip) {
          bubble = { clipPath: teacherClip, maskPath: await renderBubbleMask(presentation.id) };
          coverCard = await renderTitleCard(
            presentation.id,
            "cover",
            presentation.subject || "Lesson",
            presentation.title,
            `Let's break down ${presentation.topic} together`
          ).catch(() => undefined);
          closingCard = await renderTitleCard(
            presentation.id,
            "closing",
            "You just learned",
            presentation.title,
            "Take the quiz to lock it in"
          ).catch(() => undefined);
        }
        // A slide whose own shots failed (or that the budget skipped) is taught
        // by the teacher full-screen, so the video stays animation throughout.
        sceneClips = conceptClips.map((clips) => (clips.length > 0 ? clips : teacherClip ? [teacherClip] : []));
        overlays = await Promise.all(
          presentation.slides.map((slide, index) =>
            sceneClips[index].length > 0
              ? renderSceneOverlay(
                  presentation.id,
                  slide,
                  index + 1,
                  presentation.slides.length,
                  Boolean(bubble) && conceptClips[index].length > 0
                ).catch(() => undefined)
              : undefined
          )
        );
        bubbleSlides = conceptClips.map((clips) => clips.length > 0);
      } catch (error) {
        logger.warn("Wan scene rendering failed — building the board video instead", {
          presentationId: presentation.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const animatedSlides = sceneClips.filter((clips) => clips.length > 0).length;

    const COVER_SEC = 4;
    const CLOSING_SEC = 5;
    const segments: BoardSegmentInput[] = [
      { frames: [deck.coverPath], silentDurationSec: COVER_SEC, clips: teacherClip ? [teacherClip] : [], overlayPath: coverCard },
      ...presentation.slides.map((slide, index) => ({
        frames: deck.slideFrameGroups[index],
        audioUrl: slide.audioPath,
        silentDurationSec: silentSecForScript(slide.script),
        clips: sceneClips[index],
        overlayPath: overlays[index],
        bubble: bubbleSlides[index] ? bubble : undefined,
      })),
      { frames: [deck.closingPath], silentDurationSec: CLOSING_SEC, clips: teacherClip ? [teacherClip] : [], overlayPath: closingCard },
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
    presentation.videoEngine = animatedSlides > 0 ? "wan" : "board";
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
      meta: { durationSec: result.durationSec, hasAvatar: false, animatedSlides },
    });
    logger.info(
      `Lesson video ready: ${presentation.id} (${result.durationSec}s, ${animatedSlides}/${presentation.slides.length} slides AI-animated)`
    );
  } catch (error) {
    removeScratch(presentation.id);
    await markFailed(presentation, error);
  }
}
