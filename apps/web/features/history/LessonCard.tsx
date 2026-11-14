"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration } from "@/lib/utils";
import type { PresentationSummary } from "@/lib/types";

function overallStatus(summary: PresentationSummary): { label: string; variant: "success" | "warning" | "destructive" } {
  const { content, ppt, audio, video } = summary.status;
  const statuses = [content, ppt, audio, video];
  if (statuses.includes("failed")) return { label: "Failed", variant: "destructive" };
  if (video === "ready") return { label: "Complete", variant: "success" };
  return { label: "Partial", variant: "warning" };
}

/**
 * A lesson as one entry in an index: number, subject, title, the facts in
 * tabular figures. Lists of these are ruled, not gridded into cards.
 * (Name kept — it is imported as `LessonCard` across the app.)
 */
export function LessonCard({ lesson, index = 0 }: { lesson: PresentationSummary; index?: number }) {
  const status = overallStatus(lesson);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.25 }}
      className="border-b border-foreground/20"
    >
      <Link
        href={`/dashboard/lesson/${lesson.id}`}
        className="group grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-3 py-4 transition-colors hover:bg-foreground/[0.035] sm:grid-cols-[2.5rem_1fr_auto] sm:gap-x-4 sm:px-2"
      >
        <span className="nums font-mono text-xs text-muted-foreground group-hover:text-primary">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <p className="label-mono">{lesson.subject}</p>
          <h3 className="mt-1 line-clamp-2 text-xl font-normal leading-snug decoration-primary decoration-2 underline-offset-4 group-hover:underline">
            {lesson.title || lesson.topic}
          </h3>
          {lesson.title && lesson.title !== lesson.topic && (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{lesson.topic}</p>
          )}
          <p className="nums mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>{lesson.slideCount} slides</span>
            <span aria-hidden>·</span>
            <span>{formatDuration(lesson.videoDurationSec)}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(lesson.createdAt)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start pt-0.5">
          <Badge variant={status.variant}>{status.label}</Badge>
          <ArrowUpRight
            className="hidden h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary sm:block"
            aria-hidden
          />
        </div>
      </Link>
    </motion.div>
  );
}
