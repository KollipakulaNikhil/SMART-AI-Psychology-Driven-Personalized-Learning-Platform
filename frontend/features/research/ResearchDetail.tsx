"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Compass,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCw,
  ScrollText,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isResearchActive, useCreateResearch, useExplainSource, useResearchProject } from "@/hooks/useResearch";
import { toErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";
import type { ResearchIdeaView, ResearchPaperView, ResearchPatentView, ResearchProjectView, ResearchStatus } from "@/lib/types";
import { SourceCard, type SourceCardData } from "./SourceCard";
import { statusBadge } from "./ResearchView";

// ── Progress ────────────────────────────────────────────────────────────────

const STAGES: { key: ResearchStatus; label: string; detail: string }[] = [
  { key: "searching", label: "Searching prior work", detail: "arXiv · Semantic Scholar · OpenAlex · Google Patents" },
  { key: "snapshotting", label: "Capturing first pages", detail: "Rendering each paper and patent so you can see it" },
  { key: "ideating", label: "Ideating from the sources", detail: "Explaining every source and proposing new directions" },
  { key: "ready", label: "Brief ready", detail: "Papers, patents, gaps and ideas" },
];

const STAGE_ORDER: ResearchStatus[] = ["queued", "searching", "snapshotting", "ideating", "ready"];

function ProgressTracker({ project }: { project: ResearchProjectView }) {
  const position = STAGE_ORDER.indexOf(project.status);
  return (
    <Card className="border-primary/30">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          {project.stageMessage}
        </div>
        <ol className="grid gap-3 sm:grid-cols-4">
          {STAGES.map((stage) => {
            const stagePosition = STAGE_ORDER.indexOf(stage.key);
            const done = position > stagePosition;
            const current = position === stagePosition;
            return (
              <li key={stage.key} className="flex gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : current
                        ? "bg-brand-gradient text-white"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : stagePosition}
                </span>
                <div>
                  <p className={cn("text-sm font-medium", !done && !current && "text-muted-foreground")}>{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {(project.papers.length > 0 || project.patents.length > 0) && (
          <p className="mt-4 text-xs text-muted-foreground">
            Found {project.papers.length} papers and {project.patents.length} patents so far — they appear below as
            they are captured.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function paperByline(paper: ResearchPaperView): string {
  const authors =
    paper.authors.length === 0
      ? "Unknown authors"
      : paper.authors.length <= 3
        ? paper.authors.join(", ")
        : `${paper.authors.slice(0, 3).join(", ")} et al.`;
  return [authors, paper.year, paper.venue].filter(Boolean).join(" · ");
}

const PAPER_SOURCE_LABEL: Record<ResearchPaperView["source"], string> = {
  arxiv: "arXiv",
  semanticscholar: "Semantic Scholar",
  openalex: "OpenAlex",
};

/** A snapshot still "pending" after the pipeline stopped is never coming — say so instead of spinning. */
function settleSnapshot(status: SourceCardData["snapshotStatus"], active: boolean): SourceCardData["snapshotStatus"] {
  return status === "pending" && !active ? "unavailable" : status;
}

function toPaperCard(paper: ResearchPaperView, active: boolean): SourceCardData {
  const chips = [PAPER_SOURCE_LABEL[paper.source]];
  if (typeof paper.citationCount === "number") chips.push(`${paper.citationCount.toLocaleString()} citations`);
  if (paper.doi) chips.push(`DOI ${paper.doi}`);
  return {
    kind: "paper",
    index: paper.index,
    ref: paper.ref,
    title: paper.title,
    byline: paperByline(paper),
    chips,
    abstract: paper.abstract,
    url: paper.url,
    pdfUrl: paper.pdfUrl,
    snapshotUrl: paper.snapshotUrl,
    snapshotStatus: settleSnapshot(paper.snapshotStatus, active),
    explanation: paper.explanation,
    deepDive: paper.deepDive,
  };
}

function toPatentCard(patent: ResearchPatentView, active: boolean): SourceCardData {
  const byline = [
    patent.assignee ?? (patent.inventors.length ? patent.inventors.slice(0, 2).join(", ") : null),
    patent.publicationDate ? `published ${patent.publicationDate}` : patent.filingDate ? `filed ${patent.filingDate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    kind: "patent",
    index: patent.index,
    ref: patent.ref,
    title: patent.title,
    byline: byline || "Patent",
    chips: [patent.patentNumber, patent.source === "google_patents" ? "Google Patents" : "USPTO"],
    abstract: patent.abstract,
    url: patent.url,
    pdfUrl: patent.pdfUrl,
    snapshotUrl: patent.snapshotUrl,
    snapshotStatus: settleSnapshot(patent.snapshotStatus, active),
    explanation: patent.explanation,
    deepDive: patent.deepDive,
  };
}

function scrollToRef(ref: string) {
  document.getElementById(`source-${ref}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function RefChips({ refs, className }: { refs: string[]; className?: string }) {
  if (refs.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {refs.map((ref) => (
        <button
          key={ref}
          type="button"
          onClick={() => scrollToRef(ref)}
          title={`Jump to ${ref}`}
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-bold transition-colors",
            ref.startsWith("P") ? "bg-primary/15 text-primary hover:bg-primary/25" : "bg-accent/15 text-accent hover:bg-accent/25"
          )}
        >
          {ref}
        </button>
      ))}
    </span>
  );
}

function SectionHeading({ icon: Icon, title, count, hint }: { icon: typeof BookOpen; title: string; count?: number; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="h-5 w-5 text-primary" /> {title}
        {typeof count === "number" && <span className="text-sm font-normal text-muted-foreground">({count})</span>}
      </h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

const FEASIBILITY: Record<ResearchIdeaView["feasibility"], { label: string; variant: "success" | "warning" | "destructive" }> = {
  high: { label: "High feasibility", variant: "success" },
  medium: { label: "Medium feasibility", variant: "warning" },
  low: { label: "Ambitious", variant: "destructive" },
};

function IdeaCard({ idea, number }: { idea: ResearchIdeaView; number: number }) {
  const feasibility = FEASIBILITY[idea.feasibility];
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
            {number}
          </span>
          <Badge variant={feasibility.variant}>{feasibility.label}</Badge>
        </div>
        <div>
          <h3 className="font-semibold leading-snug">{idea.title}</h3>
          <p className="mt-1.5 text-sm italic text-muted-foreground">“{idea.hypothesis}”</p>
        </div>
        <p className="text-sm leading-relaxed">{idea.description}</p>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <span className="font-medium">What&apos;s new: </span>
          <span className="text-muted-foreground">{idea.novelty}</span>
          {idea.buildsOn.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Builds on <RefChips refs={idea.buildsOn} />
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Methodology</p>
            <ol className="mt-1 space-y-1 text-sm">
              {idea.methodology.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-primary">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">First steps this week</p>
            <ul className="mt-1 space-y-1 text-sm">
              {idea.firstSteps.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Snapshot lightbox ───────────────────────────────────────────────────────

interface Preview {
  src: string;
  title: string;
  url: string;
}

function SnapshotLightbox({ preview, onClose }: { preview: Preview | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {preview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`First page of ${preview.title}`}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
            className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lift"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="min-w-0 truncate text-sm font-medium">{preview.title}</p>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "gradient", size: "sm" })}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open the source
                </a>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="overflow-auto bg-muted/40 p-3">
              <img src={preview.src} alt={`First page of ${preview.title}`} className="mx-auto w-full max-w-2xl rounded-lg shadow-soft" />
            </div>
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              First page only, captured for preview. Open the source above to read the full document.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function ResearchDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data: project, isLoading, isError } = useResearchProject(projectId);
  const explainMutation = useExplainSource(projectId);
  const retryMutation = useCreateResearch();
  const [preview, setPreview] = useState<Preview | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !project) {
    return <p className="py-16 text-center text-muted-foreground">This research brief could not be loaded.</p>;
  }

  const active = isResearchActive(project.status);
  const badge = statusBadge(project.status);
  const analysis = project.analysis;

  const handleExplain = async (kind: "paper" | "patent", index: number) => {
    try {
      await explainMutation.mutateAsync({ kind, index });
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const handleRetry = async () => {
    try {
      const fresh = await retryMutation.mutateAsync({ idea: project.idea, title: project.title });
      router.push(`/dashboard/research/${fresh.id}`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const isExplaining = (kind: "paper" | "patent", index: number) =>
    explainMutation.isPending && explainMutation.variables?.kind === kind && explainMutation.variables?.index === index;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{project.subject}</Badge>
          <Badge variant={badge.variant} className="gap-1">
            {active && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {badge.label}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{project.title}</h1>
        <blockquote className="mt-3 max-w-3xl border-l-2 border-primary/40 pl-4 text-muted-foreground">{project.idea}</blockquote>
        {project.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.keywords.map((keyword) => (
              <Badge key={keyword} variant="outline">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {active && <ProgressTracker project={project} />}

      {project.status === "failed" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-medium">This brief couldn&apos;t be finished</p>
                <p className="text-sm text-muted-foreground">{project.error ?? "An unexpected error occurred."}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleRetry} loading={retryMutation.isPending}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overview + what was searched */}
      {analysis && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-card">
          <CardContent className="p-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Compass className="h-4 w-4" /> Where your idea sits in the field
            </p>
            <p className="leading-relaxed">{analysis.overview}</p>
          </CardContent>
        </Card>
      )}

      {project.sourcesSearched.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" /> Searched:
          {project.sourcesSearched.map((report) => (
            <span
              key={report.name}
              title={report.note ?? undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                report.ok ? "border-emerald-500/30 text-emerald-400" : "border-border text-muted-foreground line-through"
              )}
            >
              {report.name} {report.ok && `· ${report.count}`}
            </span>
          ))}
          {project.paperQueries.length > 0 && (
            <span className="ml-1">
              for{" "}
              {project.paperQueries.map((query, index) => (
                <span key={query}>
                  {index > 0 && ", "}
                  <em>{query}</em>
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {/* Landscape */}
      {analysis && analysis.landscape.length > 0 && (
        <section>
          <SectionHeading icon={Compass} title="Research landscape" hint="How the prior work groups together" />
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.landscape.map((theme) => (
              <Card key={theme.theme}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{theme.theme}</h3>
                    <RefChips refs={theme.refs} />
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{theme.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Papers */}
      {(project.papers.length > 0 || !active) && (
        <section>
          <SectionHeading
            icon={BookOpen}
            title="Previous research papers"
            count={project.papers.length}
            hint="Click a page to preview it, or open the paper to read it in full"
          />
          {project.papers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No papers came back from the scholarly indexes for this idea. Try the search links at the bottom, or
              rephrase the idea with more field-specific terms.
            </p>
          ) : (
            <div className="space-y-4">
              {project.papers.map((paper) => (
                <SourceCard
                  key={paper.ref}
                  source={toPaperCard(paper, active)}
                  onExplain={() => handleExplain("paper", paper.index)}
                  explaining={isExplaining("paper", paper.index)}
                  onPreview={(src, title, url) => setPreview({ src, title, url })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Patents */}
      {(project.patents.length > 0 || !active) && (
        <section>
          <SectionHeading
            icon={ScrollText}
            title="Related patents"
            count={project.patents.length}
            hint="What has already been claimed — and where the freedom to operate lies"
          />
          {project.patents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No patents were found for this idea{" "}
              {project.sourcesSearched.some((r) => r.name === "Google Patents" && !r.ok)
                ? "— Google Patents didn't answer this time. "
                : ". "}
              <a href={project.links.googlePatents} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Search Google Patents directly
              </a>
              .
            </p>
          ) : (
            <div className="space-y-4">
              {project.patents.map((patent) => (
                <SourceCard
                  key={patent.ref}
                  source={toPatentCard(patent, active)}
                  onExplain={() => handleExplain("patent", patent.index)}
                  explaining={isExplaining("patent", patent.index)}
                  onPreview={(src, title, url) => setPreview({ src, title, url })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Gaps */}
      {analysis && analysis.gaps.length > 0 && (
        <section>
          <SectionHeading icon={Sparkles} title="What the prior work leaves open" />
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-5">
              <ul className="space-y-2">
                {analysis.gaps.map((gap, index) => (
                  <li key={index} className="flex gap-2 text-sm">
                    <span className="font-bold text-accent">?</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Ideas */}
      {analysis && analysis.ideas.length > 0 && (
        <section>
          <SectionHeading
            icon={Lightbulb}
            title="Research directions built on these sources"
            count={analysis.ideas.length}
            hint="Each idea names the papers and patents it builds on"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {analysis.ideas.map((idea, index) => (
              <motion.div
                key={idea.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.06, 0.3) }}
              >
                <IdeaCard idea={idea} number={index + 1} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Next steps + go further */}
      {!active && (
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {analysis && analysis.nextSteps.length > 0 ? (
            <Card>
              <CardContent className="p-5">
                <p className="mb-3 flex items-center gap-2 font-semibold">
                  <ListChecks className="h-4 w-4 text-primary" /> Your next steps
                </p>
                <ol className="space-y-2">
                  {analysis.nextSteps.map((step, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : (
            <div />
          )}
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <FlaskConical className="h-4 w-4 text-primary" /> Go further
              </p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { label: "Google Scholar", href: project.links.googleScholar },
                    { label: "arXiv search", href: project.links.arxiv },
                    { label: "Google Patents", href: project.links.googlePatents },
                  ] as const
                ).map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-between")}
                  >
                    {link.label} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Same queries SMART AI used, in the primary indexes — for when you want the full result lists.
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      <SnapshotLightbox preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
