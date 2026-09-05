"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLesson } from "@/hooks/useLessons";
import { PlayArena } from "@/features/play/PlayArena";

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: lesson, isLoading, isError } = useLesson(id);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link
          href={`/dashboard/lesson/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to lesson
        </Link>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{lesson?.title || lesson?.topic || "Play"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Play this lesson&apos;s quiz as a game — pick a world. Every run counts toward Smart Review.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
      ) : isError || !lesson ? (
        <p className="py-16 text-center text-muted-foreground">This lesson could not be loaded.</p>
      ) : (
        <PlayArena lesson={lesson} />
      )}
    </div>
  );
}
