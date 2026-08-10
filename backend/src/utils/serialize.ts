import type { PresentationDocument } from "../models/Presentation";
import { languageDefinition, resolveBoardLanguage, toLessonLanguage } from "../config/languages";
import { toPublicUrl } from "./paths";

/** Full lesson payload with filesystem paths converted to /static web URLs. */
export function serializePresentation(doc: PresentationDocument) {
  const language = toLessonLanguage(doc.generationOptions?.language);
  const boardLanguage = resolveBoardLanguage(language, doc.generationOptions?.boardLanguage);
  return {
    id: doc.id as string,
    topic: doc.topic,
    focus: doc.focus ?? null,
    title: doc.title,
    subject: doc.subject,
    summary: doc.summary,
    status: doc.status,
    error: doc.error ?? null,
    profileSnapshot: doc.profileSnapshot,
    slides: doc.slides.map((slide) => ({
      index: slide.index,
      title: slide.title,
      points: slide.points,
      script: slide.script,
      // Board content drives the interactive in-browser lesson player.
      board: slide.board
        ? {
            keyTerms: slide.board.keyTerms ?? [],
            notes: slide.board.notes ?? [],
            diagram: slide.board.diagram ?? null,
            // When each item gets written, so the player can draw it at the
            // moment the narrator says it. Null on pre-timeline lessons.
            timeline: slide.board.timeline
              ? {
                  events: slide.board.timeline.events ?? [],
                  durationSec: slide.board.timeline.durationSec ?? 0,
                  source: slide.board.timeline.source ?? "estimated",
                }
              : null,
          }
        : null,
      // The written matter behind the slide — what a student copies down.
      // Null until the deck has been built (the notes pass runs in the PPT stage).
      studyNotes: slide.studyNotes
        ? {
            explanation: slide.studyNotes.explanation ?? "",
            definitions: slide.studyNotes.definitions ?? [],
            keyFacts: slide.studyNotes.keyFacts ?? [],
            example: slide.studyNotes.example ?? null,
            practice: slide.studyNotes.practice ?? null,
            commonMistake: slide.studyNotes.commonMistake ?? null,
          }
        : null,
      imageCredit: slide.imageCredit ?? null,
      imageUrl: toPublicUrl(slide.imagePath),
      renderedImageUrl: toPublicUrl(slide.renderedImagePath),
      audioUrl: toPublicUrl(slide.audioPath),
      audioDurationSec: slide.audioDurationSec ?? null,
    })),
    quiz: doc.quiz,
    assets: {
      pptUrl: toPublicUrl(doc.pptPath),
      pdfUrl: toPublicUrl(doc.pdfPath),
      audioUrl: toPublicUrl(doc.fullAudioPath),
      videoUrl: toPublicUrl(doc.videoPath),
      srtUrl: toPublicUrl(doc.srtPath),
      vttUrl: toPublicUrl(doc.vttPath),
    },
    generationOptions: doc.generationOptions ?? null,
    // Drives the caption track's srclang and the browser-voice fallback.
    language,
    languageLocale: languageDefinition(language).locale,
    // What's written on the board — the player needs it to pick a font stack
    // that actually has the glyphs.
    boardLanguage,
    boardLanguageLocale: languageDefinition(boardLanguage).locale,
    videoDurationSec: doc.videoDurationSec ?? null,
    hasAvatar: doc.hasAvatar ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Compact shape for history/dashboard lists. */
export function serializePresentationSummary(doc: PresentationDocument) {
  return {
    id: doc.id as string,
    topic: doc.topic,
    title: doc.title,
    subject: doc.subject,
    status: doc.status,
    slideCount: doc.slides.length,
    videoDurationSec: doc.videoDurationSec ?? null,
    createdAt: doc.createdAt,
  };
}
