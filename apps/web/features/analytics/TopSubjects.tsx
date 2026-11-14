"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/useAnalytics";

/**
 * Single-series ranked bar list (magnitude → one hue). Labels and values are
 * plain text tokens; the bar carries magnitude only, so nothing depends on
 * color perception. Set as a margin table rather than a card.
 */
export function TopSubjects() {
  const { data, isLoading } = useAnalytics();
  const subjects = data?.favoriteSubjects ?? [];
  const max = Math.max(1, ...subjects.map((subject) => subject.lessons));

  return (
    <section aria-labelledby="top-subjects-title">
      <h2 id="top-subjects-title" className="font-display text-xl leading-tight">
        Favorite subjects
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Where your curiosity goes, by lessons generated</p>

      <div className="mt-4 border-t border-foreground">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <p className="border-b border-foreground/20 py-5 text-sm text-muted-foreground">
            Generate your first lesson to see your subject mix.
          </p>
        ) : (
          <ul>
            {subjects.map(({ subject, lessons }) => (
              <li key={subject} className="border-b border-foreground/20 py-3">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{subject}</span>
                  <span className="nums shrink-0 font-mono text-xs text-muted-foreground">
                    {lessons} {lessons === 1 ? "lesson" : "lessons"}
                  </span>
                </div>
                <div className="mt-2 h-[3px] bg-foreground/10" aria-hidden>
                  <div
                    className="h-full bg-foreground transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(6, (lessons / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
