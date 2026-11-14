"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/useAnalytics";
import { cn, formatDuration } from "@/lib/utils";

interface StatFigureProps {
  label: string;
  value: string;
  hint: string;
  /** The streak is the one figure allowed a colour. */
  tone?: "ink" | "ochre";
  className?: string;
}

/**
 * One figure in the ruled row: mono label, a large serif numeral set in
 * tabular figures, and a plain-text note. No icon chip, no card.
 */
function StatFigure({ label, value, hint, tone = "ink", className }: StatFigureProps) {
  return (
    <div className={cn("bg-background px-4 py-5 first:pl-0 sm:px-5", className)}>
      <p className="label-mono">{label}</p>
      <p
        className={cn(
          "nums mt-2.5 whitespace-nowrap font-display text-[2rem] leading-none tracking-tight sm:text-4xl xl:text-[2rem] 2xl:text-4xl",
          tone === "ochre" && "text-amber"
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

const ROW = "grid grid-cols-2 gap-px border-y border-foreground bg-foreground/20 xl:grid-cols-5";

export function StatsRow() {
  const { data, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <div className={ROW} aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("bg-background px-4 py-5 sm:px-5", i === 0 && "col-span-2 pl-0 xl:col-span-1")}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-24" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }

  const stats = data ?? {
    lessonsGenerated: 0,
    slidesCreated: 0,
    videosGenerated: 0,
    learningTimeSec: 0,
    avgVideoLengthSec: 0,
    favoriteSubjects: [],
    quizAttempts: 0,
    avgQuizScorePct: 0,
    dueReviews: 0,
    studyStreak: 0,
  };

  return (
    <section aria-label="Your numbers" className={ROW}>
      <StatFigure
        label="Study streak"
        value={`${stats.studyStreak} ${stats.studyStreak === 1 ? "day" : "days"}`}
        hint={stats.dueReviews > 0 ? `${stats.dueReviews} review${stats.dueReviews === 1 ? "" : "s"} due today` : "Keep it going with a quiz"}
        tone={stats.studyStreak > 0 ? "ochre" : "ink"}
        className="col-span-2 xl:col-span-1"
      />
      <StatFigure
        label="Lessons generated"
        value={String(stats.lessonsGenerated)}
        hint={`${stats.slidesCreated} slides created`}
        className="pl-0 xl:pl-5"
      />
      <StatFigure
        label="Learning time"
        value={formatDuration(stats.learningTimeSec)}
        hint="Total video watch length"
      />
      <StatFigure
        label="Quiz mastery"
        value={stats.quizAttempts > 0 ? `${stats.avgQuizScorePct}%` : "—"}
        hint={`${stats.quizAttempts} ${stats.quizAttempts === 1 ? "attempt" : "attempts"} recorded`}
        className="pl-0 xl:pl-5"
      />
      <StatFigure
        label="Avg video length"
        value={formatDuration(stats.avgVideoLengthSec)}
        hint="Matched to your attention span"
      />
    </section>
  );
}
