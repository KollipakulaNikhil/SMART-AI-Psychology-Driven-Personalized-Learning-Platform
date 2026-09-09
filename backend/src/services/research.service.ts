import { Types } from "mongoose";
import { LearningProfile, type LearnerTraits } from "../models/LearningProfile";
import { ResearchProject, type ResearchProjectDocument, type ResearchStatus } from "../models/ResearchProject";
import { logger } from "../utils/logger";
import { searchPapers } from "./scholar.service";
import { searchPatents } from "./patents.service";
import { captureSnapshots } from "./researchSnapshot.service";
import { ideateFromSources, planResearchQueries } from "./researchIdeation.service";

/**
 * Runs a Research Lab project end to end in the background (the create
 * endpoint returns immediately and the client polls). Each stage persists
 * its output before the next starts, so a crash mid-way still leaves the
 * learner with whatever was gathered, and the progress line stays honest.
 */

const PAPER_LIMIT = 8;
const PATENT_LIMIT = 6;

async function setStage(project: ResearchProjectDocument, status: ResearchStatus, message: string): Promise<void> {
  project.status = status;
  project.stageMessage = message;
  await project.save();
}

function fallbackTraits(): LearnerTraits {
  return {
    learningStyle: "reading",
    attentionSpan: "medium",
    pace: "moderate",
    knowledgeLevel: "intermediate",
    tone: "professional",
    depth: "balanced",
    visualPreference: "medium",
    examplePreference: "medium",
    motivation: "curiosity",
    memoryType: "association",
    confidence: "medium",
    revisionFrequency: "medium",
  };
}

export async function runResearchPipeline(projectId: Types.ObjectId): Promise<void> {
  const project = await ResearchProject.findById(projectId);
  if (!project) return;

  try {
    // ── 1. Plan the searches ──────────────────────────────────────────────
    await setStage(project, "searching", "Reading your idea and planning search queries…");
    const plan = await planResearchQueries(project.idea, project.title);
    project.title = plan.title;
    project.subject = plan.subject;
    project.keywords = plan.keywords;
    project.paperQueries = plan.paperQueries;
    project.patentQueries = plan.patentQueries;
    await setStage(project, "searching", "Searching arXiv, Semantic Scholar, OpenAlex and Google Patents…");

    // ── 2. Search papers + patents in parallel ────────────────────────────
    const [paperResult, patentResult] = await Promise.all([
      searchPapers(plan.paperQueries, PAPER_LIMIT),
      searchPatents(plan.patentQueries, PATENT_LIMIT),
    ]);

    project.papers = paperResult.papers.map((hit, index) => ({
      index,
      source: hit.source,
      externalId: hit.externalId,
      title: hit.title,
      authors: hit.authors,
      year: hit.year,
      venue: hit.venue,
      abstract: hit.abstract,
      url: hit.url,
      pdfUrl: hit.pdfUrl,
      doi: hit.doi,
      citationCount: hit.citationCount,
      snapshotStatus: "pending",
    }));
    project.patents = patentResult.patents.map((hit, index) => ({
      index,
      source: hit.source,
      patentNumber: hit.patentNumber,
      title: hit.title,
      assignee: hit.assignee,
      inventors: hit.inventors,
      filingDate: hit.filingDate,
      publicationDate: hit.publicationDate,
      abstract: hit.abstract,
      url: hit.url,
      pdfUrl: hit.pdfUrl,
      thumbnailUrl: hit.thumbnailUrl,
      snapshotStatus: "pending",
    }));
    project.sourcesSearched = [...paperResult.reports, ...patentResult.reports];

    const found = project.papers.length + project.patents.length;
    logger.info(`Research ${project.id}: found ${project.papers.length} papers, ${project.patents.length} patents`);

    // ── 3. First-page snapshots ───────────────────────────────────────────
    await setStage(
      project,
      "snapshotting",
      found > 0 ? `Found ${found} sources — capturing their first pages…` : "No sources answered — moving on to ideation…"
    );
    if (found > 0) {
      const { captured, attempted } = await captureSnapshots(project.id as string, project.papers, project.patents);
      logger.info(`Research ${project.id}: captured ${captured}/${attempted} snapshots`);
      // Sub-documents were mutated in place — tell mongoose.
      project.markModified("papers");
      project.markModified("patents");
    }

    // ── 4. Ideate from the prior art ──────────────────────────────────────
    await setStage(project, "ideating", "Reading the prior art and ideating in your learning style…");
    const profile = await LearningProfile.findOne({ userId: project.userId }).lean();
    const traits = profile?.traits ?? fallbackTraits();

    const { analysis, explanations } = await ideateFromSources(
      project.idea,
      project.title,
      traits,
      project.papers,
      project.patents
    );
    for (const paper of project.papers) {
      paper.explanation = explanations.get(`P${paper.index + 1}`);
    }
    for (const patent of project.patents) {
      patent.explanation = explanations.get(`T${patent.index + 1}`);
    }
    project.analysis = analysis;
    project.markModified("papers");
    project.markModified("patents");
    project.error = undefined;
    await setStage(project, "ready", found > 0 ? "Research brief ready" : "Brief ready (no external sources were found)");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Research pipeline failed for ${project.id}`, { error: message });
    project.status = "failed";
    project.stageMessage = "Something went wrong";
    project.error = message;
    await project.save().catch(() => undefined);
  }
}
