import PDFDocument from "pdfkit";
import { uploadArtifact, fetchArtifactBuffer } from "../storage/blob";

const PAGE_W = 960;
const PAGE_H = 540;

/** Builds a 16:9 PDF handout from the rendered slide PNGs (one slide per page) and uploads it to Blob storage. */
export async function buildPdfFromSlides(
  presentationId: string,
  slideImageUrls: string[],
  title: string
): Promise<string> {
  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: 0,
    info: { Title: title, Author: "SMART AI", Creator: "SMART AI" },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const imageBuffers = await Promise.all(slideImageUrls.map((url) => fetchArtifactBuffer(url)));

  imageBuffers.forEach((imageBuffer, index) => {
    if (index > 0) doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    doc.image(imageBuffer, 0, 0, { width: PAGE_W, height: PAGE_H });
  });

  doc.end();
  const buffer = await done;

  const uploaded = await uploadArtifact("pdf", presentationId, "handout.pdf", buffer, {
    contentType: "application/pdf",
  });
  return uploaded.url;
}
