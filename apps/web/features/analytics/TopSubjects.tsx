"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/useAnalytics";

/**
 * Single-series ranked bar list (magnitude → one hue). Labels and values are
 * plain text tokens; the bar carries magnitude only, so nothing depends on
 * color perception.
 */
export function TopSubjects() {
  const { data, isLoading } = useAnalytics();
  const subjects = data?.favoriteSubjects ?? [];
  const max = Math.max(1, ...subjects.map((subject) => subject.lessons));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Favorite subjects</CardTitle>
        <CardDescription>Where your curiosity goes, by lessons generated</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Generate your first lesson to see your subject mix.
          </p>
        ) : (
          <ul className="space-y-4">
            {subjects.map(({ subject, lessons }) => (
              <li key={subject}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{subject}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {lessons} {lessons === 1 ? "lesson" : "lessons"}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(6, (lessons / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
