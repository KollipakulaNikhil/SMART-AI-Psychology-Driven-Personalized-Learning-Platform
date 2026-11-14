"use client";

import Link from "next/link";
import { CalendarClock, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
    <section aria-labelledby="smart-review-title" className="border-2 border-foreground bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground px-4 py-4 sm:px-6">
        <div>
          <p className="label-mono">
            <span className="text-primary">Up next</span>
          </p>
          <h2 id="smart-review-title" className="mt-1.5 font-display text-2xl leading-tight">
            Smart Review
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Spaced repetition, timed to your memory</p>
        </div>
        {streak > 0 && (
          <Badge variant="warning" className="gap-1.5 px-2 py-1">
            <Flame className="h-3.5 w-3.5" aria-hidden /> {streak}-day streak
          </Badge>
        )}
      </header>
      <div>
        {isLoading ? (
          <div className="space-y-2 p-4 sm:p-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data || data.due.length === 0 ? (
          <p className="px-4 py-6 text-[15px] leading-relaxed text-muted-foreground sm:px-6">
            {data && data.upcoming.length > 0 ? (
              <>
                Nothing due today. Your next review is{" "}
                <span className="font-medium text-foreground">{formatDate(data.upcoming[0].dueAt)}</span> —{" "}
                <span className="italic">{data.upcoming[0].topic}</span>.
              </>
            ) : (
              <>Finish a lesson quiz and it enters your review schedule automatically.</>
            )}
          </p>
        ) : (
          <ol>
            {data.due.slice(0, 4).map((item, index) => (
              <li
                key={item.presentationId}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-foreground/20 px-4 py-4 last:border-b-0 sm:px-6"
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-3">
                  <span className="nums font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg leading-snug">{item.topic}</p>
                    <p className="nums mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      Last score {item.lastScorePct}% · review #{item.repetitions + 1}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link
                    href={`/dashboard/lesson/${item.presentationId}/play`}
                    className={buttonVariants({ variant: "gradient", size: "sm" })}
                  >
                    Play
                  </Link>
                  <Link
                    href={`/dashboard/lesson/${item.presentationId}#quiz`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Quiz
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
