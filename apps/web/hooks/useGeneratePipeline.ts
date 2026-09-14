"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  generateAudio,
  generateContent,
  generateContentFromPdf,
  generatePpt,
  generateVideo,
  type GenerateContentPayload,
} from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import type { PresentationDetail } from "@/lib/types";

export type PipelineStepId = "content" | "ppt" | "audio" | "video";
export type StepState = "idle" | "running" | "done" | "failed";

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  description: string;
  state: StepState;
}

const INITIAL_STEPS: PipelineStep[] = [
  {
    id: "content",
    label: "Personalized script",
    description: "The AI writes a storytelling lesson around your learning psychology",
    state: "idle",
  },
  {
    id: "ppt",
    label: "Slides & handout",
    description: "Designing the deck, matching imagery, PDF handout",
    state: "idle",
  },
  {
    id: "audio",
    label: "Human narration",
    description: "A natural, expressive voice narrates at your pace and tone",
    state: "idle",
  },
  {
    id: "video",
    label: "Interactive lesson ready",
    description:
      "Opening your interactive board lesson now — the downloadable video keeps rendering in the background.",
    state: "idle",
  },
];

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  es: "Spanish",
};

/** Stages driven by lesson id (content takes the topic payload, so it's run directly). */
const STAGE_RUNNERS: Record<"ppt" | "audio", (lessonId: string) => Promise<PresentationDetail>> = {
  ppt: generatePpt,
  audio: generateAudio,
};


export interface UseGeneratePipelineResult {
  steps: PipelineStep[];
  running: boolean;
  error: string | null;
  lesson: PresentationDetail | null;
  /** `file` grounds the lesson in an uploaded PDF's text instead of the topic alone. */
  run: (payload: GenerateContentPayload, file?: File) => Promise<PresentationDetail | null>;
  reset: () => void;
}

/**
 * Drives the four-stage generation pipeline sequentially, exposing per-step
 * state for the animated progress UI. A stage failure stops the pipeline but
 * keeps the lesson id so completed assets remain usable.
 */
export function useGeneratePipeline(): UseGeneratePipelineResult {
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<PresentationDetail | null>(null);
  const runningRef = useRef(false);
  const queryClient = useQueryClient();

  const setStepState = useCallback((id: PipelineStepId, state: StepState) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, state } : step)));
  }, []);

  const reset = useCallback(() => {
    setSteps(INITIAL_STEPS);
    setError(null);
    setLesson(null);
  }, []);

  const run = useCallback(
    async (payload: GenerateContentPayload, file?: File): Promise<PresentationDetail | null> => {
      if (runningRef.current) return null;
      runningRef.current = true;
      setRunning(true);
      setError(null);
      setLesson(null);
      setSteps(INITIAL_STEPS.map((step) => ({ ...step })));

      let current: PresentationDetail | null = null;
      try {
        // A translated lesson is authored in English then translated slide by
        // slide, so this step legitimately takes a couple of minutes. Say so —
        // otherwise a silent 2-minute wait reads as a hang.
        if (payload.language && payload.language !== "en") {
          const languageName = LANGUAGE_NAMES[payload.language] ?? payload.language;
          setSteps((prev) =>
            prev.map((step) =>
              step.id === "content"
                ? {
                    ...step,
                    description: `Writing your lesson, then translating it into ${languageName} — this takes a couple of minutes`,
                  }
                : step
            )
          );
        }
        setStepState("content", "running");
        current = file ? await generateContentFromPdf(file, payload) : await generateContent(payload);
        setLesson(current);
        setStepState("content", "done");
        const lessonId = current.id;

        // Slides + premium narration. Non-fatal: the interactive lesson is
        // playable from the content alone (free browser voice), so a failed
        // deck or an exhausted ElevenLabs quota must not block the learner.
        for (const stage of ["ppt", "audio"] as const) {
          setStepState(stage, "running");
          try {
            current = await STAGE_RUNNERS[stage](lessonId);
            setLesson(current);
            setStepState(stage, "done");
          } catch {
            setStepState(stage, "failed");
          }
        }

        // The downloadable video renders on the server in the background — we do
        // NOT wait for it (the CPU avatar can take minutes). The learner goes
        // straight to the interactive lesson; the video appears there when ready.
        setStepState("video", "running");
        void generateVideo(lessonId).catch(() => undefined);
        setStepState("video", "done");

        queryClient.invalidateQueries({ queryKey: ["lessons"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        queryClient.invalidateQueries({ queryKey: ["recent-topics"] });
        return current;
      } catch (caught) {
        const message = toErrorMessage(caught);
        setError(message);
        setSteps((prev) =>
          prev.map((step) => (step.state === "running" ? { ...step, state: "failed" } : step))
        );
        return null;
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
    },
    [queryClient, setStepState]
  );

  return { steps, running, error, lesson, run, reset };
}
