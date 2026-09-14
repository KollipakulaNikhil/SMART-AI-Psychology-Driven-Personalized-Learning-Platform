import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { requireAuthToken } from "@/lib/api/requireAuth";

/**
 * Authorizes a direct browser → Vercel Blob upload for a grounding PDF.
 *
 * Vercel serverless functions cap request bodies at ~4.5MB, well under the
 * 20MB PDFs this app accepts — routing the file itself through our own
 * Route Handler (the old multipart-upload approach) hit that cap in
 * production with a bare 413 before our code ever ran. This route only
 * ever sees a small JSON handshake; the actual file bytes go straight from
 * the browser to Blob storage, so the size cap that matters is Blob's own
 * (configured below), not Vercel's function body limit.
 *
 * The client `upload()` call has no way to attach a custom Authorization
 * header, so the Firebase ID token rides in `clientPayload` instead and is
 * verified here exactly the way `requireAuth` verifies the header elsewhere.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!clientPayload) throw ApiError.unauthorized("Missing bearer token");
        const user = await requireAuthToken(clientPayload);
        return {
          allowedContentTypes: ["application/pdf"],
          addRandomSuffix: true,
          maximumSizeInBytes: 20 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId: String(user._id) }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: the client receives the blob URL directly from `upload()`
        // and immediately hands it to the generation/course route, which
        // reads it right away and deletes it once text extraction is done.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload authorization failed" },
      { status: 400 }
    );
  }
}
