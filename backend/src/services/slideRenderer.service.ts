import fs from "fs";
import path from "path";
import sharp from "sharp";
import { DIRS, ensureDir } from "../utils/paths";
import type { QuizQuestion, SlideContent, SlideStudyNotes } from "../models/Presentation";
import { collectPractice } from "./studyNotes.service";

const W = 1920;
const H = 1080;

const COLORS = {
  background: "#0F172A",
  card: "#1E293B",
  primary: "#6366F1",
  secondary: "#8B5CF6",
  accent: "#06B6D4",
  warn: "#FBBF24",
  text: "#F1F5F9",
  muted: "#94A3B8",
  faint: "#64748B",
};

const FONT = "Segoe UI, Arial, Helvetica, sans-serif";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word wrap sized by average glyph width for the given font size. */
function wrapText(text: string, fontSize: number, maxWidthPx: number, maxLines: number): string[] {
  const maxChars = Math.max(8, Math.floor(maxWidthPx / (fontSize * 0.54)));
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

function tspans(lines: string[], x: number, startY: number, lineHeight: number): string {
  return lines
    .map((line, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${esc(line)}</tspan>`)
    .join("");
}

function decorativeBlobs(seed: number): string {
  const positions = [
    [1700, 120, 260],
    [180, 950, 300],
    [1500, 980, 200],
  ];
  return positions
    .map(
      ([cx, cy, r], i) =>
        `<circle cx="${cx}" cy="${cy}" r="${r + ((seed * (i + 3)) % 60)}" fill="url(#accentGrad)" opacity="0.10"/>`
    )
    .join("");
}

const SVG_DEFS = `<defs>
  <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${COLORS.primary}"/>
    <stop offset="55%" stop-color="${COLORS.secondary}"/>
    <stop offset="100%" stop-color="${COLORS.accent}"/>
  </linearGradient>
  <clipPath id="imageClip"><rect x="0" y="0" width="640" height="660" rx="28"/></clipPath>
</defs>`;

function footer(pageLabel: string): string {
  return `
  <text x="80" y="${H - 44}" font-family="${FONT}" font-size="24" fill="${COLORS.faint}" font-weight="600">SMART <tspan fill="${COLORS.primary}">AI</tspan></text>
  <text x="${W - 80}" y="${H - 44}" text-anchor="end" font-family="${FONT}" font-size="24" fill="${COLORS.faint}">${esc(pageLabel)}</text>
  <rect x="0" y="0" width="${W}" height="10" fill="url(#accentGrad)"/>`;
}

async function renderSvg(svgBody: string, outPath: string): Promise<string> {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
${SVG_DEFS}
<rect width="${W}" height="${H}" fill="${COLORS.background}"/>
${svgBody}
</svg>`;
  await sharp(Buffer.from(svg), { density: 96 }).png().toFile(outPath);
  return outPath;
}

export async function renderCoverSlide(
  title: string,
  topic: string,
  learnerLine: string,
  outPath: string
): Promise<string> {
  const titleLines = wrapText(title, 88, 1560, 3);
  const body = `
  ${decorativeBlobs(7)}
  <rect x="140" y="300" width="120" height="14" rx="7" fill="url(#accentGrad)"/>
  <text font-family="${FONT}" font-size="88" font-weight="700" fill="${COLORS.text}">
    ${tspans(titleLines, 140, 430, 110)}
  </text>
  <text font-family="${FONT}" font-size="36" fill="${COLORS.muted}">
    ${tspans(wrapText(`A personalized lesson on ${topic}`, 36, 1560, 2), 140, 460 + titleLines.length * 110, 50)}
  </text>
  <text x="140" y="${H - 130}" font-family="${FONT}" font-size="28" fill="${COLORS.accent}">${esc(learnerLine)}</text>
  ${footer("Personalized by SMART AI")}`;
  return renderSvg(body, outPath);
}

export async function renderContentSlide(
  slide: SlideContent,
  pageLabel: string,
  imageEmphasis: "low" | "medium" | "high",
  outPath: string
): Promise<string> {
  const hasImage = Boolean(slide.imagePath && fs.existsSync(slide.imagePath));
  const imageWidth = imageEmphasis === "high" ? 720 : 640;
  const textWidth = hasImage ? W - imageWidth - 260 : W - 320;

  const titleLines = wrapText(slide.title, 58, textWidth + 60, 2);
  const bulletFontSize = imageEmphasis === "high" ? 38 : 34;
  const bulletLineHeight = bulletFontSize + 16;

  let bulletsSvg = "";
  let cursorY = 260 + titleLines.length * 72;
  for (const point of slide.points) {
    const lines = wrapText(point, bulletFontSize, textWidth - 60, 3);
    bulletsSvg += `<circle cx="176" cy="${cursorY - bulletFontSize / 3}" r="8" fill="${COLORS.accent}"/>`;
    bulletsSvg += `<text font-family="${FONT}" font-size="${bulletFontSize}" fill="${COLORS.text}" opacity="0.92">${tspans(
      lines,
      210,
      cursorY,
      bulletLineHeight
    )}</text>`;
    cursorY += lines.length * bulletLineHeight + 26;
  }

  let imageSvg = "";
  if (hasImage) {
    const imageData = fs.readFileSync(slide.imagePath as string).toString("base64");
    const imgX = W - imageWidth - 100;
    imageSvg = `
    <g transform="translate(${imgX}, 210)">
      <rect x="-8" y="-8" width="${imageWidth + 16}" height="676" rx="32" fill="${COLORS.card}"/>
      <g clip-path="url(#imageClip)" transform="scale(${imageWidth / 640}, 1)">
        <image href="data:image/jpeg;base64,${imageData}" x="0" y="0" width="640" height="660" preserveAspectRatio="xMidYMid slice"/>
      </g>
    </g>`;
  }

  const body = `
  <rect x="140" y="196" width="90" height="10" rx="5" fill="url(#accentGrad)"/>
  <text font-family="${FONT}" font-size="58" font-weight="700" fill="${COLORS.text}">
    ${tspans(titleLines, 140, 150, 72)}
  </text>
  ${bulletsSvg}
  ${imageSvg}
  ${footer(pageLabel)}`;
  return renderSvg(body, outPath);
}

/* ── Study pages ───────────────────────────────────────────────────────────
 *
 * The PDF handout is built from these PNGs, so anything the .pptx gained has to
 * be drawn here too or the two downloads would disagree about what the lesson
 * contains. Same material, same order: notes, worked example, practice, quiz,
 * answers.
 *
 * Everything below is measured against a fixed 1920×1080 page with the footer
 * sitting at y≈1036, and wrapText truncates rather than overflowing, so a
 * long-winded model can never push text off the page.
 */

/** Page heading: small coloured kicker, big title, accent rule. Returns where the body may start. */
function pageHeader(kicker: string, title: string, color: string): { svg: string; bodyY: number } {
  const titleLines = wrapText(title, 50, 1620, 2);
  const ruleY = 190 + titleLines.length * 62;
  return {
    svg: `
  <text x="120" y="112" font-family="${FONT}" font-size="24" font-weight="700" fill="${color}" letter-spacing="3">${esc(
      kicker.toUpperCase()
    )}</text>
  <text font-family="${FONT}" font-size="50" font-weight="700" fill="${COLORS.text}">
    ${tspans(titleLines, 120, 190, 62)}
  </text>
  <rect x="120" y="${ruleY}" width="90" height="8" rx="4" fill="${color}"/>`,
    bodyY: ruleY + 60,
  };
}

function sectionLabel(text: string, x: number, y: number, color: string): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="22" font-weight="700" fill="${color}" letter-spacing="2">${esc(
    text.toUpperCase()
  )}</text>`;
}

/** Wrapped body text. Returns the y just below the last line so blocks can stack. */
function paragraph(
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  maxLines: number,
  color: string,
  weight = "400"
): { svg: string; y: number } {
  const lines = wrapText(text, fontSize, width, maxLines);
  const lineHeight = Math.round(fontSize * 1.42);
  return {
    svg: `<text font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${tspans(
      lines,
      x,
      y,
      lineHeight
    )}</text>`,
    y: y + lines.length * lineHeight,
  };
}

function bulletList(
  items: string[],
  x: number,
  y: number,
  width: number,
  fontSize: number,
  color: string
): { svg: string; y: number } {
  const lineHeight = Math.round(fontSize * 1.4);
  let svg = "";
  let cursor = y;
  for (const item of items) {
    const lines = wrapText(item, fontSize, width - 40, 2);
    svg += `<circle cx="${x + 7}" cy="${cursor - fontSize / 3}" r="6" fill="${COLORS.accent}"/>`;
    svg += `<text font-family="${FONT}" font-size="${fontSize}" fill="${color}">${tspans(
      lines,
      x + 34,
      cursor,
      lineHeight
    )}</text>`;
    cursor += lines.length * lineHeight + 14;
  }
  return { svg, y: cursor };
}

function card(x: number, y: number, width: number, height: number): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${COLORS.card}"/>`;
}

/** The page a student copies into a notebook. */
export async function renderNotesSlide(
  slideTitle: string,
  index: number,
  notes: SlideStudyNotes,
  pageLabel: string,
  outPath: string
): Promise<string> {
  const head = pageHeader(`Notes ${String(index + 1).padStart(2, "0")} · write this down`, slideTitle, COLORS.accent);

  // The "Remember" block sits at a FIXED y so a two-line page title can never
  // push it into the footer; the explanation above it simply gets fewer lines.
  const FACTS_LABEL_Y = 775;
  const explanationTop = head.bodyY + 46;
  const explanationLines = Math.max(4, Math.min(10, Math.floor((FACTS_LABEL_Y - 40 - explanationTop) / 34)));

  const explanation = paragraph(notes.explanation, 120, explanationTop, 960, 24, explanationLines, COLORS.text);
  let left = sectionLabel("The idea, written out", 120, head.bodyY, COLORS.muted) + explanation.svg;
  if (notes.keyFacts.length > 0) {
    left += sectionLabel("Remember", 120, FACTS_LABEL_Y, COLORS.accent);
    left += bulletList(notes.keyFacts.slice(0, 3), 120, FACTS_LABEL_Y + 45, 960, 21, COLORS.text).svg;
  }

  // Right column: definitions in a card, the usual mistake in a smaller one
  // below it. Both cards have fixed edges, and definitions stop being drawn
  // once they would spill past the card — a clipped word beats a stray line.
  let right = "";
  const mistakeCardTop = 840;
  const definitionsBottom = notes.commonMistake ? mistakeCardTop - 24 : 1010;
  if (notes.definitions.length > 0) {
    const cardTop = head.bodyY - 30;
    right += card(1140, cardTop, 660, definitionsBottom - cardTop);
    right += sectionLabel("Key terms", 1180, cardTop + 52, COLORS.accent);
    let cursor = cardTop + 100;
    for (const definition of notes.definitions.slice(0, 3)) {
      if (cursor + 70 > definitionsBottom) break;
      const term = paragraph(definition.term, 1180, cursor, 580, 23, 1, COLORS.accent, "700");
      const room = Math.max(1, Math.min(3, Math.floor((definitionsBottom - 24 - term.y) / 28)));
      const meaning = paragraph(definition.meaning, 1180, term.y + 8, 580, 20, room, COLORS.text);
      right += term.svg + meaning.svg;
      cursor = meaning.y + 26;
    }
  }
  if (notes.commonMistake) {
    right += card(1140, mistakeCardTop, 660, 186);
    right += sectionLabel("Careful here", 1180, mistakeCardTop + 46, COLORS.warn);
    right += paragraph(notes.commonMistake, 1180, mistakeCardTop + 84, 580, 20, 3, COLORS.text).svg;
  }

  return renderSvg(`${head.svg}${left}${right}${footer(pageLabel)}`, outPath);
}

/** The page that shows the method, then hands the pen over. */
export async function renderExampleSlide(
  slideTitle: string,
  index: number,
  notes: SlideStudyNotes,
  pageLabel: string,
  outPath: string
): Promise<string> {
  const head = pageHeader(
    `Example ${String(index + 1).padStart(2, "0")} · follow the working`,
    slideTitle,
    COLORS.secondary
  );

  let left = "";
  if (notes.example) {
    left += sectionLabel("Worked example", 120, head.bodyY, COLORS.secondary);
    left += card(110, head.bodyY + 22, 980, 116);
    left += paragraph(notes.example.problem, 140, head.bodyY + 78, 920, 25, 2, COLORS.text, "700").svg;

    let cursor = head.bodyY + 200;
    notes.example.steps.slice(0, 6).forEach((step, stepIndex) => {
      const lines = wrapText(`${stepIndex + 1}.  ${step}`, 23, 940, 2);
      left += `<text font-family="${FONT}" font-size="23" fill="${COLORS.text}">${tspans(
        lines,
        120,
        cursor,
        32
      )}</text>`;
      cursor += lines.length * 32 + 16;
    });
  }

  let right = "";
  if (notes.practice) {
    const cardTop = head.bodyY - 30;
    const question = paragraph(notes.practice.question, 1180, cardTop + 100, 580, 24, 7, COLORS.text);
    // The card hugs the question rather than using a fixed height — a two-line
    // problem under a 400px box reads as a rendering bug.
    right += card(1140, cardTop, 660, question.y + 34 - cardTop);
    right += sectionLabel("Now you try", 1180, cardTop + 52, COLORS.accent);
    right += question.svg;
    // The answer is in the key at the back on purpose — an answer printed under
    // the question is one the learner reads instead of solves.
    right += paragraph(
      "Work it out first — the answer is in the answer key at the back.",
      1180,
      question.y + 90,
      580,
      19,
      2,
      COLORS.faint
    ).svg;
  }

  return renderSvg(`${head.svg}${left}${right}${footer(pageLabel)}`, outPath);
}

/** Numbered question cards — the practice set. */
export async function renderPracticeSlide(
  kicker: string,
  heading: string,
  items: { number: number; question: string; caption: string }[],
  pageLabel: string,
  outPath: string
): Promise<string> {
  const head = pageHeader(kicker, heading, COLORS.accent);
  let body = "";
  items.forEach((item, itemIndex) => {
    const y = head.bodyY - 10 + itemIndex * 168;
    body += `<rect x="120" y="${y}" width="1680" height="148" rx="20" fill="${COLORS.card}"/>`;
    body += `<text x="160" y="${y + 60}" font-family="${FONT}" font-size="30" font-weight="700" fill="${COLORS.accent}">${item.number}</text>`;
    body += paragraph(item.question, 240, y + 54, 1500, 24, 2, COLORS.text).svg;
    body += `<text x="240" y="${y + 126}" font-family="${FONT}" font-size="17" font-style="italic" fill="${COLORS.faint}">${esc(
      item.caption
    )}</text>`;
  });
  return renderSvg(`${head.svg}${body}${footer(pageLabel)}`, outPath);
}

/** Quiz questions with their lettered options. */
export async function renderQuizSlide(
  kicker: string,
  questions: { number: number; question: string; options: string[] }[],
  pageLabel: string,
  outPath: string
): Promise<string> {
  const head = pageHeader(kicker, "Quick quiz", COLORS.accent);
  const letters = ["A", "B", "C", "D"];
  let body = "";
  questions.forEach((item, itemIndex) => {
    const y = head.bodyY + itemIndex * 330;
    const question = paragraph(`${item.number}.  ${item.question}`, 120, y, 1680, 26, 2, COLORS.text, "700");
    body += question.svg;
    let cursor = question.y + 34;
    item.options.forEach((option, optionIndex) => {
      const lines = wrapText(`${letters[optionIndex]})  ${option}`, 22, 1600, 1);
      body += `<text font-family="${FONT}" font-size="22" fill="${COLORS.muted}">${tspans(lines, 170, cursor, 30)}</text>`;
      cursor += 34;
    });
  });
  return renderSvg(`${head.svg}${body}${footer(pageLabel)}`, outPath);
}

/** Answer-key style page: a bold lead line with its explanation underneath. */
export async function renderAnswerSlide(
  kicker: string,
  heading: string,
  entries: { lead: string; body: string }[],
  pageLabel: string,
  outPath: string
): Promise<string> {
  const head = pageHeader(kicker, heading, COLORS.warn);
  let body = "";
  let cursor = head.bodyY + 10;

  // Unlike the practice/quiz pages, this page stacks a *variable* number of
  // entries with no per-item card to clip them — a long-winded model answer
  // hitting the old hardcoded caps (2 lead lines + 3 body lines) times up to
  // 4 entries per page can run past the footer at y=H-44. Budget the
  // vertical space per entry from what's actually available above the
  // footer and derive how many lines each block gets to keep from
  // overflowing — the same idea renderNotesSlide uses to size its
  // explanation block against FACTS_LABEL_Y.
  const FOOTER_MARGIN_Y = H - 44 - 30; // clearance above the footer bar/text
  const LEAD_LINE_H = 36; // fontSize 25 * 1.42 rounded, matches paragraph()'s lineHeight
  const DETAIL_LINE_H = 30; // fontSize 21 * 1.42 rounded
  const LEAD_GAP = 34; // gap paragraph() below leaves between the lead and the detail block
  const ENTRY_GAP = 40; // gap left after an entry's detail before the next entry starts
  const available = FOOTER_MARGIN_Y - cursor;
  const perEntry = available / Math.max(1, entries.length);
  const leadMaxLines = Math.max(
    1,
    Math.min(2, Math.floor((perEntry - LEAD_GAP - ENTRY_GAP - DETAIL_LINE_H) / LEAD_LINE_H))
  );
  const detailMaxLines = Math.max(
    1,
    Math.min(3, Math.floor((perEntry - leadMaxLines * LEAD_LINE_H - LEAD_GAP - ENTRY_GAP) / DETAIL_LINE_H))
  );

  for (const entry of entries) {
    const lead = paragraph(entry.lead, 120, cursor, 1680, 25, leadMaxLines, COLORS.text, "700");
    const detail = paragraph(entry.body, 120, lead.y + 34, 1680, 21, detailMaxLines, COLORS.muted);
    body += lead.svg + detail.svg;
    cursor = detail.y + 40;
  }
  return renderSvg(`${head.svg}${body}${footer(pageLabel)}`, outPath);
}

export async function renderEndSlide(
  title: string,
  summary: string,
  pageLabel: string,
  outPath: string
): Promise<string> {
  const summaryLines = wrapText(summary, 34, 1500, 9);
  const body = `
  ${decorativeBlobs(13)}
  <text x="140" y="220" font-family="${FONT}" font-size="64" font-weight="700" fill="${COLORS.text}">Key Takeaways</text>
  <rect x="140" y="256" width="120" height="12" rx="6" fill="url(#accentGrad)"/>
  <text font-family="${FONT}" font-size="34" fill="${COLORS.muted}">
    ${tspans(summaryLines, 140, 360, 54)}
  </text>
  <text x="140" y="${H - 150}" font-family="${FONT}" font-size="40" font-weight="600" fill="${COLORS.text}">${esc(
    `You just learned: ${title}`
  )}</text>
  ${footer(pageLabel)}`;
  return renderSvg(body, outPath);
}

export interface RenderedDeck {
  /** Every page of the handout, in order: cover, per-topic pages, practice, quiz, answers, closing. */
  allPaths: string[];
  coverPath: string;
  /**
   * ONLY the per-slide concept pages, index-aligned with `slides` — the caller
   * stamps these onto `slide.renderedImagePath`, so study pages must never
   * appear here even though they sit between them in `allPaths`.
   */
  contentPaths: string[];
  endPath: string;
}

export interface RenderDeckInput {
  presentationId: string;
  title: string;
  topic: string;
  summary: string;
  learnerLine: string;
  slides: SlideContent[];
  quiz: QuizQuestion[];
  imageEmphasis: "low" | "medium" | "high";
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Renders the full handout as 1920×1080 PNGs — the source for the PDF export.
 *
 * The page list is PLANNED before anything is drawn, because each page's footer
 * prints "Page n / total" and the total is not knowable until we have decided
 * how many notes, practice and answer pages the lesson earned.
 */
export async function renderDeck(input: RenderDeckInput): Promise<RenderedDeck> {
  const { presentationId, title, topic, summary, learnerLine, slides, quiz, imageEmphasis } = input;
  const dir = ensureDir(path.join(DIRS.slides, presentationId));

  /** A planned page: `slideIndex` marks the concept pages the caller needs back. */
  interface PageJob {
    slideIndex?: number;
    render: (pageLabel: string, outPath: string) => Promise<string>;
  }

  const jobs: PageJob[] = [
    { render: (label, out) => renderCoverSlide(title, topic, learnerLine, out).then(() => out) },
  ];

  slides.forEach((slide, index) => {
    jobs.push({
      slideIndex: index,
      render: (label, out) => renderContentSlide(slide, label, imageEmphasis, out),
    });
    const notes = slide.studyNotes;
    if (notes?.explanation) {
      jobs.push({ render: (label, out) => renderNotesSlide(slide.title, index, notes, label, out) });
    }
    if (notes?.example || notes?.practice) {
      jobs.push({ render: (label, out) => renderExampleSlide(slide.title, index, notes, label, out) });
    }
  });

  const practice = collectPractice(slides);
  const practicePages = chunk(practice, 4);
  practicePages.forEach((group, pageIndex) => {
    const items = group.map((item, itemIndex) => ({
      number: pageIndex * 4 + itemIndex + 1,
      question: item.question,
      caption: item.slideTitle,
    }));
    jobs.push({
      render: (label, out) =>
        renderPracticeSlide(
          practicePages.length > 1
            ? `Practice set · page ${pageIndex + 1} of ${practicePages.length}`
            : "Practice set",
          "Solve these on your own",
          items,
          label,
          out
        ),
    });
  });

  const quizPages = chunk(quiz, 2);
  quizPages.forEach((group, pageIndex) => {
    const questions = group.map((question, itemIndex) => ({
      number: pageIndex * 2 + itemIndex + 1,
      question: question.question,
      options: question.options,
    }));
    jobs.push({
      render: (label, out) =>
        renderQuizSlide(
          quizPages.length > 1
            ? `Check yourself · page ${pageIndex + 1} of ${quizPages.length}`
            : "Check yourself",
          questions,
          label,
          out
        ),
    });
  });

  practicePages.forEach((group, pageIndex) => {
    const entries = group.map((item, itemIndex) => ({
      lead: `${pageIndex * 4 + itemIndex + 1}.  ${item.question}`,
      body: item.answer,
    }));
    jobs.push({
      render: (label, out) =>
        renderAnswerSlide(
          practicePages.length > 1
            ? `Answer key · practice ${pageIndex + 1} of ${practicePages.length}`
            : "Answer key · practice",
          "Check your working",
          entries,
          label,
          out
        ),
    });
  });

  const letters = ["A", "B", "C", "D"];
  chunk(quiz, 3).forEach((group, pageIndex, pages) => {
    const entries = group.map((question, itemIndex) => ({
      lead: `${pageIndex * 3 + itemIndex + 1}.  ${letters[question.correctIndex] ?? "?"} — ${
        question.options[question.correctIndex] ?? ""
      }`,
      body: question.explanation,
    }));
    jobs.push({
      render: (label, out) =>
        renderAnswerSlide(
          pages.length > 1 ? `Answer key · quiz ${pageIndex + 1} of ${pages.length}` : "Answer key · quiz",
          "Quiz answers explained",
          entries,
          label,
          out
        ),
    });
  });

  const endJobIndex = jobs.length;
  jobs.push({ render: (label, out) => renderEndSlide(title, summary, label, out) });

  const total = jobs.length;
  const allPaths: string[] = [];
  const contentPaths: string[] = [];

  for (const [pageIndex, job] of jobs.entries()) {
    const outPath = path.join(dir, `slide-${String(pageIndex + 1).padStart(3, "0")}.png`);
    await job.render(`Page ${pageIndex + 1} / ${total}`, outPath);
    allPaths.push(outPath);
    if (job.slideIndex !== undefined) contentPaths[job.slideIndex] = outPath;
  }

  return { allPaths, coverPath: allPaths[0], contentPaths, endPath: allPaths[endJobIndex] };
}
