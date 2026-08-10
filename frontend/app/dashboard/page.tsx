"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatsRow } from "@/features/analytics/StatsRow";
import { TopSubjects } from "@/features/analytics/TopSubjects";
import { SmartReviewCard } from "@/features/review/SmartReviewCard";
import { LessonCard } from "@/features/history/LessonCard";
import { useLessons } from "@/hooks/useLessons";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/context/AuthContext";
import { titleCase } from "@/lib/utils";

export default function DashboardPage() {
  const { sessionUser, firebaseUser } = useAuth();
  const { data: lessons, isLoading: lessonsLoading } = useLessons(6, 1);
  const { data: profile } = useProfile();

  const firstName = (sessionUser?.name ?? firebaseUser?.displayName ?? "there").split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Welcome back, {firstName}</h1>
          <p className="mt-1 text-muted-foreground">
            {profile
              ? `Lessons are tuned for a ${profile.traits.learningStyle} learner at a ${profile.traits.pace} pace.`
              : "Let's map how you learn, then generate your first lesson."}
          </p>
        </div>
        <Link href="/dashboard/generate" className={buttonVariants({ variant: "gradient" })}>
          <Sparkles className="h-4 w-4" /> New lesson
        </Link>
      </div>

      <StatsRow />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent lessons</h2>
            <Link
              href="/dashboard/history"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {lessonsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : lessons && lessons.items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {lessons.items.slice(0, 4).map((lesson, index) => (
                <LessonCard key={lesson.id} lesson={lesson} index={index} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <p className="font-medium">Nothing here yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Generate your first personalized lesson and it will appear here.
                </p>
                <Link href="/dashboard/generate" className={buttonVariants({ variant: "gradient", size: "sm" })}>
                  <Sparkles className="h-3.5 w-3.5" /> Generate a lesson
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <SmartReviewCard />
          <TopSubjects />

          {profile && (
            <Card>
              <CardHeader>
                <CardTitle>Your learning profile</CardTitle>
                <CardDescription>v{profile.version} · drives every generation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      profile.traits.learningStyle,
                      `${profile.traits.attentionSpan} attention`,
                      `${profile.traits.pace} pace`,
                      profile.traits.knowledgeLevel,
                      `${profile.traits.tone} tone`,
                    ] as string[]
                  ).map((trait) => (
                    <Badge key={trait} variant="outline">
                      {titleCase(trait)}
                    </Badge>
                  ))}
                </div>
                <Link
                  href="/dashboard/profile"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View full profile <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
