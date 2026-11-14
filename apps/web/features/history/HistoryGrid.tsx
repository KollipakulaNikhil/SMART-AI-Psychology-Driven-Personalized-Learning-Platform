"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLessons } from "@/hooks/useLessons";
import { cn } from "@/lib/utils";
import { LessonCard } from "./LessonCard";

export function HistoryGrid() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLessons(12, page);

  if (isLoading) {
    return (
      <div className="border-t border-foreground" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-foreground/20 py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-6 w-2/3" />
            <Skeleton className="mt-2.5 h-3 w-48" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="ruled border-y border-foreground px-1 py-16 sm:px-8" style={{ ["--rule-gap" as string]: "2.5rem" }}>
        <p className="label-mono">Page one</p>
        <p className="mt-3 font-display text-3xl leading-tight">No lessons yet.</p>
        <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">
          Your generated lessons, decks and videos will live here.
        </p>
        <Link href="/dashboard/generate" className={cn(buttonVariants({ variant: "gradient" }), "mt-6")}>
          Generate your first lesson <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-t border-foreground">
        {data.items.map((lesson, index) => (
          <LessonCard key={lesson.id} lesson={lesson} index={index} />
        ))}
      </div>

      {data.pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="nums font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Page {data.page} of {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
