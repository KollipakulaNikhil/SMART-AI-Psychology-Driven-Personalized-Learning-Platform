"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuestions, useSubmitQuestionnaire } from "@/hooks/useQuestionnaire";
import { toErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";
import type { LearningProfileData } from "@/lib/types";
import { ProfileReveal } from "./ProfileReveal";

/**
 * One-question-at-a-time psychology assessment. Every question is
 * multi-select — mixed preferences are real, and each selected option casts
 * its trait votes. Answers accumulate locally and submit as one batch.
 */
export function QuestionnaireWizard() {
  const { data: questions, isLoading, isError } = useQuestions();
  const submitMutation = useSubmitQuestionnaire();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<LearningProfileData | null>(null);

  const total = questions?.length ?? 0;
  const current = questions?.[step];
  const selected = current ? (answers[current.id] ?? []) : [];
  const answeredCount = useMemo(
    () => Object.values(answers).filter((ids) => ids.length > 0).length,
    [answers]
  );
  const progress = total === 0 ? 0 : (answeredCount / total) * 100;

  if (result) return <ProfileReveal profile={result} />;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !questions || questions.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        Could not load the questionnaire. Check that the backend is running, then refresh.
      </p>
    );
  }

  const toggle = (optionId: string) => {
    if (!current) return;
    setAnswers((prev) => {
      const existing = prev[current.id] ?? [];
      const next = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
      return { ...prev, [current.id]: next };
    });
  };

  const finish = async () => {
    const missingIndex = questions.findIndex((question) => !(answers[question.id]?.length > 0));
    if (missingIndex !== -1) {
      setStep(missingIndex);
      toast.error("A few questions are still unanswered.");
      return;
    }
    try {
      const profile = await submitMutation.mutateAsync(
        questions.map((question) => ({
          questionId: question.id,
          optionIds: answers[question.id],
        }))
      );
      setResult(profile);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const answeredAll = answeredCount === total;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {step + 1} of {total}
          </span>
          <span>{Math.round(progress)}% mapped</span>
        </div>
        <Progress value={progress} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current?.id}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="accent">{current?.category}</Badge>
            <span className="text-xs text-muted-foreground">Select all that apply</span>
          </div>
          <h2 className="mb-6 text-2xl font-semibold leading-snug sm:text-3xl">{current?.text}</h2>

          <div className="space-y-3" role="group" aria-label={current?.text}>
            {current?.options.map((option) => {
              const isSelected = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggle(option.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left text-sm transition-all sm:text-base",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                      : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
                  )}
                >
                  <span>{option.label}</span>
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isSelected ? "border-primary bg-primary text-white" : "border-border"
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {step < total - 1 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s + 1)} disabled={selected.length === 0}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="gradient"
            onClick={finish}
            disabled={!answeredAll}
            loading={submitMutation.isPending}
          >
            Build my learning profile
          </Button>
        )}
      </div>
    </div>
  );
}
