import { z } from "zod";
import type { LearnerTraits } from "../models/LearningProfile";
import type {
  ResearchAnalysis,
  ResearchPaper,
  ResearchPatent,
  SourceDeepDive,
  SourceExplanation,
} from "../models/ResearchProject";
import { generateStructured } from "./aiContent.service";

/**
 * The AI half of Research Lab:
 *   1. planResearchQueries  — turns a free-text idea into tight search queries
 *   2. ideateFromSources    — reads the prior art and ideates FROM it, explaining
 *                             each source for this learner
 *   3. explainSource        — an on-demand plain-language walkthrough of one source
 *
 * Every call goes through `generateStructured` (Gemini → Groq fallback, strict
 * zod validation, one repair round) — no provider is hard-wired.
 */

// ── 1. Query planning ───────────────────────────────────────────────────────

export const researchQueryPlanSchema = z.object({
  title: z.string().min(3).max(140),
  subject: z.string().min(2).max(60),
  keywords: z.array(z.string().min(2).max(60)).min(3).max(8),
  paperQueries: z.array(z.string().min(3).max(120)).min(2).max(3),
  patentQueries: z.array(z.string().min(3).max(120)).min(1).max(2),
});

export type ResearchQueryPlan = z.infer<typeof researchQueryPlanSchema>;

function buildQueryPlanPrompt(idea: string, title?: string): string {
  return `You are SMART AI's research librarian. A learner has shared a research idea. Turn it into search queries that will find the most relevant PRIOR WORK in scholarly indexes (arXiv, Semantic Scholar, OpenAlex) and in Google Patents.

## THE IDEA
${title ? `Working title: "${title}"\n` : ""}"${idea}"

## REQUIREMENTS — follow exactly
1. "paperQueries": 2-3 queries for academic search engines. Each is 3-7 words of precise technical vocabulary — the terms researchers in this field would actually put in a title or abstract. No filler words, no sentences, no quotes. The first query must be the single most on-target one; later ones cover adjacent framings or the nearest established sub-field.
2. "patentQueries": 1-2 queries for a patent search. Patents use applied, product-flavoured language ("system and method for…", device, apparatus, process) — phrase them the way an inventor would name the invention, 3-8 words, no quotes.
3. "keywords": 3-8 key concepts/terms of the idea (short phrases).
4. "title": a crisp working title for this research project (max 12 words).
5. "subject": the broad field (e.g. "Computer Science", "Biomedical Engineering", "Materials Science", "Economics").

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no commentary:
{
  "title": "<working title>",
  "subject": "<broad field>",
  "keywords": ["<term>", "..."],
  "paperQueries": ["<query 1>", "<query 2>"],
  "patentQueries": ["<query 1>"]
}`;
}

export async function planResearchQueries(idea: string, title?: string): Promise<ResearchQueryPlan> {
  return generateStructured(buildQueryPlanPrompt(idea, title), researchQueryPlanSchema, "research query plan");
}

// ── 2. Ideation from prior art ──────────────────────────────────────────────

const explanationSchema = z.object({
  ref: z.string().regex(/^[PT]\d{1,2}$/),
  whyItMatters: z.string().min(10).max(600),
  keyTakeaway: z.string().min(10).max(500),
  howItRelates: z.string().min(10).max(600),
});

const ideationSchema = z.object({
  overview: z.string().min(40).max(1_600),
  landscape: z
    .array(
      z.object({
        theme: z.string().min(3).max(120),
        summary: z.string().min(20).max(700),
        refs: z.array(z.string().regex(/^[PT]\d{1,2}$/)).max(10),
      })
    )
    .min(1)
    .max(6),
  sources: z.array(explanationSchema).max(20),
  gaps: z.array(z.string().min(10).max(400)).min(1).max(6),
  ideas: z
    .array(
      z.object({
        title: z.string().min(3).max(140),
        hypothesis: z.string().min(10).max(400),
        description: z.string().min(30).max(1_000),
        buildsOn: z.array(z.string().regex(/^[PT]\d{1,2}$/)).max(8),
        novelty: z.string().min(10).max(500),
        feasibility: z.enum(["low", "medium", "high"]),
        methodology: z.array(z.string().min(5).max(300)).min(2).max(6),
        firstSteps: z.array(z.string().min(5).max(300)).min(2).max(5),
      })
    )
    .min(3)
    .max(5),
  nextSteps: z.array(z.string().min(5).max(300)).min(2).max(6),
});

export type IdeationOutput = z.infer<typeof ideationSchema>;

function learnerGuidance(traits: LearnerTraits): string {
  const level =
    traits.knowledgeLevel === "beginner"
      ? "They are new to research: define every technical term the first time it appears, and explain each paper as you would to a bright newcomer — what problem, what they did, what they found — before any nuance."
      : traits.knowledgeLevel === "advanced"
        ? "They are an experienced researcher: be precise and technical, skip basics, and spend the words on methods, assumptions, limitations and what is genuinely open."
        : "They know the basics: use standard terminology but briefly gloss anything specialised, and go one level deeper than a textbook summary.";

  const tone =
    traits.tone === "friendly"
      ? "Warm, conversational and direct — like a mentor talking through their reading with you."
      : traits.tone === "academic"
        ? "Measured, precise and formal — the register of a well-written literature review."
        : "Clear, professional and confident — like a senior colleague's briefing note.";

  const examples =
    traits.examplePreference === "high"
      ? "Anchor abstract points in concrete examples and analogies wherever you can."
      : traits.examplePreference === "low"
        ? "Stay conceptual and compact; use an example only when it removes real ambiguity."
        : "Use an example or analogy where it clarifies a non-obvious point.";

  const motivation =
    traits.motivation === "career"
      ? "Frame the ideas around what could become a publishable result, a portfolio project or a product."
      : traits.motivation === "exam"
        ? "Frame the ideas so each one could become a well-scoped thesis/coursework project with a clear deliverable."
        : traits.motivation === "hobby"
          ? "Keep the ideas exciting and buildable by one curious person with modest resources."
          : "Let curiosity lead — favour ideas that answer an intriguing open question.";

  const depth =
    traits.depth === "deep"
      ? "Prefer fewer, deeper ideas over a scatter of shallow ones."
      : "Cover a broad spread of directions so the learner can choose.";

  const confidence =
    traits.confidence === "low"
      ? "\n- Confidence is low: be encouraging — make it clear that entering an established field with a fresh angle is normal and doable."
      : "";

  return `- ${level}
- Tone: ${tone}
- ${examples}
- ${motivation}
- ${depth}${confidence}`;
}

function describePaper(paper: ResearchPaper): string {
  const parts = [
    `[P${paper.index + 1}] "${paper.title}"`,
    paper.authors.length ? `by ${paper.authors.slice(0, 4).join(", ")}${paper.authors.length > 4 ? " et al." : ""}` : "",
    paper.year ? `(${paper.year}${paper.venue ? `, ${paper.venue}` : ""})` : paper.venue ? `(${paper.venue})` : "",
    typeof paper.citationCount === "number" ? `— ${paper.citationCount} citations` : "",
  ].filter(Boolean);
  const abstract = paper.abstract ? `\n    Abstract: ${paper.abstract.slice(0, 700)}` : "\n    Abstract: (not available — reason from the title)";
  return `${parts.join(" ")}${abstract}`;
}

function describePatent(patent: ResearchPatent): string {
  const meta = [
    `[T${patent.index + 1}] ${patent.patentNumber} — "${patent.title}"`,
    patent.assignee ? `assignee: ${patent.assignee}` : "",
    patent.publicationDate ? `published ${patent.publicationDate}` : patent.filingDate ? `filed ${patent.filingDate}` : "",
  ].filter(Boolean);
  const abstract = patent.abstract ? `\n    Abstract: ${patent.abstract.slice(0, 600)}` : "\n    Abstract: (not available — reason from the title)";
  return `${meta.join(", ")}${abstract}`;
}

function buildIdeationPrompt(
  idea: string,
  title: string,
  traits: LearnerTraits,
  papers: ResearchPaper[],
  patents: ResearchPatent[]
): string {
  const paperBlock = papers.length ? papers.map(describePaper).join("\n") : "(no papers were found)";
  const patentBlock = patents.length ? patents.map(describePatent).join("\n") : "(no patents were found)";
  const refs = [...papers.map((p) => `P${p.index + 1}`), ...patents.map((t) => `T${t.index + 1}`)];

  return `You are SMART AI's research mentor. A learner shared a research idea; SMART AI has gathered the prior art (papers and patents) below. Read it, explain it for THIS learner, and IDEATE FROM IT: find what has been done, what is missing, and propose concrete new directions that build on these exact sources.

## THE LEARNER
${learnerGuidance(traits)}

## THE LEARNER'S RESEARCH IDEA
Working title: "${title}"
"${idea}"

## PRIOR ART — PAPERS
${paperBlock}

## PRIOR ART — PATENTS
${patentBlock}

## REQUIREMENTS — follow exactly
1. Ground everything in the sources above. Refer to them ONLY by their bracket ids (${refs.length ? refs.join(", ") : "none available"}). Never invent a paper, patent, author, number or result that is not listed.
2. "overview": 3-5 sentences — the state of this research area as the sources show it, and where the learner's idea sits in it.
3. "landscape": 2-5 themes that group the sources (e.g. shared methods, competing approaches, application areas). Each names the refs it groups.
4. "sources": ONE entry for EVERY ref listed above (${refs.length} entries), each with: "whyItMatters" (what this work contributes to the field), "keyTakeaway" (the single most useful thing the learner should remember from it), "howItRelates" (specifically how it supports, competes with, or constrains the learner's idea). Write these as explanations for the learner, in their level and tone.
5. "gaps": 2-6 specific things the prior art does NOT do or leaves open — each phrased so it could become a research question.
6. "ideas": 3-5 research directions the learner could pursue. Each MUST build on named refs ("buildsOn"), state a testable "hypothesis", explain in "novelty" exactly what is new compared to the refs it builds on, give an honest "feasibility" for a learner at this level, a short "methodology" plan, and concrete "firstSteps" they can do this week.
7. "nextSteps": 2-6 practical actions for the learner right now (which source to read first and why, what to search next, who to talk to, what to prototype).
8. Every field must contain real, specific content — never a placeholder. If no sources were found at all, say so plainly in the overview and ideate from the idea itself, leaving "sources" and every "refs"/"buildsOn" empty.

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no commentary:
{
  "overview": "<3-5 sentences>",
  "landscape": [ { "theme": "<theme>", "summary": "<what these sources share / how they differ>", "refs": ["P1", "T1"] } ],
  "sources": [ { "ref": "P1", "whyItMatters": "<…>", "keyTakeaway": "<…>", "howItRelates": "<…>" } ],
  "gaps": ["<gap phrased as a question or missing capability>"],
  "ideas": [
    {
      "title": "<idea title>",
      "hypothesis": "<testable claim>",
      "description": "<what the learner would actually build / study>",
      "buildsOn": ["P2", "T1"],
      "novelty": "<what is new vs. the refs above>",
      "feasibility": "low | medium | high",
      "methodology": ["<step>", "<step>"],
      "firstSteps": ["<this-week action>", "<this-week action>"]
    }
  ],
  "nextSteps": ["<action>", "<action>"]
}`;
}

export interface IdeationResult {
  analysis: ResearchAnalysis;
  explanations: Map<string, SourceExplanation>;
}

/**
 * Reads the prior art and returns the analysis plus a ref → explanation map
 * the pipeline stitches back onto each paper/patent.
 */
export async function ideateFromSources(
  idea: string,
  title: string,
  traits: LearnerTraits,
  papers: ResearchPaper[],
  patents: ResearchPatent[]
): Promise<IdeationResult> {
  const output = await generateStructured(
    buildIdeationPrompt(idea, title, traits, papers, patents),
    ideationSchema,
    "research analysis",
    { requireStrongModel: true }
  );

  const validRefs = new Set([...papers.map((p) => `P${p.index + 1}`), ...patents.map((t) => `T${t.index + 1}`)]);
  const keepValid = (refs: string[]) => refs.filter((ref) => validRefs.has(ref));

  const explanations = new Map<string, SourceExplanation>();
  for (const entry of output.sources) {
    if (!validRefs.has(entry.ref)) continue;
    explanations.set(entry.ref, {
      whyItMatters: entry.whyItMatters,
      keyTakeaway: entry.keyTakeaway,
      howItRelates: entry.howItRelates,
    });
  }

  const analysis: ResearchAnalysis = {
    overview: output.overview,
    landscape: output.landscape.map((theme) => ({ ...theme, refs: keepValid(theme.refs) })),
    gaps: output.gaps,
    ideas: output.ideas.map((entry) => ({ ...entry, buildsOn: keepValid(entry.buildsOn) })),
    nextSteps: output.nextSteps,
  };

  return { analysis, explanations };
}

// ── 3. On-demand deep dive ──────────────────────────────────────────────────

const deepDiveSchema = z.object({
  plainSummary: z.string().min(40).max(1_200),
  problem: z.string().min(20).max(900),
  approach: z.string().min(20).max(1_200),
  findings: z.string().min(20).max(1_000),
  limitations: z.string().min(20).max(900),
  howToUse: z.string().min(20).max(1_000),
  glossary: z.array(z.object({ term: z.string().min(1).max(60), meaning: z.string().min(5).max(240) })).max(8),
});

function buildDeepDivePrompt(
  idea: string,
  traits: LearnerTraits,
  source: { kind: "paper"; item: ResearchPaper } | { kind: "patent"; item: ResearchPatent }
): string {
  const description = source.kind === "paper" ? describePaper(source.item) : describePatent(source.item);
  const noun = source.kind === "paper" ? "paper" : "patent";
  const patentNote =
    source.kind === "patent"
      ? `\nThis is a PATENT, not a paper: "findings" should describe what the claims protect (the core protected mechanism) and "limitations" what the claims do NOT cover — that boundary is where the learner's freedom to operate lies.`
      : "";

  return `You are SMART AI's research mentor. Explain ONE ${noun} to a learner, in plain language, in relation to their own research idea. You have the ${noun}'s metadata and abstract; be honest about anything the abstract doesn't say (say "the abstract doesn't specify" rather than guessing numbers or details).

## THE LEARNER
${learnerGuidance(traits)}

## THE LEARNER'S RESEARCH IDEA
"${idea}"

## THE ${noun.toUpperCase()}
${description}${patentNote}

## REQUIREMENTS — follow exactly
1. "plainSummary": the whole ${noun} in 3-5 plain sentences a smart friend outside the field would follow.
2. "problem": what problem it tackles and why that problem matters.
3. "approach": how it works — the method, mechanism or design, step by step where possible.
4. "findings": what it shows, achieves or claims.
5. "limitations": what it does not do, assumes, or leaves open.
6. "howToUse": concretely how the learner can use this ${noun} in THEIR research idea — what to borrow, what to compare against, what to cite it for, what to avoid duplicating.
7. "glossary": up to 8 technical terms from the ${noun} with one-line meanings (empty array if none are needed for this learner).
8. Never invent results, numbers, authors or claims that the metadata/abstract do not contain.

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no commentary:
{
  "plainSummary": "<…>",
  "problem": "<…>",
  "approach": "<…>",
  "findings": "<…>",
  "limitations": "<…>",
  "howToUse": "<…>",
  "glossary": [ { "term": "<term>", "meaning": "<one line>" } ]
}`;
}

export async function explainSource(
  idea: string,
  traits: LearnerTraits,
  source: { kind: "paper"; item: ResearchPaper } | { kind: "patent"; item: ResearchPatent }
): Promise<SourceDeepDive> {
  return generateStructured(buildDeepDivePrompt(idea, traits, source), deepDiveSchema, "source explanation");
}
