"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, FileText, Lock, Play, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourse } from "@/hooks/useLearning";
import { cn } from "@/lib/utils";
import type { CourseModuleView } from "@/lib/types";

function moduleGenerateHref(courseId: string, module: CourseModuleView, language: string): string {
  const params = new URLSearchParams({
    topic: module.topic,
    focus: module.focus,
    courseId,
    moduleIndex: String(module.index),
    language,
  });
  return `/dashboard/generate?${params.toString()}`;
}

export function PathDetail({ courseId }: { courseId: string }) {
  const { data: course, isLoading, isError } = useCourse(courseId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-3 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !course) {
    return <p className="py-16 text-center text-muted-foreground">This learning path could not be loaded.</p>;
  }

  // The next actionable module: the first that isn't completed.
  const activeIndex = course.modules.findIndex((m) => m.status !== "completed");

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{course.subject}</Badge>
          {course.sourceType === "document" ? (
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" /> From {course.sourceFileName ?? "an uploaded PDF"}
            </Badge>
          ) : (
            <Badge variant="outline">Goal: {course.goal}</Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{course.title}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{course.description}</p>
        <div className="mt-4 max-w-md space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {course.completedModules} of {course.totalModules} modules completed
            </span>
            <span>{course.progressPct}%</span>
          </div>
          <Progress value={course.progressPct} />
        </div>
      </div>

      {course.enrichment.length > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-accent">
              <Sparkles className="h-4 w-4" /> Added by SMART AI beyond your document
            </div>
            <ul className="space-y-1.5">
              {course.enrichment.map((line, index) => (
                <li key={index} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-accent">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Roadmap grouped into sections (chapters), each with its subtopic lessons */}
      <div className="space-y-8">
        {course.sections.map((section) => {
          const sectionDone = section.modules.every((m) => m.status === "completed");
          return (
            <div key={section.index}>
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                    sectionDone ? "bg-emerald-500/20 text-emerald-400" : "bg-brand-gradient text-white"
                  )}
                >
                  {section.index + 1}
                </span>
                <div>
                  <h2 className="font-semibold leading-tight">{section.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {section.modules.filter((m) => m.status === "completed").length}/{section.modules.length} lessons
                  </p>
                </div>
              </div>

              <ol className="space-y-2.5 border-l border-border pl-4 sm:pl-6">
                {section.modules.map((module) => {
                  const isDone = module.status === "completed";
                  const isActive = module.index === activeIndex;
                  const isLocked = activeIndex !== -1 && module.index > activeIndex;

                  return (
                    <motion.li
                      key={module.index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card
                        className={cn(
                          isActive && "border-primary/50 shadow-lg shadow-primary/10",
                          isLocked && "opacity-55"
                        )}
                      >
                        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                              isDone
                                ? "bg-emerald-500/20 text-emerald-400"
                                : isActive
                                  ? "bg-brand-gradient text-white"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isDone ? (
                              <Check className="h-4 w-4" />
                            ) : isLocked ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              module.index + 1
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "font-medium",
                                isDone && "text-muted-foreground line-through decoration-emerald-500/40"
                              )}
                            >
                              {module.title}
                            </p>
                            <p className="line-clamp-1 text-sm text-muted-foreground">{module.focus}</p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {module.status === "completed" && module.presentationId && (
                              <Link
                                href={`/dashboard/lesson/${module.presentationId}`}
                                className={buttonVariants({ variant: "ghost", size: "sm" })}
                              >
                                Revisit
                              </Link>
                            )}
                            {module.status === "generated" && module.presentationId && (
                              <Link
                                href={`/dashboard/lesson/${module.presentationId}`}
                                className={buttonVariants({ variant: "secondary", size: "sm" })}
                              >
                                <Play className="h-3.5 w-3.5" /> Continue — pass the quiz
                              </Link>
                            )}
                            {module.status === "pending" && !isLocked && (
                              <Link
                                href={moduleGenerateHref(course.id, module, course.language)}
                                className={buttonVariants({ variant: isActive ? "gradient" : "outline", size: "sm" })}
                              >
                                <Sparkles className="h-3.5 w-3.5" /> Generate lesson
                              </Link>
                            )}
                            {module.status === "pending" && isLocked && (
                              <span className="text-xs text-muted-foreground">Finish the previous lesson first</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        A lesson completes when you score 60% or higher on its quiz — then Smart Review keeps it
        fresh with spaced repetition.
      </p>
    </div>
  );
}
