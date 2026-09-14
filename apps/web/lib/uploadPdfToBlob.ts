import { upload } from "@vercel/blob/client";
import { firebaseAuth } from "@/lib/firebase";

export interface UploadedPdf {
  url: string;
  fileName: string;
}

/**
 * Uploads a grounding PDF straight from the browser to Vercel Blob storage,
 * bypassing our own API route entirely for the transfer itself — Vercel
 * serverless functions cap request bodies at ~4.5MB, well under the 20MB
 * this app otherwise accepts, so routing the file through our own route
 * (the old multipart-upload approach) 413'd on anything past a few MB.
 * Only the resulting Blob URL (a few bytes of JSON) goes to our route.
 */
export async function uploadPdfToBlob(file: File): Promise<UploadedPdf> {
  const currentUser = firebaseAuth().currentUser;
  if (!currentUser) throw new Error("You need to be signed in to upload a PDF");
  const token = await currentUser.getIdToken();

  const pathname = `sources/${currentUser.uid}/${Date.now()}-${file.name}`;

  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/blob/pdf-upload",
    // upload() can't attach a custom Authorization header, so the ID token
    // rides in clientPayload — verified server-side in the pdf-upload route.
    clientPayload: token,
  });

  return { url: blob.url, fileName: file.name };
}
