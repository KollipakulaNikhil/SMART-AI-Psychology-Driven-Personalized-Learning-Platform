import path from "path";
import sharp from "sharp";
import type { SlideContent } from "@smart-ai/core/models/Presentation";
import { scratchDir } from "../utils/scratch";
import { BUBBLE_POS, BUBBLE_SIZE } from "./video.service";

/**
 * The words that sit on top of an AI-animated scene.
 *
 * A video model cannot draw legible text, so the slide's title and key terms
 * are rendered here as a crisp transparent PNG and composited over the Wan
 * footage by ffmpeg. Kept to the top edge: burned-in captions own the bottom.
 */

const W = 1920;
const H = 1080;
const INDIC = "'Nirmala UI','Noto Sans Devanagari','Noto Sans Telugu','Noto Sans Tamil'";
const SANS = `'Segoe UI',${INDIC},Arial,Helvetica,sans-serif`;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clip(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

const textWidth = (text: string, fontSize: number) => Math.ceil(text.length * fontSize * 0.56);

export async function renderSceneOverlay(
  presentationId: string,
  slide: Pick<SlideContent, "title" | "board">,
  slideNumber: number,
  totalSlides: number,
  /** Draw the frame ring around the teacher bubble. */
  withBubbleRing = false
): Promise<string> {
  const ringR = BUBBLE_SIZE / 2;
  const ring = withBubbleRing
    ? `<circle cx="${BUBBLE_POS.x + ringR}" cy="${BUBBLE_POS.y + ringR}" r="${ringR + 3}" fill="none" stroke="#F8FAFC" stroke-width="8"/>
  <circle cx="${BUBBLE_POS.x + ringR}" cy="${BUBBLE_POS.y + ringR}" r="${ringR + 9}" fill="none" stroke="rgba(129,140,248,0.9)" stroke-width="4"/>`
    : "";
  const title = clip(slide.title, 58);
  const titleSize = 44;
  const pillW = Math.min(W - 120, textWidth(title, titleSize) + 150);

  let chipX = 60;
  const chips = (slide.board?.keyTerms ?? [])
    .slice(0, 4)
    .map((term) => clip(term, 28))
    .map((term) => {
      const w = textWidth(term, 28) + 44;
      if (chipX + w > W - 60) return "";
      const svg = `<rect x="${chipX}" y="150" width="${w}" height="50" rx="25" fill="rgba(15,23,42,0.72)" stroke="rgba(34,211,238,0.7)" stroke-width="2"/>
  <text x="${chipX + 22}" y="184" font-family="${SANS}" font-size="28" fill="#E2E8F0">${esc(term)}</text>`;
      chipX += w + 14;
      return svg;
    })
    .join("\n  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#020617" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="260" fill="url(#topShade)"/>
  <rect x="60" y="52" width="${pillW}" height="80" rx="40" fill="rgba(15,23,42,0.82)"/>
  <circle cx="100" cy="92" r="24" fill="#818CF8"/>
  <text x="100" y="101" text-anchor="middle" font-family="${SANS}" font-size="26" font-weight="700" fill="#0B1120">${slideNumber}</text>
  <text x="140" y="107" font-family="${SANS}" font-size="${titleSize}" font-weight="600" fill="#F8FAFC">${esc(title)}</text>
  ${chips}
  ${ring}
  <text x="${W - 60}" y="102" text-anchor="end" font-family="${SANS}" font-size="24" fill="rgba(226,232,240,0.75)">${slideNumber} / ${totalSlides}</text>
</svg>`;

  const outPath = path.join(scratchDir(presentationId, "slides", "overlay"), `overlay-${String(slideNumber).padStart(2, "0")}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  return outPath;
}

function wrapLines(text: string, fontSize: number, maxWidthPx: number, maxLines: number): string[] {
  const maxChars = Math.max(8, Math.floor(maxWidthPx / (fontSize * 0.56)));
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && (current + " " + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = clip(lines[maxLines - 1] + "…", maxChars);
  }
  return lines;
}

/**
 * The words over the teacher's full-screen intro / outro: a small label, a
 * big heading and a line under it, on a shade rising from the bottom edge.
 */
export async function renderTitleCard(
  presentationId: string,
  name: string,
  label: string,
  heading: string,
  subline: string
): Promise<string> {
  const lines = wrapLines(heading, 76, W - 240, 2);
  const firstY = H - 190 - (lines.length - 1) * 92;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#020617" stop-opacity="0"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${H - 560}" width="${W}" height="560" fill="url(#shade)"/>
  <text x="120" y="${firstY - 96}" font-family="${SANS}" font-size="30" font-weight="600" letter-spacing="4" fill="#22D3EE">${esc(label.toUpperCase())}</text>
  <text font-family="${SANS}" font-size="76" font-weight="700" fill="#F8FAFC">${lines
    .map((line, i) => `<tspan x="120" y="${firstY + i * 92}">${esc(line)}</tspan>`)
    .join("")}</text>
  <text x="120" y="${H - 96}" font-family="${SANS}" font-size="34" fill="#CBD5E1">${esc(clip(subline, 90))}</text>
</svg>`;
  const outPath = path.join(scratchDir(presentationId, "slides", "overlay"), `${name}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  return outPath;
}

/** White circle on black — the alpha mask that cuts the teacher clip into a round bubble. */
export async function renderBubbleMask(presentationId: string): Promise<string> {
  const r = BUBBLE_SIZE / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BUBBLE_SIZE}" height="${BUBBLE_SIZE}"><rect width="100%" height="100%" fill="#000"/><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`;
  const outPath = path.join(scratchDir(presentationId, "slides", "overlay"), "bubble-mask.png");
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  return outPath;
}
