"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generatePpt } from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";
import type { PresentationDetail } from "@/lib/types";
import { StudyNotesPanel, hasStudyNotesContent } from "./StudyNotesPanel";
import { TutorChat } from "./TutorChat";

type Tab = "notes" | "tutor";

interface LessonSidePanelProps {
  lesson: PresentationDetail;
  /** The chapter on screen — the notes follow it. */
  currentSlide: number;
  /** A board term was clicked; switches to the tutor and asks about it. */
  injected: { text: string; nonce: number } | null;
}

/**
 * What sits beside the lesson: the written notes for the chapter being
 * explained, and the tutor. Both stay mounted so switching tabs never loses a
 * chat or a revealed practice answer.
 */
export function LessonSidePanel({ lesson, currentSlide, injected }: LessonSidePanelProps) {
  const [tab, setTab] = useState<Tab>("notes");
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const notesScrollRef = useRef<HTMLDivElement>(null);

  const index = Math.min(Math.max(0, currentSlide), Math.max(0, lesson.slides.length - 1));
  const slide = lesson.slides[index];
  const notes = slide?.studyNotes ?? null;
  const hasNotes = hasStudyNotesContent(notes);

  // A clicked board term is a question for the tutor — show the answer arriving.
  const injectedNonce = injected?.nonce;
  useEffect(() => {
    if (injectedNonce) setTab("tutor");
  }, [injectedNonce]);

  // New chapter, new notes: start reading from the top.
  useEffect(() => {
    notesScrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const createNotes = async () => {
    setCreating(true);
    try {
      await generatePpt(lesson.id);
      await queryClient.invalidateQueries({ queryKey: ["lesson", lesson.id] });
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <aside className="flex min-w-0 flex-col gap-3" aria-label="Study notes and tutor">
      <div role="tablist" aria-label="Beside the lesson" className="inline-flex self-start rounded-md border border-foreground p-0.5">
        {(
          [
            ["notes", "Study notes", NotebookPen],
            ["tutor", "Ask tutor", GraduationCap],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-xs font-medium transition-colors",
              tab === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className={cn(
          "min-h-0 flex-col rounded-lg border border-border bg-card lg:max-h-[640px]",
          tab === "notes" ? "flex" : "hidden"
        )}
      >
        <div className="border-b border-border px-4 py-3">
          <p className="label-mono">
            <span className="text-primary">Chapter {index + 1}</span> of {lesson.slides.length}
          </p>
          <p className="mt-1 font-display text-lg leading-snug">{slide?.title}</p>
        </div>

        <div ref={notesScrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
          {hasNotes ? (
            <StudyNotesPanel notes={notes} />
          ) : (
            <div className="space-y-4 text-sm">
              {slide && slide.points.length > 0 && (
                <div>
                  <span className="eyebrow">Key points</span>
                  <ul className="mt-2 space-y-1.5">
                    {slide.points.map((point, i) => (
                      <li key={i} className="border-l-2 border-accent/60 bg-accent/5 px-3 py-1.5 text-foreground">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border-t border-border pt-4">
                <p className="text-muted-foreground">
                  Full notes for this lesson — explanations, definitions, a worked example and a
                  practice question per chapter — haven&apos;t been written yet.
                </p>
                <Button variant="outline" size="sm" className="mt-3 min-h-11" onClick={createNotes} loading={creating}>
                  {!creating && <NotebookPen className="h-3.5 w-3.5" />}
                  {creating ? "Writing notes — about a minute" : "Write study notes"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div role="tabpanel" className={cn("min-h-0", tab === "tutor" ? "block" : "hidden")}>
        <TutorChat
          lessonId={lesson.id}
          currentSlideIndex={index}
          currentSlideTitle={slide?.title ?? null}
          injected={injected}
        />
      </div>
    </aside>
  );
}
