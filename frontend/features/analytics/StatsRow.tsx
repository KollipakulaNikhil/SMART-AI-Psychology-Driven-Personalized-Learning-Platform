"use client";

import type { ComponentType } from "react";
import { BookOpenCheck, Clock3, Flame, ListChecks, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/useAnalytics";
import { formatDuration } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

/** Hero-number tile: big value in ink, muted label — the color lives in the icon chip only. */
function StatTile({ label, value, hint, icon: Icon }: StatTileProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {/*
            Five tiles across leaves ~110px for the number once the icon chip is
            subtracted, so a 3xl "38m 15s" was being truncated to "38m …". These
            values are always short — size the type down where the grid is
            tightest instead of clipping them.
          */}
          <p className="mt-1 whitespace-nowrap text-3xl font-bold tracking-tight xl:text-2xl 2xl:text-3xl">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
}

export function StatsRow() {
  const { data, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px]" />
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatTile
        label="Study streak"
        value={`${stats.studyStreak} ${stats.studyStreak === 1 ? "day" : "days"}`}
        hint={stats.dueReviews > 0 ? `${stats.dueReviews} review${stats.dueReviews === 1 ? "" : "s"} due today` : "Keep it going with a quiz"}
        icon={Flame}
      />
      <StatTile
        label="Lessons generated"
        value={String(stats.lessonsGenerated)}
        hint={`${stats.slidesCreated} slides created`}
        icon={BookOpenCheck}
      />
      <StatTile
        label="Learning time"
        value={formatDuration(stats.learningTimeSec)}
        hint="Total video watch length"
        icon={Clock3}
      />
      <StatTile
        label="Quiz mastery"
        value={stats.quizAttempts > 0 ? `${stats.avgQuizScorePct}%` : "—"}
        hint={`${stats.quizAttempts} ${stats.quizAttempts === 1 ? "attempt" : "attempts"} recorded`}
        icon={ListChecks}
      />
      <StatTile
        label="Avg video length"
        value={formatDuration(stats.avgVideoLengthSec)}
        hint="Matched to your attention span"
        icon={Timer}
      />
    </div>
  );
}
