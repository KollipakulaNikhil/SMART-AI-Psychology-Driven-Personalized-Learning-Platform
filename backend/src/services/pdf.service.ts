import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { DIRS, ensureDir } from "../utils/paths";

const PAGE_W = 960;
const PAGE_H = 540;

/** Builds a 16:9 PDF handout from the rendered slide PNGs (one slide per page). */
export async function buildPdfFromSlides(
  presentationId: string,
  slideImagePaths: string[],
  title: string
): Promise<string> {
  const outPath = path.join(ensureDir(DIRS.pdf), `${presentationId}.pdf`);

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_W, PAGE_H],
      margin: 0,
      info: { Title: title, Author: "SMART AI", Creator: "SMART AI" },
    });
    const stream = fs.createWriteStream(outPath);
    stream.on("finish", () => resolve(outPath));
    stream.on("error", reject);
    doc.pipe(stream);

    slideImagePaths.forEach((imagePath, index) => {
      if (index > 0) doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      doc.image(imagePath, 0, 0, { width: PAGE_W, height: PAGE_H });
    });

    doc.end();
  });
}
