"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuestions, useSubmitQuestionnaire } from "@/hooks/useQuestionnaire";
import { toErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";
import { stepSlide, springSnappy, tapScale, hoverLift } from "@/lib/motion";
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
  const [direction, setDirection] = useState<1 | -1>(1);
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

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

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
      goTo(missingIndex);
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
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums transition-colors",
              answeredAll ? "bg-amber/15 text-amber" : "text-muted-foreground"
            )}
          >
            {answeredAll && <Sparkles className="h-3 w-3" aria-hidden />}
            {Math.round(progress)}% mapped
          </span>
        </div>
        <Progress value={progress} />
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={current?.id}
          custom={direction}
          variants={stepSlide}
          initial="enter"
          animate="center"
          exit="exit"
          className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft sm:p-8"
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
                <motion.button
                  key={option.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggle(option.id)}
                  whileHover={hoverLift}
                  whileTap={tapScale}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left text-sm sm:text-base",
                    "transition-[border-color,background-color,box-shadow] duration-200",
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
                    <AnimatePresence>
                      {isSelected && (
                        <motion.span
                          initial={{ scale: 0, rotate: -45, opacity: 0 }}
                          animate={{ scale: 1, rotate: 0, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={springSnappy}
                          className="flex"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => goTo(Math.max(0, step - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {step < total - 1 ? (
          <AnimatePresence mode="wait">
            {selected.length > 0 ? (
              <motion.div
                key="next"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springSnappy}
              >
                <Button variant="secondary" onClick={() => goTo(step + 1)}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <Button key="next-disabled" variant="secondary" disabled>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </AnimatePresence>
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
