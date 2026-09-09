"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  FileText,
  ImageOff,
  Loader2,
  Maximize2,
  Quote,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { staticUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { SourceDeepDiveView, SourceExplanationView } from "@/lib/types";

/**
 * One prior-art source (paper or patent): its captured first page, the link
 * to the real thing, the AI's explanation for this learner, and an on-demand
 * deep dive. Shared by both kinds so they read the same.
 */
export interface SourceCardData {
  kind: "paper" | "patent";
  index: number;
  ref: string;
  title: string;
  /** "Vaswani, Shazeer et al. · 2017 · NeurIPS" or "Google LLC · granted 2019". */
  byline: string;
  /** Small factual chips: citations, source, patent number… */
  chips: string[];
  abstract: string | null;
  url: string;
  pdfUrl: string | null;
  snapshotUrl: string | null;
  snapshotStatus: "pending" | "ready" | "unavailable";
  explanation: SourceExplanationView | null;
  deepDive: SourceDeepDiveView | null;
}

interface SourceCardProps {
  source: SourceCardData;
  onExplain: () => void;
  explaining: boolean;
  onPreview: (src: string, title: string, url: string) => void;
}

function DeepDiveSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

export function SourceCard({ source, onExplain, explaining, onPreview }: SourceCardProps) {
  const [abstractOpen, setAbstractOpen] = useState(false);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const snapshot = staticUrl(source.snapshotUrl);
  const Icon = source.kind === "paper" ? BookOpen : ScrollText;
  const openLabel = source.kind === "paper" ? "Open paper" : "Open patent";

  const handleExplain = () => {
    setDeepDiveOpen(true);
    if (!source.deepDive && !explaining) onExplain();
  };

  return (
    <Card id={`source-${source.ref}`} className="scroll-mt-24 overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        {/* First-page snapshot — the learner sees the actual document, then clicks through. */}
        <div className="relative border-b border-border bg-muted/40 md:border-b-0 md:border-r">
          {snapshot ? (
            <button
              type="button"
              onClick={() => onPreview(snapshot, source.title, source.url)}
              className="group relative block h-56 w-full overflow-hidden md:h-full md:min-h-[280px]"
              aria-label={`Preview the first page of ${source.title}`}
            >
              <img
                src={snapshot}
                alt={`First page of ${source.title}`}
                loading="lazy"
                className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-3.5 w-3.5" /> View page
              </span>
            </button>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground md:h-full md:min-h-[280px]">
              {source.snapshotStatus === "pending" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Capturing first page…
                </>
              ) : (
                <>
                  <ImageOff className="h-5 w-5" aria-hidden />
                  {source.kind === "paper" ? "No open-access PDF to preview — use the link to read it." : "No preview available — use the link to view it."}
                </>
              )}
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-bold text-primary shadow-soft backdrop-blur">
            {source.ref}
          </span>
        </div>

        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant={source.kind === "paper" ? "default" : "accent"} className="gap-1">
                <Icon className="h-3 w-3" /> {source.kind === "paper" ? "Paper" : "Patent"}
              </Badge>
              {source.chips.map((chip) => (
                <Badge key={chip} variant="outline">
                  {chip}
                </Badge>
              ))}
            </div>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold leading-snug hover:text-primary hover:underline"
            >
              {source.title}
            </a>
            <p className="mt-1 text-xs text-muted-foreground">{source.byline}</p>
          </div>

          {source.abstract && (
            <div>
              <p className={cn("text-sm text-muted-foreground", !abstractOpen && "line-clamp-3")}>{source.abstract}</p>
              <button
                type="button"
                onClick={() => setAbstractOpen((open) => !open)}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                {abstractOpen ? "Show less" : "Read full abstract"}
              </button>
            </div>
          )}

          {source.explanation && (
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Explained for you
              </p>
              <p className="text-sm">
                <span className="font-medium">Why it matters: </span>
                <span className="text-muted-foreground">{source.explanation.whyItMatters}</span>
              </p>
              <p className="text-sm">
                <span className="font-medium">Key takeaway: </span>
                <span className="text-muted-foreground">{source.explanation.keyTakeaway}</span>
              </p>
              <p className="text-sm">
                <span className="font-medium">How it relates to your idea: </span>
                <span className="text-muted-foreground">{source.explanation.howItRelates}</span>
              </p>
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="h-3.5 w-3.5" /> {openLabel}
            </a>
            {source.pdfUrl && (
              <a
                href={source.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </a>
            )}
            <Button variant="secondary" size="sm" onClick={handleExplain} loading={explaining} className="ml-auto">
              <Quote className="h-3.5 w-3.5" />
              {source.deepDive ? (deepDiveOpen ? "Hide walkthrough" : "Show walkthrough") : "Explain this to me"}
              {source.deepDive && (
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", deepDiveOpen && "rotate-180")} />
              )}
            </Button>
          </div>

          <AnimatePresence initial={false}>
            {deepDiveOpen && (source.deepDive || explaining) && (
              <motion.div
                key="deep-dive"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                {source.deepDive ? (
                  <div className="space-y-3 rounded-xl border border-border bg-elevated p-4">
                    <p className="text-sm font-medium leading-relaxed">{source.deepDive.plainSummary}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DeepDiveSection label="The problem" text={source.deepDive.problem} />
                      <DeepDiveSection label="How it works" text={source.deepDive.approach} />
                      <DeepDiveSection
                        label={source.kind === "paper" ? "What it found" : "What the claims protect"}
                        text={source.deepDive.findings}
                      />
                      <DeepDiveSection
                        label={source.kind === "paper" ? "Limitations" : "What the claims leave open"}
                        text={source.deepDive.limitations}
                      />
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <DeepDiveSection label="How to use it in your research" text={source.deepDive.howToUse} />
                    </div>
                    {source.deepDive.glossary.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Glossary</p>
                        <dl className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                          {source.deepDive.glossary.map((entry) => (
                            <div key={entry.term} className="text-sm">
                              <dt className="inline font-medium">{entry.term}: </dt>
                              <dd className="inline text-muted-foreground">{entry.meaning}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-elevated p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Writing a plain-language walkthrough in your
                    style…
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </div>
    </Card>
  );
}
