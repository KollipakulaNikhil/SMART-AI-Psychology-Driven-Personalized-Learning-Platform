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
          className="label-mono min-h-11 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to lesson
        </Link>
        <h1 className="page-title mt-1">{lesson?.title || lesson?.topic || "Play"}</h1>
        <p className="mt-2.5 border-b-2 border-foreground pb-5 text-[15px] leading-relaxed text-muted-foreground">
          Play this lesson&apos;s quiz as a game — pick a world. Every run counts toward Smart Review.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
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
