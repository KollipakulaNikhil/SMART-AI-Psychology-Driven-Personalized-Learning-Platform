import { ApiError } from "@smart-ai/core/utils/ApiError";
import type { UserDocument } from "@smart-ai/core/models/User";

export const SOURCE_PDF_MAX_BYTES = 20 * 1024 * 1024;

/** Where a learner's own uploads live in Blob storage. Enforced at upload time and again on use. */
export function sourcePdfPrefix(user: Pick<UserDocument, "firebaseUid">): string {
  return `sources/${user.firebaseUid}/`;
}

/**
 * Confirms a client-supplied PDF URL is a file THIS user uploaded through our
 * own upload route, and returns it parsed.
 *
 * The URL arrives in a request body, and the server then downloads it and
 * deletes it. Without this check that is two holes at once: the server can be
 * pointed at any address it can reach (internal services, cloud metadata), and
 * any stored file — another learner's video, deck or audio — can be deleted by
 * passing its URL.
 */
export function assertOwnSourcePdf(rawUrl: string, user: Pick<UserDocument, "firebaseUid">): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw ApiError.badRequest("Invalid PDF reference");
  }
  const ownPath = decodeURIComponent(url.pathname).startsWith(`/${sourcePdfPrefix(user)}`);
  const isBlobHost = url.hostname.endsWith(".public.blob.vercel-storage.com");
  if (url.protocol !== "https:" || !isBlobHost || url.username || url.password || url.port || !ownPath) {
    throw ApiError.badRequest("This PDF was not uploaded from your account. Please upload it again.");
  }
  return url;
}

/** Downloads a verified source PDF, refusing anything over the upload size limit. */
export async function fetchOwnSourcePdf(rawUrl: string, user: Pick<UserDocument, "firebaseUid">): Promise<Buffer> {
  const url = assertOwnSourcePdf(rawUrl, user);
  // No redirects: a redirect would send the server somewhere the check above never saw.
  const res = await fetch(url, { redirect: "error", cache: "no-store" });
  if (!res.ok || !res.body) throw ApiError.badRequest("The uploaded PDF could not be read. Please upload it again.");

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > SOURCE_PDF_MAX_BYTES) throw ApiError.badRequest("That PDF is larger than the 20MB limit.");

  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > SOURCE_PDF_MAX_BYTES) {
      await reader.cancel();
      throw ApiError.badRequest("That PDF is larger than the 20MB limit.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
