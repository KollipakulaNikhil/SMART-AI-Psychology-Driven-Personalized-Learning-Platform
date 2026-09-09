import fs from "fs";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import { PDFParse } from "pdf-parse";
import { DIRS, ensureDir } from "../utils/paths";
import { logger } from "../utils/logger";
import { userAgent } from "./scholar.service";
import type { ResearchPaper, ResearchPatent } from "../models/ResearchProject";

/**
 * "Show me the paper": renders the FIRST PAGE of each open-access paper PDF
 * (and each patent's front-page drawing) to a PNG the learner can see next
 * to the AI's explanation, then click through to the real thing.
 *
 * Rendering is pdfjs → canvas via pdf-parse's bundled `@napi-rs/canvas`, so
 * no headless browser and nothing to install. Every step is best-effort: a
 * paywalled PDF, a dead link or a render failure just marks that one source
 * "unavailable" and the project still completes.
 */

const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const SNAPSHOT_WIDTH = 900;
const CONCURRENCY = 3;

const http = axios.create({
  timeout: DOWNLOAD_TIMEOUT_MS,
  maxRedirects: 5,
  responseType: "arraybuffer",
  headers: {
    "User-Agent": userAgent(),
    Accept: "application/pdf, image/*;q=0.9, */*;q=0.5",
  },
  validateStatus: () => true,
});

async function download(url: string, maxBytes: number): Promise<{ data: Buffer; contentType: string }> {
  const response = await http.get<ArrayBuffer>(url, { maxContentLength: maxBytes, maxBodyLength: maxBytes });
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
  const data = Buffer.from(response.data);
  if (data.length === 0) throw new Error("empty response");
  return { data, contentType: String(response.headers["content-type"] ?? "") };
}

function looksLikePdf(data: Buffer): boolean {
  // Some hosts serve a PDF after a few bytes of whitespace/BOM.
  return data.subarray(0, 1024).toString("latin1").includes("%PDF");
}

/** First page of a PDF → palette PNG (crisp text, small file). */
export async function renderPdfFirstPage(pdf: Buffer): Promise<Buffer> {
  const parser = new PDFParse({ data: pdf });
  try {
    const result = await parser.getScreenshot({
      first: 1,
      desiredWidth: SNAPSHOT_WIDTH,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const page = result.pages[0];
    if (!page?.data) throw new Error("no page rendered");
    return await sharp(Buffer.from(page.data)).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function normaliseImage(image: Buffer): Promise<Buffer> {
  return sharp(image)
    .resize({ width: SNAPSHOT_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
}

async function snapshotFromPdfUrl(url: string): Promise<Buffer> {
  const { data } = await download(url, MAX_PDF_BYTES);
  if (!looksLikePdf(data)) throw new Error("not a PDF (probably a landing page or paywall)");
  return renderPdfFirstPage(data);
}

async function snapshotFromImageUrl(url: string): Promise<Buffer> {
  const { data, contentType } = await download(url, MAX_IMAGE_BYTES);
  if (looksLikePdf(data)) return renderPdfFirstPage(data);
  if (contentType && !/image\//.test(contentType) && !/^\x89PNG|^\xff\xd8/.test(data.subarray(0, 4).toString("latin1"))) {
    throw new Error(`unexpected content-type ${contentType}`);
  }
  return normaliseImage(data);
}

function projectDir(projectId: string): string {
  return ensureDir(path.join(DIRS.research, projectId));
}

async function saveSnapshot(projectId: string, fileName: string, png: Buffer): Promise<string> {
  const outPath = path.join(projectDir(projectId), fileName);
  await fs.promises.writeFile(outPath, png);
  return outPath;
}

/** Bounded-parallel map so a dozen PDF downloads don't all hit at once. */
async function mapWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

/**
 * Captures first pages for every paper and patent in place (mutates the
 * arrays' `snapshotPath` / `snapshotStatus`). Returns how many succeeded.
 */
export async function captureSnapshots(
  projectId: string,
  papers: ResearchPaper[],
  patents: ResearchPatent[]
): Promise<{ captured: number; attempted: number }> {
  let captured = 0;
  let attempted = 0;

  const paperJobs = papers.map((paper) => async () => {
    if (!paper.pdfUrl) {
      paper.snapshotStatus = "unavailable";
      return;
    }
    attempted += 1;
    try {
      const png = await snapshotFromPdfUrl(paper.pdfUrl);
      paper.snapshotPath = await saveSnapshot(projectId, `paper-${paper.index + 1}.png`, png);
      paper.snapshotStatus = "ready";
      captured += 1;
    } catch (error) {
      paper.snapshotStatus = "unavailable";
      logger.info(`Paper snapshot skipped (${paper.source} ${paper.externalId})`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const patentJobs = patents.map((patent) => async () => {
    const candidates = [patent.thumbnailUrl, patent.pdfUrl].filter((u): u is string => Boolean(u));
    if (candidates.length === 0) {
      patent.snapshotStatus = "unavailable";
      return;
    }
    attempted += 1;
    for (const candidate of candidates) {
      try {
        const png = candidate === patent.thumbnailUrl ? await snapshotFromImageUrl(candidate) : await snapshotFromPdfUrl(candidate);
        patent.snapshotPath = await saveSnapshot(projectId, `patent-${patent.index + 1}.png`, png);
        patent.snapshotStatus = "ready";
        captured += 1;
        return;
      } catch (error) {
        logger.info(`Patent snapshot attempt failed (${patent.patentNumber})`, {
          url: candidate,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    patent.snapshotStatus = "unavailable";
  });

  await mapWithConcurrency([...paperJobs, ...patentJobs], (job) => job());
  return { captured, attempted };
}

/** Removes a project's snapshot folder (on delete). */
export async function removeSnapshots(projectId: string): Promise<void> {
  await fs.promises.rm(path.join(DIRS.research, projectId), { recursive: true, force: true }).catch(() => undefined);
}
