"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock3, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDuration } from "@/lib/utils";
import type { PresentationSummary } from "@/lib/types";

function overallStatus(summary: PresentationSummary): { label: string; variant: "success" | "warning" | "destructive" } {
  const { content, ppt, audio, video } = summary.status;
  const statuses = [content, ppt, audio, video];
  if (statuses.includes("failed")) return { label: "Failed", variant: "destructive" };
  if (video === "ready") return { label: "Complete", variant: "success" };
  return { label: "Partial", variant: "warning" };
}

export function LessonCard({ lesson, index = 0 }: { lesson: PresentationSummary; index?: number }) {
  const status = overallStatus(lesson);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.3 }}
    >
      <Link href={`/dashboard/lesson/${lesson.id}`} className="group block">
        <Card className="transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/10">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <Badge variant="secondary">{lesson.subject}</Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <h3 className="mt-3 line-clamp-2 font-semibold leading-snug group-hover:text-primary">
              {lesson.title || lesson.topic}
            </h3>
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{lesson.topic}</p>
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" /> {lesson.slideCount} slides
              </span>
              <span className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" /> {formatDuration(lesson.videoDurationSec)}
              </span>
              <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {formatDate(lesson.createdAt)} <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
