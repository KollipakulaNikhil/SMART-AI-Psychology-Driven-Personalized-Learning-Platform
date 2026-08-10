"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Map, Target } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourses, useCreateCourse } from "@/hooks/useLearning";
import { toErrorMessage } from "@/services/api";
import { formatDate } from "@/lib/utils";

export function PathsView() {
  const [goal, setGoal] = useState("");
  const { data: courses, isLoading } = useCourses();
  const createMutation = useCreateCourse();

  const handleCreate = async () => {
    if (goal.trim().length < 8) {
      toast.error("Describe your goal in a few more words.");
      return;
    }
    try {
      const course = await createMutation.mutateAsync(goal.trim());
      setGoal("");
      toast.success(`Your path "${course.title}" is ready — ${course.totalModules} modules planned.`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  return (
    <div className="space-y-8">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Where do you want to get to?
          </CardTitle>
          <CardDescription>
            Give SMART AI a goal — it plans a step-by-step path of lessons shaped by your
            learning psychology, from where you are to where you want to be.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder='e.g. "Get job-ready with SQL", "Understand how the stock market works"…'
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreate()}
            disabled={createMutation.isPending}
            className="flex-1"
          />
          <Button variant="gradient" onClick={handleCreate} loading={createMutation.isPending}>
            Plan my path
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !courses || courses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Map className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No learning paths yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Set a goal above and SMART AI will design your personalized syllabus.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.06, 0.4) }}
            >
              <Link href={`/dashboard/paths/${course.id}`} className="group block h-full">
                <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/10">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="secondary">{course.subject}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(course.createdAt)}</span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 font-semibold leading-snug group-hover:text-primary">
                      {course.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {course.completedModules} / {course.totalModules} modules
                        </span>
                        <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          Continue <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                      <Progress value={course.progressPct} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
