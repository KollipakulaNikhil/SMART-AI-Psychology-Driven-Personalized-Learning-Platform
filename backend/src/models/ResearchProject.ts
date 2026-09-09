import { Schema, model, Document, Types } from "mongoose";

/**
 * Research Lab: a learner shares a research idea, SMART AI gathers the prior
 * art (papers + patents), captures each source's first page, and ideates
 * from it in the learner's psychological style.
 *
 * Pipeline stages, in order — the frontend polls `status` to show progress:
 *   queued → searching → snapshotting → ideating → ready | failed
 */
export type ResearchStatus = "queued" | "searching" | "snapshotting" | "ideating" | "ready" | "failed";

export type SnapshotStatus = "pending" | "ready" | "unavailable";

export type PaperSource = "arxiv" | "semanticscholar" | "openalex";
export type PatentSource = "google_patents" | "patentsview";

/** The AI's per-source explanation, written for THIS learner and THIS idea. */
export interface SourceExplanation {
  whyItMatters: string;
  keyTakeaway: string;
  howItRelates: string;
}

/**
 * On-demand deep dive (POST /research/:id/explain) — a plain-language
 * walkthrough of one source, cached on the project after the first request.
 */
export interface SourceDeepDive {
  plainSummary: string;
  problem: string;
  approach: string;
  findings: string;
  limitations: string;
  howToUse: string;
  glossary: { term: string; meaning: string }[];
}

export interface ResearchPaper {
  index: number;
  source: PaperSource;
  externalId: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  /** Landing page (arXiv abs, Semantic Scholar, publisher). */
  url: string;
  /** Open-access PDF when one is known — also what the first-page snapshot renders. */
  pdfUrl?: string;
  doi?: string;
  citationCount?: number;
  /** Absolute path of the first-page PNG under generated/research. */
  snapshotPath?: string;
  snapshotStatus: SnapshotStatus;
  explanation?: SourceExplanation;
  deepDive?: SourceDeepDive;
}

export interface ResearchPatent {
  index: number;
  source: PatentSource;
  patentNumber: string;
  title: string;
  assignee?: string;
  inventors: string[];
  filingDate?: string;
  publicationDate?: string;
  abstract?: string;
  /** Google Patents landing page. */
  url: string;
  pdfUrl?: string;
  /** First-page drawing/thumbnail when the source exposes one. */
  thumbnailUrl?: string;
  snapshotPath?: string;
  snapshotStatus: SnapshotStatus;
  explanation?: SourceExplanation;
  deepDive?: SourceDeepDive;
}

export interface ResearchIdea {
  title: string;
  hypothesis: string;
  description: string;
  /** Source refs this idea builds on — "P3" = paper index 2, "T1" = patent index 0. */
  buildsOn: string[];
  novelty: string;
  feasibility: "low" | "medium" | "high";
  methodology: string[];
  firstSteps: string[];
}

export interface ResearchAnalysis {
  overview: string;
  landscape: { theme: string; summary: string; refs: string[] }[];
  gaps: string[];
  ideas: ResearchIdea[];
  nextSteps: string[];
}

export interface ResearchProjectDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  title: string;
  /** The research idea exactly as the learner shared it. */
  idea: string;
  subject: string;
  keywords: string[];
  paperQueries: string[];
  patentQueries: string[];
  status: ResearchStatus;
  /** Human-readable progress line for the current stage. */
  stageMessage: string;
  error?: string;
  papers: ResearchPaper[];
  patents: ResearchPatent[];
  analysis?: ResearchAnalysis;
  /** Which source APIs answered — so the UI can say what was (not) searched. */
  sourcesSearched: { name: string; ok: boolean; count: number; note?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const explanationSchema = new Schema<SourceExplanation>(
  {
    whyItMatters: { type: String, default: "" },
    keyTakeaway: { type: String, default: "" },
    howItRelates: { type: String, default: "" },
  },
  { _id: false }
);

const deepDiveSchema = new Schema<SourceDeepDive>(
  {
    plainSummary: { type: String, default: "" },
    problem: { type: String, default: "" },
    approach: { type: String, default: "" },
    findings: { type: String, default: "" },
    limitations: { type: String, default: "" },
    howToUse: { type: String, default: "" },
    glossary: {
      type: [new Schema({ term: String, meaning: String }, { _id: false })],
      default: [],
    },
  },
  { _id: false }
);

const paperSchema = new Schema<ResearchPaper>(
  {
    index: { type: Number, required: true },
    source: { type: String, enum: ["arxiv", "semanticscholar", "openalex"], required: true },
    externalId: { type: String, required: true },
    title: { type: String, required: true },
    authors: { type: [String], default: [] },
    year: { type: Number },
    venue: { type: String },
    abstract: { type: String },
    url: { type: String, required: true },
    pdfUrl: { type: String },
    doi: { type: String },
    citationCount: { type: Number },
    snapshotPath: { type: String },
    snapshotStatus: { type: String, enum: ["pending", "ready", "unavailable"], default: "pending" },
    explanation: { type: explanationSchema },
    deepDive: { type: deepDiveSchema },
  },
  { _id: false }
);

const patentSchema = new Schema<ResearchPatent>(
  {
    index: { type: Number, required: true },
    source: { type: String, enum: ["google_patents", "patentsview"], required: true },
    patentNumber: { type: String, required: true },
    title: { type: String, required: true },
    assignee: { type: String },
    inventors: { type: [String], default: [] },
    filingDate: { type: String },
    publicationDate: { type: String },
    abstract: { type: String },
    url: { type: String, required: true },
    pdfUrl: { type: String },
    thumbnailUrl: { type: String },
    snapshotPath: { type: String },
    snapshotStatus: { type: String, enum: ["pending", "ready", "unavailable"], default: "pending" },
    explanation: { type: explanationSchema },
    deepDive: { type: deepDiveSchema },
  },
  { _id: false }
);

const ideaSchema = new Schema<ResearchIdea>(
  {
    title: { type: String, required: true },
    hypothesis: { type: String, default: "" },
    description: { type: String, default: "" },
    buildsOn: { type: [String], default: [] },
    novelty: { type: String, default: "" },
    feasibility: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    methodology: { type: [String], default: [] },
    firstSteps: { type: [String], default: [] },
  },
  { _id: false }
);

const analysisSchema = new Schema<ResearchAnalysis>(
  {
    overview: { type: String, default: "" },
    landscape: {
      type: [new Schema({ theme: String, summary: String, refs: [String] }, { _id: false })],
      default: [],
    },
    gaps: { type: [String], default: [] },
    ideas: { type: [ideaSchema], default: [] },
    nextSteps: { type: [String], default: [] },
  },
  { _id: false }
);

const researchProjectSchema = new Schema<ResearchProjectDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    idea: { type: String, required: true, trim: true },
    subject: { type: String, default: "General" },
    keywords: { type: [String], default: [] },
    paperQueries: { type: [String], default: [] },
    patentQueries: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["queued", "searching", "snapshotting", "ideating", "ready", "failed"],
      default: "queued",
    },
    stageMessage: { type: String, default: "Queued" },
    error: { type: String },
    papers: { type: [paperSchema], default: [] },
    patents: { type: [patentSchema], default: [] },
    analysis: { type: analysisSchema },
    sourcesSearched: {
      type: [new Schema({ name: String, ok: Boolean, count: Number, note: String }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true }
);

researchProjectSchema.index({ userId: 1, createdAt: -1 });

export const ResearchProject = model<ResearchProjectDocument>("ResearchProject", researchProjectSchema);
