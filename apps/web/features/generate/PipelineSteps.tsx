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
          className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
        >
          <Check className="h-4 w-4" />
        </motion.span>
      );
    case "running":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      );
    case "failed":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 text-red-400">
          <AlertCircle className="h-4 w-4" />
        </span>
      );
    default:
      return <span className="h-8 w-8 rounded-full border-2 border-dashed border-border" />;
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
                      step.state === "done" ? "bg-emerald-500/40" : "bg-border"
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
          <div className="mt-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
