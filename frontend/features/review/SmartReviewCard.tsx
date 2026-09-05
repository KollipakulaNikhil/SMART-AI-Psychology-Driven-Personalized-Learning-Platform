"use client";

import Link from "next/link";
import { BrainCircuit, CalendarClock, Flame, Mountain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDueReviews } from "@/hooks/useLearning";
import { useAnalytics } from "@/hooks/useAnalytics";
import { formatDate } from "@/lib/utils";

/**
 * The retention loop, surfaced: lessons due for spaced-repetition review
 * today, plus the learner's study streak.
 */
export function SmartReviewCard() {
  const { data, isLoading } = useDueReviews();
  const { data: analytics } = useAnalytics();
  const streak = analytics?.studyStreak ?? 0;

  return (
    <Card className="border-accent/30">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-accent" /> Smart Review
          </CardTitle>
          <CardDescription>Spaced repetition, timed to your memory</CardDescription>
        </div>
        {streak > 0 && (
          <Badge variant="warning" className="gap-1 px-3 py-1">
            <Flame className="h-3.5 w-3.5" /> {streak}-day streak
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data || data.due.length === 0 ? (
          <div className="rounded-xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            {data && data.upcoming.length > 0 ? (
              <>
                Nothing due today — next review{" "}
                <span className="text-foreground">{formatDate(data.upcoming[0].dueAt)}</span> (
                {data.upcoming[0].topic}).
              </>
            ) : (
              <>Finish a lesson quiz and it enters your review schedule automatically.</>
            )}
          </div>
        ) : (
          data.due.slice(0, 4).map((item) => (
            <div
              key={item.presentationId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.topic}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  Last score {item.lastScorePct}% · review #{item.repetitions + 1}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/dashboard/lesson/${item.presentationId}/play`}
                  className={buttonVariants({ variant: "gradient", size: "sm" })}
                >
                  <Mountain className="h-3.5 w-3.5" /> Play
                </Link>
                <Link
                  href={`/dashboard/lesson/${item.presentationId}#quiz`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Quiz
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
