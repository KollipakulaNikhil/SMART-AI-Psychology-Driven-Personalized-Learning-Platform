import path from "path";
import axios from "axios";
import sharp from "sharp";
import { env } from "../config/env";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import { DIRS, ensureDir } from "../utils/paths";

export interface SlideImage {
  /** Absolute path of the processed jpeg on disk. */
  filePath: string;
  credit: string;
}

interface PexelsPhoto {
  id: number;
  photographer: string;
  src: { large2x?: string; large?: string; original?: string };
}

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 900;

async function searchPexels(query: string): Promise<PexelsPhoto | null> {
  if (!env.PEXELS_API_KEY) return null;
  const { data } = await axios.get(PEXELS_SEARCH_URL, {
    headers: { Authorization: env.PEXELS_API_KEY },
    params: { query, per_page: 3, orientation: "landscape" },
    timeout: 15_000,
  });
  const photos: PexelsPhoto[] = data?.photos ?? [];
  return photos[0] ?? null;
}

async function downloadAndProcess(url: string, outPath: string): Promise<void> {
  const { data } = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 30_000,
  });
  await sharp(Buffer.from(data))
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover", position: "attention" })
    .jpeg({ quality: 82 })
    .toFile(outPath);
}

/**
 * Deterministic branded artwork used when Pexels has no match (or no API key):
 * a gradient composition derived from the slide title, so it is still unique
 * and on-theme rather than a broken image.
 */
async function generateFallbackArt(seedText: string, outPath: string): Promise<void> {
  const palette = [
    ["#6366F1", "#8B5CF6"],
    ["#8B5CF6", "#06B6D4"],
    ["#06B6D4", "#6366F1"],
    ["#4F46E5", "#0891B2"],
  ];
  let hash = 0;
  for (const char of seedText) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [from, to] = palette[hash % palette.length];
  const angle = (hash % 4) * 45;

  const circles = Array.from({ length: 5 }, (_, i) => {
    const cx = ((hash >> (i * 3)) % 100) * (IMAGE_WIDTH / 100);
    const cy = ((hash >> (i * 4 + 1)) % 100) * (IMAGE_HEIGHT / 100);
    const r = 80 + ((hash >> i) % 160);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" opacity="0.06"/>`;
  }).join("");

  const svg = `<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${circles}
</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(outPath);
}

/**
 * Fetches one context-matched image per slide. Tries the AI-authored search
 * query first, then a broader topic query, then deterministic branded art.
 */
export async function fetchSlideImage(
  presentationId: string,
  slideIndex: number,
  imagePrompt: string,
  topic: string
): Promise<SlideImage> {
  const dir = ensureDir(path.join(DIRS.uploadImages, presentationId));
  const outPath = path.join(dir, `slide-${slideIndex + 1}.jpg`);

  const queries = [imagePrompt, topic].filter((q) => q && q.trim().length > 0);

  for (const query of queries) {
    try {
      const photo = await withRetry(() => searchPexels(query), {
        attempts: 2,
        label: `Pexels search "${query}"`,
      });
      const url = photo?.src.large2x ?? photo?.src.large ?? photo?.src.original;
      if (photo && url) {
        await withRetry(() => downloadAndProcess(url, outPath), {
          attempts: 2,
          label: "Pexels download",
        });
        return { filePath: outPath, credit: `Photo by ${photo.photographer} on Pexels` };
      }
    } catch (error) {
      logger.warn(`Image fetch failed for query "${query}"`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await generateFallbackArt(`${topic}-${imagePrompt}-${slideIndex}`, outPath);
  return { filePath: outPath, credit: "SMART AI generated artwork" };
}
