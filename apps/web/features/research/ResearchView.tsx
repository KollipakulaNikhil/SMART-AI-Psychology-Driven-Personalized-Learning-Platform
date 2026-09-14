"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, FlaskConical, Lightbulb, Loader2, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { isResearchActive, useCreateResearch, useDeleteResearch, useResearchProjects } from "@/hooks/useResearch";
import { toErrorMessage } from "@/services/api";
import { formatDate } from "@/lib/utils";
import type { ResearchProjectSummary, ResearchStatus } from "@/lib/types";

const MIN_IDEA_CHARS = 20;
const MAX_IDEA_CHARS = 2_000;

const EXAMPLE_IDEAS = [
  "Using graph neural networks to predict drug–drug interactions from molecular structure",
  "Low-cost soil moisture sensors with LoRa for smallholder irrigation scheduling",
  "Detecting early-stage diabetic retinopathy from smartphone fundus images",
];

export function statusBadge(status: ResearchStatus): { label: string; variant: "default" | "success" | "warning" | "destructive" | "outline" } {
  switch (status) {
    case "ready":
      return { label: "Ready", variant: "success" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    case "queued":
      return { label: "Queued", variant: "outline" };
    case "searching":
      return { label: "Searching", variant: "warning" };
    case "snapshotting":
      return { label: "Capturing pages", variant: "warning" };
    case "ideating":
      return { label: "Ideating", variant: "warning" };
  }
}

function ProjectCard({ project, onDelete, deleting }: { project: ResearchProjectSummary; onDelete: () => void; deleting: boolean }) {
  const badge = statusBadge(project.status);
  const active = isResearchActive(project.status);

  return (
    <Card interactive className="h-full">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{project.subject}</Badge>
            <Badge variant={badge.variant} className="gap-1">
              {active && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {badge.label}
            </Badge>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(project.createdAt)}</span>
        </div>

        <Link href={`/dashboard/research/${project.id}`} className="group mt-3 block">
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">{project.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.idea}</p>
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {active ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {project.stageMessage}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> {project.paperCount} papers
              </span>
              <span className="flex items-center gap-1">
                <ScrollText className="h-3.5 w-3.5" /> {project.patentCount} patents
              </span>
              <span className="flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5" /> {project.ideaCount} ideas
              </span>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <Link
            href={`/dashboard/research/${project.id}`}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {active ? "Watch progress" : "Open brief"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={active || deleting}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${project.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResearchView() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [title, setTitle] = useState("");
  const { data: projects, isLoading } = useResearchProjects();
  const createMutation = useCreateResearch();
  const deleteMutation = useDeleteResearch();

  const handleCreate = async () => {
    const trimmed = idea.trim();
    if (trimmed.length < MIN_IDEA_CHARS) {
      toast.error("Describe your research idea in a few more words — what, for whom, and why.");
      return;
    }
    try {
      const project = await createMutation.mutateAsync({ idea: trimmed, title: title.trim() || undefined });
      setIdea("");
      setTitle("");
      toast.success("Idea shared — gathering papers and patents now.");
      router.push(`/dashboard/research/${project.id}`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const handleDelete = async (project: ResearchProjectSummary) => {
    if (!window.confirm(`Delete "${project.title}"? This removes the brief and its captured pages.`)) return;
    try {
      await deleteMutation.mutateAsync(project.id);
      toast.success("Research brief deleted.");
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  return (
    <div className="space-y-8">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" /> Share your research idea
          </CardTitle>
          <CardDescription>
            SMART AI searches arXiv, Semantic Scholar, OpenAlex and Google Patents for the prior work,
            captures each paper&apos;s first page so you can see it, explains every source in your
            learning style, and ideates new directions that build on what already exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="research-idea">What do you want to research?</Label>
            <Textarea
              id="research-idea"
              value={idea}
              onChange={(event) => setIdea(event.target.value.slice(0, MAX_IDEA_CHARS))}
              disabled={createMutation.isPending}
              rows={5}
              placeholder="Describe the problem, your angle, and who it helps. The more specific, the better the prior-art search — e.g. the method you have in mind, the data you'd use, the setting it applies to."
              className="min-h-[130px]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {idea.trim().length < MIN_IDEA_CHARS
                  ? `At least ${MIN_IDEA_CHARS} characters`
                  : `${idea.length.toLocaleString()} / ${MAX_IDEA_CHARS.toLocaleString()}`}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="hidden sm:inline">Try:</span>
                {EXAMPLE_IDEAS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={createMutation.isPending}
                    onClick={() => setIdea(example)}
                    className="rounded-full border border-border px-2.5 py-0.5 transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
                  >
                    {example.length > 46 ? `${example.slice(0, 44)}…` : example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="research-title">
                Working title <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="research-title"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, 140))}
                disabled={createMutation.isPending}
                placeholder="SMART AI suggests one if you leave this blank"
              />
            </div>
            <Button
              variant="gradient"
              size="lg"
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={idea.trim().length < MIN_IDEA_CHARS}
            >
              <FlaskConical className="h-4 w-4" /> Find prior work &amp; ideate
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <FlaskConical className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No research briefs yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Share an idea above — SMART AI gathers the papers and patents behind it and helps you find
            your own angle.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.06, 0.4) }}
            >
              <ProjectCard
                project={project}
                onDelete={() => handleDelete(project)}
                deleting={deleteMutation.isPending && deleteMutation.variables === project.id}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
