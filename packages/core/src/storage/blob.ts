import { put, del, list } from "@vercel/blob";
import { env } from "../config/env";

export type ArtifactKind =
  | "images"
  | "slides"
  | "ppt"
  | "pdf"
  | "audio"
  | "video"
  | "subtitles"
  | "research";

export interface UploadedArtifact {
  url: string;
  pathname: string;
}

const token = env.BLOB_READ_WRITE_TOKEN || undefined;

/**
 * Same call-site shape as the old `ensureDir(...) + fs.writeFileSync(...)` pair,
 * except it returns a public URL instead of a local path. Deterministic keys
 * (no random suffix) mean a retried generation stage simply overwrites the
 * previous attempt's blob instead of leaking orphaned files.
 */
export async function uploadArtifact(
  kind: ArtifactKind,
  ownerId: string,
  filename: string,
  data: Buffer | ReadableStream | string,
  opts: { contentType?: string } = {}
): Promise<UploadedArtifact> {
  const key = `${kind}/${ownerId}/${filename}`;
  const blob = await put(key, data, {
    access: "public",
    addRandomSuffix: false,
    contentType: opts.contentType,
    token,
  });
  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Pulls a previously uploaded artifact back into memory — needed wherever a
 * later pipeline stage re-embeds an earlier artifact (e.g. a slide image
 * getting base64-embedded into a rendered board/PPT slide).
 */
export async function fetchArtifactBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Blob fetch failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteArtifact(url: string): Promise<void> {
  await del(url, { token }).catch(() => undefined);
}

/** Replaces `fs.rmSync(dir, { recursive: true })` for a whole artifact tree. */
export async function deleteArtifactsByPrefix(kind: ArtifactKind, ownerId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${kind}/${ownerId}/`, cursor, token });
    await Promise.all(page.blobs.map((b) => del(b.url, { token })));
    cursor = page.cursor;
  } while (cursor);
}
