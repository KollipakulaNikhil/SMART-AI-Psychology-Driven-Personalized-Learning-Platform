import fs from "fs";
import path from "path";
import PptxGenJS from "pptxgenjs";
import { DIRS, ensureDir } from "../utils/paths";
import type { QuizQuestion, SlideContent, SlideStudyNotes } from "../models/Presentation";
import type { LearnerTraits } from "../models/LearningProfile";
import { collectPractice } from "./studyNotes.service";

const THEME = {
  background: "0F172A",
  card: "1E293B",
  primary: "6366F1",
  secondary: "8B5CF6",
  accent: "06B6D4",
  warn: "FBBF24",
  text: "F1F5F9",
  muted: "94A3B8",
  faint: "64748B",
};

const FONT = "Segoe UI";
const PAGE_W = 13.33;
const PAGE_H = 7.5;

/** Left column of a two-column study page. */
const LEFT = { x: 0.55, w: 6.95 };
/** Right column — narrower, carries the definitions and the warning. */
const RIGHT = { x: 7.75, w: 4.85, cardX: 7.62, cardW: 5.15 };

export interface PptBuildInput {
  presentationId: string;
  title: string;
  topic: string;
  summary: string;
  slides: SlideContent[];
  quiz: QuizQuestion[];
  traits: LearnerTraits;
  imageEmphasis: "low" | "medium" | "high";
}

function learnerLine(traits: LearnerTraits): string {
  return `Tailored for a ${traits.knowledgeLevel} · ${traits.learningStyle} learner · ${traits.pace} pace`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Truncates text that would overflow a fixed-size box — PowerPoint doesn't
 * wrap-and-shrink for us, it silently runs the text past the box (and often
 * past whatever is drawn next), which reads as a rendering bug. A hard cap
 * with an ellipsis, cut on a word boundary, beats that every time.
 */
function clip(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trimEnd()}…`;
}

/**
 * Builds the downloadable 16:9 deck.
 *
 * The deck is a STUDY HANDOUT, not a slideshow transcript. A concept page
 * (bullets + photo) is what a learner glances at while the lesson plays; on its
 * own it is three short lines and nothing to do. So each topic is followed by
 * the pages a teacher would actually leave behind — the idea written out in
 * full, the terms defined, the facts worth memorising, an example worked step
 * by step — and the deck closes with a practice set, the quiz, and a separate
 * answer key so the learner can test themselves before checking.
 *
 * Every extra page is conditional on the notes pass having produced content for
 * that slide, so a lesson with no notes still exports exactly as it did before.
 */
export async function buildPptx(input: PptBuildInput): Promise<string> {
  const { presentationId, title, topic, summary, slides, quiz, traits, imageEmphasis } = input;

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE_169", width: PAGE_W, height: PAGE_H });
  pptx.layout = "WIDE_169";
  pptx.author = "SMART AI";
  pptx.company = "SMART AI";
  pptx.title = title;
  pptx.subject = topic;

  pptx.defineSlideMaster({
    title: "SMART_CONTENT",
    background: { color: THEME.background },
    objects: [
      { rect: { x: 0, y: 0, w: PAGE_W, h: 0.07, fill: { color: THEME.primary } } },
      {
        text: {
          text: "SMART AI",
          options: { x: 0.45, y: PAGE_H - 0.42, w: 2.2, h: 0.3, fontSize: 10, bold: true, color: THEME.faint, fontFace: FONT },
        },
      },
    ],
    slideNumber: { x: PAGE_W - 1.1, y: PAGE_H - 0.42, w: 0.7, h: 0.3, fontSize: 10, color: THEME.faint, fontFace: FONT },
  });

  type Slide = ReturnType<typeof pptx.addSlide>;

  /** Page header shared by every study page: kicker, title, accent rule. */
  function addHeader(slide: Slide, kicker: string, heading: string, kickerColor = THEME.accent): void {
    slide.addText(kicker.toUpperCase(), {
      x: 0.55, y: 0.34, w: 11.0, h: 0.3,
      fontSize: 12, bold: true, color: kickerColor, fontFace: FONT, charSpacing: 2,
    });
    slide.addText(
      // Clipped to keep this 26pt bold heading to at most 2 lines — the box
      // is only 0.72in tall (~2 lines' worth) and the accent rule right below
      // it ends at y:1.51. The Notes/Example pages' RIGHT-column card starts
      // at y:1.55, just 0.04in below that rule, so a 3rd wrapped line here
      // would run straight into it. Bold Segoe UI at 26pt in an 11.93in box
      // averages ~60-65 chars/line, so 2 lines is ~120-130 chars, but bold
      // caps run wider than average — rounded well down to leave slack.
      clip(heading, 100),
      {
        x: 0.55, y: 0.66, w: PAGE_W - 1.4, h: 0.72,
        fontSize: 26, bold: true, color: THEME.text, fontFace: FONT, valign: "middle",
      }
    );
    slide.addShape("roundRect", { x: 0.58, y: 1.42, w: 0.85, h: 0.09, rectRadius: 0.045, fill: { color: kickerColor } });
  }

  /** Small uppercase label that names a block of matter. */
  function addLabel(slide: Slide, text: string, x: number, y: number, w: number, color = THEME.muted): void {
    slide.addText(text.toUpperCase(), {
      x, y, w, h: 0.28,
      fontSize: 11, bold: true, color, fontFace: FONT, charSpacing: 1.5,
    });
  }

  // ── Cover ────────────────────────────────────────────────────────────────
  const cover = pptx.addSlide();
  cover.background = { color: THEME.background };
  cover.addShape("rect", { x: 0, y: 0, w: PAGE_W, h: 0.07, fill: { color: THEME.primary } });
  cover.addShape("ellipse", { x: 10.6, y: -1.2, w: 4.4, h: 4.4, fill: { color: THEME.primary, transparency: 82 } });
  cover.addShape("ellipse", { x: -1.4, y: 5.2, w: 4.6, h: 4.6, fill: { color: THEME.secondary, transparency: 84 } });
  cover.addShape("roundRect", { x: 0.9, y: 1.75, w: 1.0, h: 0.14, rectRadius: 0.07, fill: { color: THEME.accent } });
  cover.addText(title, {
    x: 0.85, y: 2.0, w: 11.6, h: 2.2,
    fontSize: 44, bold: true, color: THEME.text, fontFace: FONT, align: "left", valign: "top",
  });
  cover.addText(`A personalized lesson on ${topic}`, {
    x: 0.9, y: 4.3, w: 11.0, h: 0.6, fontSize: 20, color: THEME.muted, fontFace: FONT,
  });
  cover.addText("Concept pages · written notes · worked examples · practice set with answers", {
    x: 0.9, y: 4.9, w: 11.0, h: 0.5, fontSize: 15, color: THEME.faint, fontFace: FONT,
  });
  cover.addText(learnerLine(traits), {
    x: 0.9, y: 6.4, w: 11.0, h: 0.5, fontSize: 14, color: THEME.accent, fontFace: FONT, italic: true,
  });

  // ── Per-topic pages ──────────────────────────────────────────────────────
  const bulletFontSize = traits.attentionSpan === "low" ? 20 : traits.attentionSpan === "medium" ? 18 : 16;
  const imageW = imageEmphasis === "high" ? 5.0 : imageEmphasis === "medium" ? 4.3 : 3.6;

  slides.forEach((slideContent, index) => {
    addConceptPage(slideContent, index);
    const notes = slideContent.studyNotes;
    if (notes?.explanation) addNotesPage(slideContent.title, index, notes);
    if (notes?.example || notes?.practice) addExamplePage(slideContent.title, index, notes);
  });

  /** The page the learner watches: headline bullets and a photograph. */
  function addConceptPage(slideContent: SlideContent, index: number): void {
    const slide = pptx.addSlide({ masterName: "SMART_CONTENT" });
    const hasImage = Boolean(slideContent.imagePath && fs.existsSync(slideContent.imagePath));
    const textW = hasImage ? PAGE_W - imageW - 1.6 : PAGE_W - 1.8;

    slide.addText(`${String(index + 1).padStart(2, "0")}`, {
      x: 0.55, y: 0.42, w: 0.9, h: 0.5, fontSize: 20, bold: true, color: THEME.secondary, fontFace: FONT,
    });
    slide.addText(slideContent.title, {
      x: 1.25, y: 0.38, w: PAGE_W - 2.0, h: 0.85, fontSize: 28, bold: true, color: THEME.text, fontFace: FONT, valign: "middle",
    });
    slide.addShape("roundRect", { x: 1.3, y: 1.28, w: 0.85, h: 0.09, rectRadius: 0.045, fill: { color: THEME.accent } });

    slide.addText(
      slideContent.points.map((point) => ({
        text: point,
        options: {
          bullet: { code: "25AA", indent: 18 },
          color: THEME.text,
          fontSize: bulletFontSize,
          paraSpaceAfter: traits.attentionSpan === "low" ? 16 : 10,
        },
      })),
      { x: 1.3, y: 1.7, w: textW, h: PAGE_H - 2.6, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.15 }
    );

    if (hasImage) {
      slide.addShape("roundRect", {
        x: PAGE_W - imageW - 0.62, y: 1.58, w: imageW + 0.24, h: 4.84, rectRadius: 0.12, fill: { color: THEME.card },
      });
      slide.addImage({
        path: slideContent.imagePath as string,
        x: PAGE_W - imageW - 0.5, y: 1.7, w: imageW, h: 4.6,
        sizing: { type: "cover", w: imageW, h: 4.6 },
      });
      if (slideContent.imageCredit) {
        slide.addText(slideContent.imageCredit, {
          x: PAGE_W - imageW - 0.5, y: 6.38, w: imageW, h: 0.3, fontSize: 8, color: THEME.faint, fontFace: FONT, align: "right",
        });
      }
    }
  }

  /** The page the learner copies into a notebook. */
  function addNotesPage(slideTitle: string, index: number, notes: SlideStudyNotes): void {
    const slide = pptx.addSlide({ masterName: "SMART_CONTENT" });
    addHeader(slide, `Notes ${String(index + 1).padStart(2, "0")} · write this down`, slideTitle);

    addLabel(slide, "The idea, written out", LEFT.x, 1.62, LEFT.w);
    slide.addText(
      // Capped so a max-length explanation can't spill into the "Remember"
      // label 0.13in below — measured against this box's actual width/font.
      clip(notes.explanation, 600),
      {
        x: LEFT.x, y: 1.95, w: LEFT.w, h: 2.4,
        fontSize: 13, color: THEME.text, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.25,
      }
    );

    if (notes.keyFacts.length > 0) {
      addLabel(slide, "Remember", LEFT.x, 4.48, LEFT.w, THEME.accent);
      slide.addText(
        // Capped to what the block can hold — PowerPoint silently overflows
        // rather than clipping, so a long list would run off the page. The
        // count alone isn't enough: three facts at the schema's own max
        // length still measure taller than this box, so each fact is also
        // clipped to what its share of the box can hold.
        notes.keyFacts.slice(0, 3).map((fact) => ({
          text: clip(fact, 130),
          options: {
            bullet: { code: "25AA", indent: 16 },
            color: THEME.text,
            fontSize: 13,
            paraSpaceAfter: 8,
          },
        })),
        { x: LEFT.x, y: 4.8, w: LEFT.w, h: 2.1, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.15 }
      );
    }

    if (notes.definitions.length > 0) {
      slide.addShape("roundRect", {
        x: RIGHT.cardX, y: 1.55, w: RIGHT.cardW, h: notes.commonMistake ? 3.6 : 5.3,
        rectRadius: 0.14, fill: { color: THEME.card },
      });
      addLabel(slide, "Key terms", RIGHT.x, 1.72, RIGHT.w, THEME.accent);
      slide.addText(
        // Term and meaning are two runs of one paragraph: only the meaning
        // breaks the line, so the pair never splits across the card. The
        // meaning is clipped so three max-length definitions can't push the
        // last one past the card's bottom edge.
        notes.definitions.slice(0, 3).flatMap((definition) => [
          { text: definition.term, options: { bold: true, color: THEME.accent, fontSize: 12 } },
          {
            text: ` — ${clip(definition.meaning, 120)}`,
            options: { color: THEME.text, fontSize: 12, breakLine: true, paraSpaceAfter: 12 },
          },
        ]),
        {
          x: RIGHT.x, y: 2.05, w: RIGHT.w, h: notes.commonMistake ? 2.95 : 4.65,
          fontFace: FONT, valign: "top", lineSpacingMultiple: 1.15,
        }
      );
    }

    if (notes.commonMistake) {
      slide.addShape("roundRect", {
        x: RIGHT.cardX, y: 5.32, w: RIGHT.cardW, h: 1.58, rectRadius: 0.14, fill: { color: THEME.card },
      });
      addLabel(slide, "Careful here", RIGHT.x, 5.48, RIGHT.w, THEME.warn);
      slide.addText(clip(notes.commonMistake, 180), {
        x: RIGHT.x, y: 5.8, w: RIGHT.w, h: 1.0,
        fontSize: 13, color: THEME.text, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.15,
      });
    }
  }

  /** The page that shows the method, then hands the pen over. */
  function addExamplePage(slideTitle: string, index: number, notes: SlideStudyNotes): void {
    const slide = pptx.addSlide({ masterName: "SMART_CONTENT" });
    addHeader(slide, `Example ${String(index + 1).padStart(2, "0")} · follow the working`, slideTitle, THEME.secondary);

    if (notes.example) {
      addLabel(slide, "Worked example", LEFT.x, 1.62, LEFT.w, THEME.secondary);
      slide.addShape("roundRect", {
        x: LEFT.x - 0.1, y: 1.92, w: LEFT.w + 0.2, h: 0.95, rectRadius: 0.12, fill: { color: THEME.card },
      });
      // Clipped to what the 0.95in card can hold — a max-length problem
      // statement would otherwise run past the card into the steps below it.
      slide.addText(clip(notes.example.problem, 130), {
        x: LEFT.x, y: 2.0, w: LEFT.w, h: 0.8,
        fontSize: 14, bold: true, color: THEME.text, fontFace: FONT, valign: "middle", lineSpacingMultiple: 1.1,
      });
      slide.addText(
        // Six max-length (200-char) steps measure to over 5in in this 3.7in
        // box — clipped to 150 so every step wraps to at most two lines,
        // which keeps all six on the page instead of dropping one.
        notes.example.steps.slice(0, 6).map((step, stepIndex) => ({
          text: `${stepIndex + 1}.  ${clip(step, 150)}`,
          options: { color: THEME.text, fontSize: 12, paraSpaceAfter: 10 },
        })),
        { x: LEFT.x, y: 3.05, w: LEFT.w, h: 3.7, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.2 }
      );
    }

    if (notes.practice) {
      slide.addShape("roundRect", {
        x: RIGHT.cardX, y: 1.55, w: RIGHT.cardW, h: 3.3, rectRadius: 0.14, fill: { color: THEME.card },
      });
      addLabel(slide, "Now you try", RIGHT.x, 1.74, RIGHT.w, THEME.accent);
      slide.addText(notes.practice.question, {
        x: RIGHT.x, y: 2.1, w: RIGHT.w, h: 2.6,
        fontSize: 14, color: THEME.text, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.2,
      });
      // The answer lives in the answer key at the back on purpose — an answer
      // sitting under the question is one the learner reads instead of solves.
      slide.addText("Work it out first — the answer is in the answer key at the back.", {
        x: RIGHT.x, y: 4.95, w: RIGHT.w, h: 0.6,
        fontSize: 11, italic: true, color: THEME.faint, fontFace: FONT, valign: "top",
      });
    }
  }

  // ── Practice set ─────────────────────────────────────────────────────────
  const practice = collectPractice(slides);
  chunk(practice, 4).forEach((group, pageIndex, pages) => {
    const slide = pptx.addSlide({ masterName: "SMART_CONTENT" });
    addHeader(
      slide,
      pages.length > 1 ? `Practice set · page ${pageIndex + 1} of ${pages.length}` : "Practice set",
      "Solve these on your own"
    );

    group.forEach((item, itemIndex) => {
      const number = pageIndex * 4 + itemIndex + 1;
      const y = 1.72 + itemIndex * 1.32;
      slide.addShape("roundRect", { x: 0.55, y, w: PAGE_W - 1.1, h: 1.14, rectRadius: 0.12, fill: { color: THEME.card } });
      slide.addText(`${number}`, {
        x: 0.72, y: y + 0.12, w: 0.5, h: 0.5, fontSize: 18, bold: true, color: THEME.accent, fontFace: FONT,
      });
      // Clipped — this card is shorter than the "Now you try" card the same
      // question renders in on the example page, so a max-length question
      // that fits there would still crowd the caption directly below here.
      slide.addText(clip(item.question, 190), {
        x: 1.3, y: y + 0.12, w: PAGE_W - 2.1, h: 0.62,
        fontSize: 14, color: THEME.text, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.1,
      });
      slide.addText(item.slideTitle, {
        x: 1.3, y: y + 0.76, w: PAGE_W - 2.1, h: 0.3, fontSize: 10, italic: true, color: THEME.faint, fontFace: FONT,
      });
    });
  });

  // ── Quiz ─────────────────────────────────────────────────────────────────
  const optionLabels = ["A", "B", "C", "D"];
  chunk(quiz, 2).forEach((group, pageIndex, pages) => {
    const slide = pptx.addSlide({ masterName: "SMART_CONTENT" });
    addHeader(
      slide,
      pages.length > 1 ? `Check yourself · page ${pageIndex + 1} of ${pages.length}` : "Check yourself",
      "Quick quiz"
    );

    group.forEach((question, itemIndex) => {
      const number = pageIndex * 2 + itemIndex + 1;
      const y = 1.72 + itemIndex * 2.62;
      // Clipped — the option list starts a fixed 0.68in below regardless of
      // how tall the question box actually renders, so a max-length (300
      // char) question would already be crowding the first option's line.
      slide.addText(`${number}.  ${clip(question.question, 190)}`, {
        x: 0.55, y, w: PAGE_W - 1.1, h: 0.7,
        fontSize: 15, bold: true, color: THEME.text, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.1,
      });
      // Clipped — all four options share this single 1.7in box, so at 13pt
      // with 1.1 line spacing plus 6pt after each paragraph, every option
      // only has room for a bit over one wrapped line before the fourth
      // option gets pushed past the box's bottom edge. A max-length
      // (160-char) option would need close to two lines, so it's capped
      // well below that.
      slide.addText(
        question.options.map((option, optionIndex) => ({
          text: `${optionLabels[optionIndex]})  ${clip(option, 130)}`,
          options: { color: THEME.muted, fontSize: 13, paraSpaceAfter: 6 },
        })),
        { x: 0.95, y: y + 0.68, w: PAGE_W - 1.9, h: 1.7, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.1 }
      );
    });
  });

  // ── Answer key ───────────────────────────────────────────────────────────
  if (practice.length > 0) {
    chunk(practice, 4).forEach((group, pageIndex, pages) => {
      const slide = pptx.addSlide({ masterName: "SMART_CONTENT" });
      addHeader(
        slide,
        pages.length > 1 ? `Answer key · practice ${pageIndex + 1} of ${pages.length}` : "Answer key · practice",
        "Check your working",
        THEME.warn
      );
      slide.addText(
        // Clipped — this 5.1in box is shared by up to 4 question+answer pairs,
        // so at 13pt with 1.15 line spacing (~15pt/line) plus the 16pt gap
        // after each answer, an entry only has room for ~5 lines before the
        // fourth pair is pushed past the box's bottom edge. Split
        // conservatively (question ~1.5 lines, answer ~1.6 lines) with slack
        // left over, since an unbounded question or answer would otherwise
        // overflow the box outright.
        group.flatMap((item, itemIndex) => [
          {
            text: `${pageIndex * 4 + itemIndex + 1}.  ${clip(item.question, 200)}`,
            options: { bold: true, color: THEME.text, fontSize: 13, breakLine: true },
          },
          {
            text: clip(item.answer, 220),
            options: { color: THEME.muted, fontSize: 13, breakLine: true, paraSpaceAfter: 16 },
          },
        ]),
        { x: 0.55, y: 1.72, w: PAGE_W - 1.1, h: 5.1, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.15 }
      );
    });
  }

  if (quiz.length > 0) {
    chunk(quiz, 3).forEach((group, pageIndex, pages) => {
      const slide = pptx.addSlide({ masterName: "SMART_CONTENT" });
      addHeader(
        slide,
        pages.length > 1 ? `Answer key · quiz ${pageIndex + 1} of ${pages.length}` : "Answer key · quiz",
        "Quiz answers explained",
        THEME.warn
      );
      slide.addText(
        // Clipped — this 5.1in box is shared by up to 3 answer+explanation
        // pairs, so at ~14pt/13pt with 1.15 line spacing (~15-16pt/line) plus
        // the 18pt gap after each explanation, an entry only has room for
        // ~6-7 lines before the third pair is pushed past the box's bottom
        // edge. The correct-option line is capped short (it's usually just
        // the option text) and the explanation gets the larger share, both
        // well under budget so a run of three long entries still fits.
        group.flatMap((question, itemIndex) => {
          const number = pageIndex * 3 + itemIndex + 1;
          const correct = clip(question.options[question.correctIndex] ?? "", 150);
          return [
            {
              text: `${number}.  ${optionLabels[question.correctIndex] ?? "?"} — ${correct}`,
              options: { bold: true, color: THEME.accent, fontSize: 14, breakLine: true },
            },
            {
              text: clip(question.explanation, 280),
              options: { color: THEME.muted, fontSize: 13, breakLine: true, paraSpaceAfter: 18 },
            },
          ];
        }),
        { x: 0.55, y: 1.72, w: PAGE_W - 1.1, h: 5.1, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.15 }
      );
    });
  }

  // ── Closing slide ────────────────────────────────────────────────────────
  const end = pptx.addSlide({ masterName: "SMART_CONTENT" });
  end.addText("Key Takeaways", {
    x: 0.9, y: 0.7, w: 11.5, h: 0.9, fontSize: 36, bold: true, color: THEME.text, fontFace: FONT,
  });
  end.addShape("roundRect", { x: 0.95, y: 1.62, w: 1.0, h: 0.1, rectRadius: 0.05, fill: { color: THEME.accent } });
  end.addText(summary, {
    x: 0.95, y: 2.0, w: 11.4, h: 3.6, fontSize: 16, color: THEME.muted, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.3,
  });
  end.addText(`You just learned: ${title}`, {
    x: 0.95, y: 5.9, w: 11.4, h: 0.6, fontSize: 20, bold: true, color: THEME.accent, fontFace: FONT,
  });

  const outPath = path.join(ensureDir(DIRS.ppt), `${presentationId}.pptx`);
  await pptx.writeFile({ fileName: outPath });
  return outPath;
}
