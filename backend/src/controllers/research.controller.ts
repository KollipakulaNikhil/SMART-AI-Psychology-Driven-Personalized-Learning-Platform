import { z } from "zod";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { toPublicUrl } from "../utils/paths";
import { ResearchProject, type ResearchProjectDocument } from "../models/ResearchProject";
import { LearningProfile } from "../models/LearningProfile";
import { runResearchPipeline } from "../services/research.service";
import { explainSource } from "../services/researchIdeation.service";
import { removeSnapshots } from "../services/researchSnapshot.service";
import { googlePatentsSearchUrl } from "../services/patents.service";
import { logHistory } from "../services/history.service";

export const createResearchSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(20, "Describe your research idea in at least 20 characters")
    .max(2_000, "Keep the idea under 2000 characters"),
  title: z.string().trim().max(140).optional(),
});

export const researchIdParam = z.object({
  id: z.string().refine(Types.ObjectId.isValid, "Invalid research project id"),
});

export const explainSourceSchema = z.object({
  kind: z.enum(["paper", "patent"]),
  index: z.number().int().min(0).max(50),
});

const ACTIVE_STATUSES = new Set(["queued", "searching", "snapshotting", "ideating"]);

function scholarSearchUrl(query: string): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
}

function serializeProject(project: ResearchProjectDocument) {
  const primaryPaperQuery = project.paperQueries[0] ?? project.title;
  const primaryPatentQuery = project.patentQueries[0] ?? project.title;
  return {
    id: project.id as string,
    title: project.title,
    idea: project.idea,
    subject: project.subject,
    keywords: project.keywords,
    paperQueries: project.paperQueries,
    patentQueries: project.patentQueries,
    status: project.status,
    stageMessage: project.stageMessage,
    error: project.error ?? null,
    papers: project.papers.map((paper) => ({
      index: paper.index,
      ref: `P${paper.index + 1}`,
      source: paper.source,
      externalId: paper.externalId,
      title: paper.title,
      authors: paper.authors,
      year: paper.year ?? null,
      venue: paper.venue ?? null,
      abstract: paper.abstract ?? null,
      url: paper.url,
      pdfUrl: paper.pdfUrl ?? null,
      doi: paper.doi ?? null,
      citationCount: paper.citationCount ?? null,
      snapshotUrl: toPublicUrl(paper.snapshotPath),
      snapshotStatus: paper.snapshotStatus,
      explanation: paper.explanation ?? null,
      deepDive: paper.deepDive ?? null,
    })),
    patents: project.patents.map((patent) => ({
      index: patent.index,
      ref: `T${patent.index + 1}`,
      source: patent.source,
      patentNumber: patent.patentNumber,
      title: patent.title,
      assignee: patent.assignee ?? null,
      inventors: patent.inventors,
      filingDate: patent.filingDate ?? null,
      publicationDate: patent.publicationDate ?? null,
      abstract: patent.abstract ?? null,
      url: patent.url,
      pdfUrl: patent.pdfUrl ?? null,
      snapshotUrl: toPublicUrl(patent.snapshotPath),
      snapshotStatus: patent.snapshotStatus,
      explanation: patent.explanation ?? null,
      deepDive: patent.deepDive ?? null,
    })),
    analysis: project.analysis ?? null,
    sourcesSearched: project.sourcesSearched,
    // "Go further" links so the learner always has a path to the primary sources.
    links: {
      googleScholar: scholarSearchUrl(primaryPaperQuery),
      googlePatents: googlePatentsSearchUrl(primaryPatentQuery),
      arxiv: `https://arxiv.org/search/?query=${encodeURIComponent(primaryPaperQuery)}&searchtype=all`,
    },
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function serializeProjectSummary(project: ResearchProjectDocument) {
  return {
    id: project.id as string,
    title: project.title,
    idea: project.idea,
    subject: project.subject,
    keywords: project.keywords,
    status: project.status,
    stageMessage: project.stageMessage,
    paperCount: project.papers.length,
    patentCount: project.patents.length,
    ideaCount: project.analysis?.ideas.length ?? 0,
    createdAt: project.createdAt,
  };
}

async function loadOwnedProject(id: string, userId: Types.ObjectId): Promise<ResearchProjectDocument> {
  const project = await ResearchProject.findById(id);
  if (!project) throw ApiError.notFound("Research project not found");
  if (!project.userId.equals(userId)) throw ApiError.forbidden();
  return project;
}

/**
 * Shares a research idea with SMART AI. Returns 202 immediately with the
 * queued project; the prior-art search, snapshots and ideation run in the
 * background and the client polls GET /research/:id until `status` settles.
 */
export const createResearch = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { idea, title } = req.body as z.infer<typeof createResearchSchema>;

  const profile = await LearningProfile.findOne({ userId: user._id }).lean();
  if (!profile) {
    throw ApiError.unprocessable("Complete the learning psychology questionnaire before starting research");
  }

  const activeCount = await ResearchProject.countDocuments({
    userId: user._id,
    status: { $in: [...ACTIVE_STATUSES] },
  });
  if (activeCount >= 2) {
    throw ApiError.conflict("Two research briefs are already in progress — let one finish first.");
  }

  // Placeholder title until the AI's query planner names the project.
  const placeholderTitle = idea.length > 80 ? `${idea.slice(0, 80).replace(/\s+\S*$/, "")}…` : idea;

  const project = await ResearchProject.create({
    userId: user._id,
    title: title || placeholderTitle,
    idea,
    status: "queued",
    stageMessage: "Queued — starting shortly",
  });

  logHistory(user._id, "content_generated", {
    topic: project.title,
    meta: { kind: "research_started", researchId: project.id },
  });

  // Fire-and-forget; the pipeline records its own failures on the document.
  void runResearchPipeline(project._id);

  res.status(202).json({ success: true, data: serializeProject(project) });
});

export const listResearch = asyncHandler(async (req, res) => {
  const projects = await ResearchProject.find({ userId: req.user!._id }).sort({ createdAt: -1 }).limit(40);
  res.json({ success: true, data: projects.map(serializeProjectSummary) });
});

export const getResearch = asyncHandler(async (req, res) => {
  const project = await loadOwnedProject(req.params.id, req.user!._id);
  res.json({ success: true, data: serializeProject(project) });
});

export const deleteResearch = asyncHandler(async (req, res) => {
  const project = await loadOwnedProject(req.params.id, req.user!._id);
  if (ACTIVE_STATUSES.has(project.status)) {
    throw ApiError.conflict("This brief is still being prepared — wait for it to finish before deleting it.");
  }
  await project.deleteOne();
  await removeSnapshots(project.id as string);
  res.json({ success: true, data: { deleted: true } });
});

/**
 * "Explain this paper/patent to me": a deeper, plain-language walkthrough of
 * one source in the learner's style. Cached on the project after first use.
 */
export const explainResearchSource = asyncHandler(async (req, res) => {
  const user = req.user!;
  const { kind, index } = req.body as z.infer<typeof explainSourceSchema>;
  const project = await loadOwnedProject(req.params.id, user._id);

  const item = kind === "paper" ? project.papers[index] : project.patents[index];
  if (!item) throw ApiError.notFound(`No ${kind} at position ${index + 1}`);

  if (!item.deepDive) {
    const profile = await LearningProfile.findOne({ userId: user._id }).lean();
    if (!profile) throw ApiError.unprocessable("Complete the learning psychology questionnaire first");

    const source =
      kind === "paper"
        ? ({ kind: "paper", item: project.papers[index] } as const)
        : ({ kind: "patent", item: project.patents[index] } as const);
    item.deepDive = await explainSource(project.idea, profile.traits, source);
    project.markModified(kind === "paper" ? "papers" : "patents");
    await project.save();
  }

  res.json({ success: true, data: { kind, index, deepDive: item.deepDive } });
});
