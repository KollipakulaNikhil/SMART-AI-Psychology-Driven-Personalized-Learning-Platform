"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Languages, Map, Sparkles, Target, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourses, useCreateCourse, useCreateCourseFromPdf } from "@/hooks/useLearning";
import { useLessonLanguages } from "@/hooks/useLessons";
import { toErrorMessage } from "@/services/api";
import { formatDate, cn } from "@/lib/utils";
import type { LessonLanguage, LessonLanguageOption } from "@/lib/types";

const MAX_PDF_MB = 20;

/** Shown until GET /generate/languages resolves — mirrors the server registry. */
const FALLBACK_LANGUAGES: LessonLanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", locale: "en-US" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", locale: "hi-IN" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", locale: "te-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", locale: "ta-IN" },
  { code: "es", label: "Spanish", nativeLabel: "Español", locale: "es-ES" },
];

export function PathsView() {
  const [mode, setMode] = useState<"goal" | "pdf">("goal");
  const [goal, setGoal] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<LessonLanguage>("en");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: courses, isLoading } = useCourses();
  const { data: languages } = useLessonLanguages();
  const languageChoices = languages ?? FALLBACK_LANGUAGES;
  const createMutation = useCreateCourse();
  const createFromPdfMutation = useCreateCourseFromPdf();
  const isPending = createMutation.isPending || createFromPdfMutation.isPending;

  const handleCreate = async () => {
    if (goal.trim().length < 8) {
      toast.error("Describe your goal in a few more words.");
      return;
    }
    try {
      const course = await createMutation.mutateAsync({ goal: goal.trim(), language });
      setGoal("");
      toast.success(`Your path "${course.title}" is ready — ${course.totalModules} modules planned.`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const handleSelectFile = (selected: File | undefined) => {
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      toast.error("Only PDF files are supported.");
      return;
    }
    if (selected.size > MAX_PDF_MB * 1024 * 1024) {
      toast.error(`That PDF is too large — the limit is ${MAX_PDF_MB}MB.`);
      return;
    }
    setFile(selected);
  };

  const handleCreateFromPdf = async () => {
    if (!file) {
      toast.error("Choose a PDF to upload.");
      return;
    }
    try {
      const course = await createFromPdfMutation.mutateAsync({ file, language });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(`"${course.title}" is ready — ${course.totalModules} modules planned from your PDF.`);
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
            Give SMART AI a goal, or upload a PDF — either way it plans a step-by-step path of
            lessons shaped by your learning psychology, and adds whatever extra topics you need to
            fully understand the material.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="inline-flex rounded-full border border-border p-1">
            {(
              [
                { key: "goal", label: "From a goal" },
                { key: "pdf", label: "From a PDF" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={isPending}
                onClick={() => setMode(option.key)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                  mode === option.key
                    ? "bg-brand-gradient text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === "goal" ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder='e.g. "Get job-ready with SQL", "Understand how the stock market works"…'
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleCreate()}
                disabled={isPending}
                className="flex-1"
              />
              <Button variant="gradient" onClick={handleCreate} loading={createMutation.isPending}>
                Plan my path
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => handleSelectFile(event.target.files?.[0])}
              />
              {!file ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center transition-colors hover:border-primary/50 disabled:opacity-50"
                >
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Click to choose a PDF</span>
                  <span className="text-xs text-muted-foreground">
                    Textbook chapter, notes or article — up to {MAX_PDF_MB}MB
                  </span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <span className="truncate text-sm font-medium">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(1)}MB
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <Button
                variant="gradient"
                onClick={handleCreateFromPdf}
                loading={createFromPdfMutation.isPending}
                disabled={!file}
              >
                <Sparkles className="h-4 w-4" /> Plan my path from this PDF
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" /> Teach me in
            </Label>
            <div className="flex flex-wrap gap-2">
              {languageChoices.map((choice) => (
                <button
                  key={choice.code}
                  type="button"
                  disabled={isPending}
                  onClick={() => setLanguage(choice.code)}
                  title={choice.label}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors disabled:opacity-50",
                    language === choice.code
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {choice.nativeLabel}
                </button>
              ))}
            </div>
          </div>
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{course.subject}</Badge>
                        {course.sourceType === "document" && (
                          <Badge variant="outline" className="gap-1">
                            <FileText className="h-3 w-3" /> From PDF
                          </Badge>
                        )}
                      </div>
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
