"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Map } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateForm, type GenerateValues } from "@/features/generate/GenerateForm";
import { PipelineSteps } from "@/features/generate/PipelineSteps";
import { useGeneratePipeline } from "@/hooks/useGeneratePipeline";

function GeneratePageInner() {
  const { steps, running, error, lesson, run, reset } = useGeneratePipeline();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Present when arriving from a Learning Path module's "Generate lesson".
  const courseId = searchParams.get("courseId") ?? undefined;
  const moduleIndexParam = searchParams.get("moduleIndex");
  const moduleIndex = moduleIndexParam !== null ? Number(moduleIndexParam) : undefined;
  const prefilledTopic = searchParams.get("topic") ?? undefined;
  const prefilledFocus = searchParams.get("focus") ?? undefined;
  const isPathModule = Boolean(courseId && moduleIndex !== undefined && !Number.isNaN(moduleIndex));

  const started = running || steps.some((step) => step.state !== "idle");
  const finished = !running && lesson && steps.every((step) => step.state === "done");

  const handleGenerate = async (values: GenerateValues) => {
    const result = await run({
      topic: values.topic,
      focus: values.focus,
      durationMin: values.durationMin > 0 ? values.durationMin : undefined,
      detailLevel: values.detailLevel,
      subtitles: values.subtitles,
      language: values.language,
      // "same" is a UI affordance only — the API takes a real language, or
      // nothing at all to mean "follow the narration".
      boardLanguage: values.boardLanguage === "same" ? undefined : values.boardLanguage,
      courseId: isPathModule ? courseId : undefined,
      moduleIndex: isPathModule ? moduleIndex : undefined,
    });
    if (result) {
      toast.success("Your lesson is ready!");
      router.push(`/dashboard/lesson/${result.id}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Generate a lesson</h1>
        <p className="mt-1 text-muted-foreground">
          Content, deck, narration and video — personalized end to end.
        </p>
        {isPathModule && (
          <Badge variant="accent" className="mt-3 gap-1.5 px-3 py-1">
            <Map className="h-3.5 w-3.5" /> Learning Path module {Number(moduleIndex) + 1} — this
            lesson links back to your path
          </Badge>
        )}
      </div>

      <GenerateForm
        onGenerate={handleGenerate}
        disabled={running}
        defaultTopic={prefilledTopic}
        defaultFocus={prefilledFocus}
      />

      <AnimatePresence>
        {started && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <PipelineSteps steps={steps} error={error} />

            {(finished || (error && lesson)) && (
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                {error && (
                  <Button variant="outline" onClick={reset}>
                    Start over
                  </Button>
                )}
                <Button variant="gradient" onClick={() => router.push(`/dashboard/lesson/${lesson.id}`)}>
                  Open lesson <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}>
      <GeneratePageInner />
    </Suspense>
  );
}
