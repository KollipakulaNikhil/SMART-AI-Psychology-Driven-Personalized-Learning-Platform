import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { connectDatabase } from "@smart-ai/core/config/db";
import { requireAuthToken } from "@/lib/api/requireAuth";
import { checkUploadRateLimit } from "@/lib/api/rateLimit";
import { toErrorResponse } from "@/lib/api/apiHandler";
import { SOURCE_PDF_MAX_BYTES, sourcePdfPrefix } from "@/lib/api/sourcePdf";

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
  try {
    await checkUploadRateLimit(request);
  } catch (error) {
    return toErrorResponse(error, request);
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) throw ApiError.unauthorized("Missing bearer token");
        await connectDatabase();
        const user = await requireAuthToken(clientPayload);
        // The token only works for this user's own upload folder. Without this
        // the browser chooses the path, and could write into anyone's.
        if (!pathname.startsWith(sourcePdfPrefix(user)) || pathname.includes("..")) {
          throw ApiError.forbidden("Uploads must go to your own folder");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          addRandomSuffix: true,
          maximumSizeInBytes: SOURCE_PDF_MAX_BYTES,
          tokenPayload: JSON.stringify({ userId: String(user._id) }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: the client receives the blob URL directly from `upload()`
        // and immediately hands it to the generation/course route, which
        // reads it right away and deletes it once text extraction is done.
      },
    });

    return NextResponse.json(jsonResponse, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Only our own, deliberate messages go back to the browser.
    const message = error instanceof ApiError ? error.message : "Upload authorization failed";
    return NextResponse.json({ error: message }, { status: error instanceof ApiError ? error.statusCode : 400 });
  }
}
