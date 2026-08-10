import fs from "fs";
import { z } from "zod";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { Presentation } from "../models/Presentation";
import { logHistory } from "../services/history.service";

export const downloadParamsSchema = z.object({
  id: z.string().refine(Types.ObjectId.isValid, "Invalid lesson id"),
  asset: z.enum(["ppt", "pdf", "audio", "video", "subtitles"]),
});

const ASSET_CONFIG = {
  ppt: { field: "pptPath", extension: "pptx", label: "presentation" },
  pdf: { field: "pdfPath", extension: "pdf", label: "handout" },
  audio: { field: "fullAudioPath", extension: "mp3", label: "narration" },
  video: { field: "videoPath", extension: "mp4", label: "video" },
  subtitles: { field: "srtPath", extension: "srt", label: "subtitles" },
} as const;

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "lesson"
  );
}

/** Authenticated file download for any generated asset the learner owns. */
export const downloadAsset = asyncHandler(async (req, res) => {
  const { id, asset } = req.params as z.infer<typeof downloadParamsSchema>;

  const presentation = await Presentation.findById(id);
  if (!presentation) throw ApiError.notFound("Lesson not found");
  if (!presentation.userId.equals(req.user!._id)) throw ApiError.forbidden();

  const config = ASSET_CONFIG[asset];
  const filePath = presentation[config.field];
  if (!filePath || !fs.existsSync(filePath)) {
    throw ApiError.notFound(`The ${config.label} has not been generated for this lesson yet`);
  }

  logHistory(req.user!._id, "asset_downloaded", {
    presentationId: presentation._id,
    topic: presentation.topic,
    meta: { asset },
  });

  const fileName = `${slugify(presentation.title || presentation.topic)}-smart-ai.${config.extension}`;
  res.download(filePath, fileName);
});
