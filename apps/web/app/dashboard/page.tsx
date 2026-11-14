"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsRow } from "@/features/analytics/StatsRow";
import { TopSubjects } from "@/features/analytics/TopSubjects";
import { SmartReviewCard } from "@/features/review/SmartReviewCard";
import { LessonCard } from "@/features/history/LessonCard";
import { useLessons } from "@/hooks/useLessons";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/context/AuthContext";
import { cn, titleCase } from "@/lib/utils";

export default function DashboardPage() {
  const { sessionUser, firebaseUser } = useAuth();
  const { data: lessons, isLoading: lessonsLoading } = useLessons(6, 1);
  const { data: profile } = useProfile();

  const firstName = (sessionUser?.name ?? firebaseUser?.displayName ?? "there").split(" ")[0];

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-10">
      {/* The front page of the journal: date line, greeting, the one next action. */}
      <header>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-foreground/20 pb-2.5">
          <p className="label-mono" suppressHydrationWarning>
            {today}
          </p>
          <p className="label-mono">{profile ? `Learning profile v${profile.version}` : "Study journal"}</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pt-7">
          <div className="min-w-0 max-w-2xl">
            <h1 className="page-title text-balance">
              Welcome back, <em className="italic">{firstName}</em>.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              {profile
                ? `Lessons are tuned for a ${profile.traits.learningStyle} learner at a ${profile.traits.pace} pace.`
                : "Let's map how you learn, then generate your first lesson."}
            </p>
          </div>
          <Link href="/dashboard/generate" className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "group")}>
            New lesson
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>
      </header>

      <StatsRow />

      <div className="grid gap-x-12 gap-y-12 lg:grid-cols-12">
        <div className="min-w-0 space-y-12 lg:col-span-8">
          <SmartReviewCard />

          <section aria-labelledby="recent-title">
            <div className="flex items-baseline justify-between gap-4 border-b border-foreground pb-3">
              <h2 id="recent-title" className="font-display text-2xl leading-tight">
                Recent lessons
              </h2>
              <Link href="/dashboard/history" className="link-ink inline-flex min-h-11 items-center gap-1 text-sm font-medium">
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            {lessonsLoading ? (
              <div aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border-b border-foreground/20 py-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2.5 h-6 w-2/3" />
                    <Skeleton className="mt-2.5 h-3 w-48" />
                  </div>
                ))}
              </div>
            ) : lessons && lessons.items.length > 0 ? (
              <div>
                {lessons.items.slice(0, 4).map((lesson, index) => (
                  <LessonCard key={lesson.id} lesson={lesson} index={index} />
                ))}
              </div>
            ) : (
              <div className="ruled border-b border-foreground px-1 py-12 sm:px-6" style={{ ["--rule-gap" as string]: "2.5rem" }}>
                <p className="font-display text-2xl leading-tight">Nothing here yet.</p>
                <p className="mt-2 max-w-xs text-[15px] text-muted-foreground">
                  Generate your first personalized lesson and it will appear here.
                </p>
                <Link
                  href="/dashboard/generate"
                  className={cn(buttonVariants({ variant: "gradient", size: "sm" }), "mt-5")}
                >
                  Generate a lesson <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* the margin column */}
        <aside className="min-w-0 space-y-12 lg:col-span-4">
          <TopSubjects />

          {profile && (
            <section aria-labelledby="profile-title">
              <h2 id="profile-title" className="font-display text-xl leading-tight">
                Your learning profile
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">v{profile.version} · drives every generation</p>
              <ul className="mt-4 border-t border-foreground">
                {(
                  [
                    ["Style", profile.traits.learningStyle],
                    ["Attention", `${profile.traits.attentionSpan} attention`],
                    ["Pace", `${profile.traits.pace} pace`],
                    ["Level", profile.traits.knowledgeLevel],
                    ["Tone", `${profile.traits.tone} tone`],
                  ] as [string, string][]
                ).map(([label, trait]) => (
                  <li key={label} className="flex items-baseline justify-between gap-4 border-b border-foreground/20 py-2.5">
                    <span className="label-mono">{label}</span>
                    <span className="text-right text-sm font-medium">{titleCase(trait)}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/profile"
                className="link-ink mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium"
              >
                View full profile <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
