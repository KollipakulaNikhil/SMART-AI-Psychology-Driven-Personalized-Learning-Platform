import fs from "fs";
import path from "path";
import sharp from "sharp";
import { DIRS, ensureDir } from "../utils/paths";
import type { SlideBoard, SlideContent } from "../models/Presentation";

/**
 * Renders the "digital board" video frames: a dark teaching board where a
 * heading, key terms and a diagram are progressively revealed, as if a
 * presenter were writing them while narrating. Each slide yields an ordered
 * list of PNG frames (a reveal sequence) that the video pipeline times to the
 * narration. The bottom-left is intentionally kept clear for the optional
 * talking-head presenter overlay.
 */

const W = 1920;
const H = 1080;

const C = {
  boardTop: "#0B1120",
  boardBottom: "#0F172A",
  grid: "rgba(148,163,184,0.06)",
  frame: "#334155",
  chalk: "#F8FAFC",
  chalkDim: "#CBD5E1",
  muted: "#94A3B8",
  faint: "#64748B",
  primary: "#818CF8",
  secondary: "#A78BFA",
  accent: "#22D3EE",
  boxFill: "rgba(129,140,248,0.12)",
  boxFillAlt: "rgba(34,211,238,0.10)",
};

// Single-quote the family names: these sit inside double-quoted SVG attributes.
//
// The Indic families are appended rather than swapped in per language on
// purpose. Fontconfig resolves these stacks PER GLYPH, so Latin text still gets
// the handwriting face while Devanagari/Telugu/Tamil fall through to a face
// that actually has those glyphs — which means a board written in Telugu, or a
// bilingual board mixing English terms with Telugu notes, both render correctly
// with no language parameter threaded through every draw helper.
// (Note this is unlike libass, which does NOT fall back per glyph — burned-in
// subtitles still have to pick their font by language.)
const INDIC = "'Nirmala UI','Noto Sans Devanagari','Noto Sans Telugu','Noto Sans Tamil'";
const HAND = `'Ink Free','Segoe Print','Comic Sans MS',${INDIC},cursive`;
const SANS = `'Segoe UI',${INDIC},Arial,Helvetica,sans-serif`;

// Presenter overlay lives bottom-left; keep board content out of this box.
const PRESENTER_ZONE = { x: 40, y: 660, w: 420, h: 400 };

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrap(text: string, fontSize: number, maxWidthPx: number, maxLines: number): string[] {
  const maxChars = Math.max(6, Math.floor(maxWidthPx / (fontSize * 0.56)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,.;:]?$/, "")}…`;
  }
  return lines;
}

const DEFS = `<defs>
  <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.boardTop}"/>
    <stop offset="100%" stop-color="${C.boardBottom}"/>
  </linearGradient>
  <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${C.primary}"/>
    <stop offset="100%" stop-color="${C.accent}"/>
  </linearGradient>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="${C.accent}"/>
  </marker>
</defs>`;

function gridLines(): string {
  let lines = "";
  for (let x = 120; x < W; x += 120) {
    lines += `<line x1="${x}" y1="60" x2="${x}" y2="${H - 60}" stroke="${C.grid}" stroke-width="1"/>`;
  }
  for (let y = 120; y < H; y += 120) {
    lines += `<line x1="60" y1="${y}" x2="${W - 60}" y2="${y}" stroke="${C.grid}" stroke-width="1"/>`;
  }
  return lines;
}

function footer(pageLabel: string): string {
  return `
  <text x="${W - 80}" y="${H - 46}" text-anchor="end" font-family="${SANS}" font-size="24" fill="${C.faint}">${esc(pageLabel)}</text>
  <text x="${W - 80}" y="${H - 80}" text-anchor="end" font-family="${SANS}" font-size="22" fill="${C.faint}" font-weight="600">SMART <tspan fill="${C.primary}">AI</tspan></text>`;
}

async function renderFrame(bodySvg: string, outPath: string): Promise<string> {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
${DEFS}
<rect width="${W}" height="${H}" fill="url(#board)"/>
${gridLines()}
<rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="28" fill="none" stroke="${C.frame}" stroke-width="2"/>
<rect x="40" y="40" width="${W - 80}" height="6" rx="3" fill="url(#accentLine)"/>
${bodySvg}
</svg>`;
  await sharp(Buffer.from(svg), { density: 96 }).png().toFile(outPath);
  return outPath;
}

function headingSvg(title: string): { svg: string; bottomY: number } {
  const lines = wrap(title, 62, W - 260, 2);
  const startY = 168;
  const lineHeight = 78;
  const spans = lines
    .map((line, i) => `<tspan x="120" y="${startY + i * lineHeight}">${esc(line)}</tspan>`)
    .join("");
  const underlineY = startY + (lines.length - 1) * lineHeight + 26;
  return {
    svg: `
    <text font-family="${HAND}" font-size="62" font-weight="700" fill="${C.chalk}">${spans}</text>
    <path d="M120 ${underlineY} q 200 -14 430 0" stroke="url(#accentLine)" stroke-width="7" fill="none" stroke-linecap="round"/>`,
    bottomY: underlineY,
  };
}

function keyTermsSvg(terms: string[], topY: number): { svg: string; endY: number } {
  let svg = "";
  let y = topY + 60;
  for (const term of terms.slice(0, 6)) {
    const lines = wrap(term, 42, 620, 2);
    svg += `<circle cx="140" cy="${y - 14}" r="9" fill="${C.accent}"/>`;
    svg += `<text font-family="${HAND}" font-size="42" fill="${C.chalkDim}">${lines
      .map((line, i) => `<tspan x="176" y="${y + i * 52}">${esc(line)}</tspan>`)
      .join("")}</text>`;
    y += lines.length * 52 + 34;
    if (y > PRESENTER_ZONE.y - 20) break; // keep clear of the presenter overlay
  }
  return { svg, endY: y };
}

/**
 * Written explanation lines ("what the teacher writes under the headings").
 * Without a diagram they own the right panel at a comfortable size; with a
 * diagram they sit in the free bottom-middle strip between the presenter
 * zone and the diagram panel.
 */
function notesSvg(notes: string[], hasDiagram: boolean): string {
  if (notes.length === 0) return "";

  const region = hasDiagram
    ? { x: 520, width: 430, startY: 720, fontSize: 26, lineHeight: 36, maxY: H - 110 }
    : { x: 1060, width: 740, startY: 330, fontSize: 32, lineHeight: 44, maxY: H - 130 };

  let svg = hasDiagram
    ? ""
    : `<text x="${region.x}" y="${region.startY - 46}" font-family="${SANS}" font-size="24" fill="${C.faint}" letter-spacing="3">NOTES</text>
       <line x1="${region.x}" y1="${region.startY - 30}" x2="${region.x + 130}" y2="${region.startY - 30}" stroke="${C.secondary}" stroke-width="3" stroke-linecap="round"/>`;

  let y = region.startY;
  for (const note of notes.slice(0, 6)) {
    const lines = wrap(note, region.fontSize, region.width - 40, 3);
    const needed = lines.length * region.lineHeight + 22;
    if (y + needed > region.maxY) break;
    svg += `<text font-family="${HAND}" font-size="${region.fontSize - 4}" fill="${C.accent}"><tspan x="${region.x}" y="${y}">✎</tspan></text>`;
    svg += `<text font-family="${HAND}" font-size="${region.fontSize}" fill="${C.muted}">${lines
      .map((line, i) => `<tspan x="${region.x + 36}" y="${y + i * region.lineHeight}">${esc(line)}</tspan>`)
      .join("")}</text>`;
    y += needed;
  }
  return svg;
}

interface DiagramBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  alt?: boolean;
}

function boxSvg(box: DiagramBox): string {
  const lines = wrap(box.label, 30, box.w - 36, 2);
  const textStartY = box.y + box.h / 2 - (lines.length - 1) * 18 + 6;
  return `
  <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="16" fill="${box.alt ? C.boxFillAlt : C.boxFill}" stroke="${box.alt ? C.accent : C.primary}" stroke-width="2.5"/>
  <text x="${box.x + box.w / 2}" y="${textStartY}" text-anchor="middle" font-family="${SANS}" font-size="30" font-weight="600" fill="${C.chalk}">${lines
    .map((line, i) => `<tspan x="${box.x + box.w / 2}" y="${textStartY + i * 36}">${esc(line)}</tspan>`)
    .join("")}</text>`;
}

/** Renders up to `revealCount` diagram nodes on the right side of the board. */
function diagramSvg(board: SlideBoard | undefined, revealCount: number): string {
  const diagram = board?.diagram;
  if (!diagram || diagram.type === "none" || diagram.nodes.length === 0) return "";
  const nodes = diagram.nodes.slice(0, 7);
  const shown = Math.max(0, Math.min(revealCount, nodes.length));
  if (shown === 0) return "";

  const panelX = 1000;
  const panelW = 820;

  if (diagram.type === "timeline") {
    const railY = 560;
    const usable = panelW - 80;
    const stepX = nodes.length > 1 ? usable / (nodes.length - 1) : 0;
    let svg = `<line x1="${panelX + 40}" y1="${railY}" x2="${panelX + 40 + usable}" y2="${railY}" stroke="${C.frame}" stroke-width="3"/>`;
    nodes.slice(0, shown).forEach((label, i) => {
      const cx = panelX + 40 + stepX * i;
      const above = i % 2 === 0;
      svg += `<circle cx="${cx}" cy="${railY}" r="12" fill="${C.accent}"/>`;
      svg += `<line x1="${cx}" y1="${railY}" x2="${cx}" y2="${above ? railY - 90 : railY + 90}" stroke="${C.secondary}" stroke-width="2" stroke-dasharray="5 6"/>`;
      svg += boxSvg({ x: cx - 150, y: above ? railY - 180 : railY + 20, w: 300, h: 90, label, alt: !above });
    });
    return svg;
  }

  if (diagram.type === "hierarchy") {
    const top = 300;
    const rowH = 108;
    let svg = "";
    nodes.slice(0, shown).forEach((label, i) => {
      const inset = i * 46;
      const w = panelW - inset * 2;
      const y = top + i * rowH;
      if (i > 0) {
        svg += `<line x1="${panelX + panelW / 2}" y1="${y - rowH + 78}" x2="${panelX + panelW / 2}" y2="${y}" stroke="${C.accent}" stroke-width="3" marker-end="url(#arrow)"/>`;
      }
      svg += boxSvg({ x: panelX + inset, y, w, h: 78, label, alt: i % 2 === 1 });
    });
    return svg;
  }

  if (diagram.type === "compare") {
    const mid = Math.ceil(nodes.length / 2);
    const colW = 360;
    const leftX = panelX;
    const rightX = panelX + panelW - colW;
    let svg = `<line x1="${panelX + panelW / 2}" y1="300" x2="${panelX + panelW / 2}" y2="960" stroke="${C.frame}" stroke-width="2" stroke-dasharray="8 10"/>`;
    nodes.slice(0, shown).forEach((label, i) => {
      const inLeft = i < mid;
      const col = inLeft ? i : i - mid;
      svg += boxSvg({
        x: inLeft ? leftX : rightX,
        y: 320 + col * 150,
        w: colW,
        h: 110,
        label,
        alt: !inLeft,
      });
    });
    return svg;
  }

  // flow / cycle / list: vertical stack
  const boxW = 620;
  const boxH = 92;
  const gap = 42;
  const x = panelX + (panelW - boxW) / 2;
  const startY = 300;
  let svg = "";
  nodes.slice(0, shown).forEach((label, i) => {
    const y = startY + i * (boxH + gap);
    if (i > 0 && diagram.type !== "list") {
      const prevBottom = startY + (i - 1) * (boxH + gap) + boxH;
      svg += `<line x1="${x + boxW / 2}" y1="${prevBottom}" x2="${x + boxW / 2}" y2="${y}" stroke="${C.accent}" stroke-width="3" marker-end="url(#arrow)"/>`;
    }
    svg += boxSvg({ x, y, w: boxW, h: boxH, label, alt: i % 2 === 1 });
  });
  // cycle: draw a return arrow from the last shown box back up to the first
  if (diagram.type === "cycle" && shown === nodes.length && nodes.length > 1) {
    const firstY = startY + boxH / 2;
    const lastY = startY + (nodes.length - 1) * (boxH + gap) + boxH / 2;
    const railX = x + boxW + 46;
    svg += `<path d="M${x + boxW} ${lastY} H${railX} V${firstY} H${x + boxW}" stroke="${C.secondary}" stroke-width="3" fill="none" marker-end="url(#arrow)"/>`;
  }
  return svg;
}

/**
 * A framed photo on the right of the board (embedded as base64). Shown when the
 * slide has no diagram, so image-led slides carry a real picture instead of
 * empty space. Returns "" if there's no usable image.
 */
function imageSvg(slide: SlideContent): string {
  if (!slide.imagePath || !fs.existsSync(slide.imagePath)) return "";
  let data: string;
  try {
    data = fs.readFileSync(slide.imagePath).toString("base64");
  } catch {
    return "";
  }
  const x = 1040;
  const y = 300;
  const w = 760;
  const h = 470;
  return `
  <rect x="${x - 12}" y="${y - 12}" width="${w + 24}" height="${h + 24}" rx="26" fill="#1E293B"/>
  <clipPath id="slideImgClip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/></clipPath>
  <image href="data:image/jpeg;base64,${data}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#slideImgClip)"/>
  ${slide.imageCredit ? `<text x="${x + w}" y="${y + h + 32}" text-anchor="end" font-family="${SANS}" font-size="18" fill="${C.faint}">${esc(slide.imageCredit)}</text>` : ""}`;
}

/** The ordered reveal states of one slide's board: heading → terms → notes → diagram nodes. */
function slideRevealStates(slide: SlideContent): number {
  const terms = Math.min(6, slide.board?.keyTerms?.length ?? 0);
  const notes = Math.min(6, slide.board?.notes?.length ?? 0);
  const nodes =
    slide.board?.diagram && slide.board.diagram.type !== "none"
      ? Math.min(7, slide.board.diagram.nodes.length)
      : 0;
  return 1 + terms + notes + nodes; // 1 = heading-only opening state
}

function renderSlideState(slide: SlideContent, revealIndex: number, pageLabel: string): string {
  const heading = headingSvg(slide.title);
  const termCount = Math.min(6, slide.board?.keyTerms?.length ?? 0);
  const noteCount = Math.min(6, slide.board?.notes?.length ?? 0);
  const hasDiagram = Boolean(
    slide.board?.diagram && slide.board.diagram.type !== "none" && slide.board.diagram.nodes.length > 0
  );

  const hasImage = !hasDiagram && Boolean(slide.imagePath);

  const termsToShow = Math.max(0, Math.min(revealIndex, termCount));
  const notesToShow = Math.max(0, Math.min(revealIndex - termCount, noteCount));
  const nodesToShow = Math.max(0, revealIndex - termCount - noteCount);

  const terms = keyTermsSvg((slide.board?.keyTerms ?? []).slice(0, termsToShow), heading.bottomY);

  // Right side shows the diagram when there is one, otherwise a real photo.
  const rightSide = hasDiagram ? diagramSvg(slide.board, nodesToShow) : imageSvg(slide);

  // Notes take the right panel only when it's free — with a diagram OR an image
  // there, they move to the clear bottom strip instead of overlapping.
  return `
  ${heading.svg}
  ${terms.svg}
  ${notesSvg((slide.board?.notes ?? []).slice(0, notesToShow), hasDiagram || hasImage)}
  ${rightSide}
  ${footer(pageLabel)}`;
}

export interface RenderedBoard {
  /** cover frame, then per-slide reveal frame lists (in order), then closing frame. */
  coverPath: string;
  slideFrameGroups: string[][];
  closingPath: string;
  /** flat list of the final still of every slide (used for the PDF/preview). */
  finalStills: string[];
}

async function renderCover(
  dir: string,
  title: string,
  topic: string,
  learnerLine: string
): Promise<string> {
  const titleLines = wrap(title, 84, W - 320, 3);
  const startY = 380;
  const body = `
  <text font-family="${HAND}" font-size="84" font-weight="700" fill="${C.chalk}">${titleLines
    .map((line, i) => `<tspan x="160" y="${startY + i * 104}">${esc(line)}</tspan>`)
    .join("")}</text>
  <path d="M160 ${startY + titleLines.length * 104 - 40} q 240 -16 520 0" stroke="url(#accentLine)" stroke-width="8" fill="none" stroke-linecap="round"/>
  <text x="160" y="${startY + titleLines.length * 104 + 60}" font-family="${SANS}" font-size="34" fill="${C.muted}">${esc(
    `Let's break down ${topic} together`
  )}</text>
  <text x="160" y="${H - 130}" font-family="${SANS}" font-size="27" fill="${C.accent}">${esc(learnerLine)}</text>
  ${footer("SMART AI · digital board")}`;
  return renderFrame(body, path.join(dir, "cover.png"));
}

async function renderClosing(dir: string, title: string, summary: string): Promise<string> {
  const heading = headingSvg("Key Takeaways");
  const summaryLines = wrap(summary, 34, 1560, 8);
  const body = `
  ${heading.svg}
  <text font-family="${SANS}" font-size="34" fill="${C.chalkDim}">${summaryLines
    .map((line, i) => `<tspan x="120" y="${heading.bottomY + 80 + i * 54}">${esc(line)}</tspan>`)
    .join("")}</text>
  <text x="120" y="${H - 130}" font-family="${HAND}" font-size="40" fill="${C.accent}">${esc(
    `You just learned: ${title}`
  )}</text>
  ${footer("SMART AI · digital board")}`;
  return renderFrame(body, path.join(dir, "closing.png"));
}

/**
 * Renders the full board deck for a lesson: a cover, a progressive reveal
 * sequence per slide, and a closing frame.
 */
export async function renderBoardDeck(
  presentationId: string,
  title: string,
  topic: string,
  summary: string,
  learnerLine: string,
  slides: SlideContent[]
): Promise<RenderedBoard> {
  const dir = ensureDir(path.join(DIRS.slides, presentationId, "board"));
  const total = slides.length + 2;

  const coverPath = await renderCover(dir, title, topic, learnerLine);

  const slideFrameGroups: string[][] = [];
  const finalStills: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const states = slideRevealStates(slide);
    const pageLabel = `${i + 2} / ${total}`;
    const frames: string[] = [];
    for (let state = 0; state < states; state++) {
      const outPath = path.join(dir, `slide-${String(i + 1).padStart(2, "0")}-f${String(state).padStart(2, "0")}.png`);
      await renderFrame(renderSlideState(slide, state, pageLabel), outPath);
      frames.push(outPath);
    }
    slideFrameGroups.push(frames);
    finalStills.push(frames[frames.length - 1]);
    slide.boardImagePath = frames[frames.length - 1];
  }

  const closingPath = await renderClosing(dir, title, summary);

  return { coverPath, slideFrameGroups, closingPath, finalStills };
}

/** True when at least one slide carries renderable board content. */
export function slidesHaveBoard(slides: SlideContent[]): boolean {
  return slides.some(
    (slide) => (slide.board?.keyTerms?.length ?? 0) > 0 || Boolean(slide.board?.diagram)
  );
}
