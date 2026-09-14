import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDatabase } from "@smart-ai/core/config/db";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { Presentation } from "@smart-ai/core/models/Presentation";
import { logHistory } from "@smart-ai/core/services/history.service";
import { requireAuth } from "@/lib/api/requireAuth";

const downloadParamsSchema = z.object({
  id: z.string().refine(Types.ObjectId.isValid, "Invalid lesson id"),
  asset: z.enum(["ppt", "pdf", "audio", "video", "subtitles"]),
});

const ASSET_CONFIG = {
  ppt: { field: "pptPath", extension: "pptx", label: "presentation", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  pdf: { field: "pdfPath", extension: "pdf", label: "handout", contentType: "application/pdf" },
  audio: { field: "fullAudioPath", extension: "mp3", label: "narration", contentType: "audio/mpeg" },
  video: { field: "videoPath", extension: "mp4", label: "video", contentType: "video/mp4" },
  subtitles: { field: "srtPath", extension: "srt", label: "subtitles", contentType: "application/x-subrip" },
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

/**
 * Authenticated file download for any generated asset the learner owns.
 * Assets live in Vercel Blob now, so this proxies the Blob bytes through
 * with a Content-Disposition header — a plain redirect would lose the
 * per-request ownership check the old `res.download` enforced.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; asset: string }> }) {
  try {
    await connectDatabase();
    const user = await requireAuth(req);
    const { id, asset } = downloadParamsSchema.parse(await ctx.params);

    const presentation = await Presentation.findById(id);
    if (!presentation) throw ApiError.notFound("Lesson not found");
    if (!presentation.userId.equals(user._id)) throw ApiError.forbidden();

    const config = ASSET_CONFIG[asset];
    const url = presentation[config.field as keyof typeof presentation] as string | undefined;
    if (!url) throw ApiError.notFound(`The ${config.label} has not been generated for this lesson yet`);

    const blobResponse = await fetch(url);
    if (!blobResponse.ok || !blobResponse.body) {
      throw ApiError.notFound(`The ${config.label} could not be retrieved`);
    }

    logHistory(user._id, "asset_downloaded", {
      presentationId: presentation._id,
      topic: presentation.topic,
      meta: { asset },
    });

    const fileName = `${slugify(presentation.title || presentation.topic)}-smart-ai.${config.extension}`;
    return new NextResponse(blobResponse.body, {
      headers: {
        "Content-Type": config.contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const isApiError = error instanceof ApiError;
    const status = isApiError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, message: isApiError ? message : "Download failed" }, { status });
  }
}
