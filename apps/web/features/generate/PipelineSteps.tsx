"use client";

import { motion } from "framer-motion";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PipelineStep } from "@/hooks/useGeneratePipeline";

interface PipelineStepsProps {
  steps: PipelineStep[];
  error: string | null;
}

function StepIcon({ state }: { state: PipelineStep["state"] }) {
  switch (state) {
    case "done":
      return (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-accent bg-accent text-accent-foreground"
        >
          <Check className="h-4 w-4" />
        </motion.span>
      );
    case "running":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-primary text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      );
    case "failed":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-destructive text-destructive">
          <AlertCircle className="h-4 w-4" />
        </span>
      );
    default:
      return <span className="h-8 w-8 rounded-sm border border-dashed border-input" />;
  }
}

/** Animated vertical checklist mirroring the four backend generation stages. */
export function PipelineSteps({ steps, error }: PipelineStepsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Building your lesson</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1">
          {steps.map((step, index) => (
            <li key={step.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <StepIcon state={step.state} />
                {index < steps.length - 1 && (
                  <span
                    className={cn(
                      "my-1 w-px flex-1 min-h-6",
                      step.state === "done" ? "bg-accent" : "bg-foreground/20"
                    )}
                  />
                )}
              </div>
              <div className={cn("pb-6", step.state === "idle" && "opacity-50")}>
                <p className="font-medium leading-8">{step.label}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                {step.state === "running" && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1 text-xs text-primary"
                  >
                    This can take a minute — worth the wait.
                  </motion.p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {error && (
          <div className="mt-2 rounded-md border border-destructive bg-destructive/[0.06] p-4 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
