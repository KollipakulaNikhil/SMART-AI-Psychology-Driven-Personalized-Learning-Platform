"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Eye, EyeOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudyNotesView } from "@/lib/types";

/** True only when there's real content to show — used to decide whether the tab renders at all. */
export function hasStudyNotesContent(notes: StudyNotesView | null): notes is StudyNotesView {
  if (!notes) return false;
  return Boolean(
    notes.explanation.trim() ||
      notes.definitions.length > 0 ||
      notes.keyFacts.length > 0 ||
      notes.example ||
      notes.practice ||
      (notes.commonMistake && notes.commonMistake.trim())
  );
}

interface StudyNotesPanelProps {
  notes: StudyNotesView;
}

/**
 * The written matter behind a slide — what a student would copy into a
 * notebook. Deliberately plain-prose (Inter, not Kalam): a distinct light
 * panel next to the chalkboard, not a second chalkboard.
 */
export function StudyNotesPanel({ notes }: StudyNotesPanelProps) {
  const [revealed, setRevealed] = useState(false);

  // A new slide's practice question must never show the previous slide's
  // revealed answer.
  useEffect(() => {
    setRevealed(false);
  }, [notes]);

  const hasExplanation = Boolean(notes.explanation.trim());
  const hasDefinitions = notes.definitions.length > 0;
  const hasKeyFacts = notes.keyFacts.length > 0;
  const hasExample = Boolean(notes.example);
  const hasPractice = Boolean(notes.practice);
  const hasCommonMistake = Boolean(notes.commonMistake && notes.commonMistake.trim());

  return (
    <div className="space-y-4 text-sm">
      {hasExplanation && (
        <div className="rounded-r-xl border-l-4 border-primary/40 bg-primary/5 p-4">
          <span className="eyebrow">Explanation</span>
          <p className="mt-1.5 leading-relaxed text-foreground">{notes.explanation}</p>
        </div>
      )}

      {hasDefinitions && (
        <div>
          <span className="eyebrow">Definitions</span>
          <dl className="mt-2 space-y-2">
            {notes.definitions.map((def, i) => (
              <div key={i} className="rounded-xl bg-muted/40 p-3">
                <dt className="font-semibold text-primary">{def.term}</dt>
                <dd className="mt-0.5 text-muted-foreground">{def.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {hasKeyFacts && (
        <div>
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" />
            Key facts
          </span>
          <ul className="mt-2 space-y-1.5">
            {notes.keyFacts.map((fact, i) => (
              <li key={i} className="rounded-r-lg border-l-2 border-accent/60 bg-accent/5 px-3 py-1.5 text-foreground">
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasExample && notes.example && (
        <div className="rounded-xl border border-border p-4">
          <span className="eyebrow">Worked example</span>
          <p className="mt-1.5 font-medium text-foreground">{notes.example.problem}</p>
          {notes.example.steps.length > 0 && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              {notes.example.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {hasPractice && notes.practice && (
        <div className="rounded-xl border border-border bg-secondary/5 p-4">
          <span className="eyebrow">Practice</span>
          <p className="mt-1.5 font-medium text-foreground">{notes.practice.question}</p>
          {revealed ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 rounded-lg bg-muted/50 p-3 text-muted-foreground"
            >
              {notes.practice.answer}
            </motion.div>
          ) : (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setRevealed(true)}>
              <Eye className="h-4 w-4" />
              Reveal answer
            </Button>
          )}
          {revealed && (
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => setRevealed(false)}>
              <EyeOff className="h-4 w-4" />
              Hide answer
            </Button>
          )}
        </div>
      )}

      {hasCommonMistake && (
        <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-500">
              Common mistake
            </span>
            <p className="mt-1 text-foreground">{notes.commonMistake}</p>
          </div>
        </div>
      )}
    </div>
  );
}
