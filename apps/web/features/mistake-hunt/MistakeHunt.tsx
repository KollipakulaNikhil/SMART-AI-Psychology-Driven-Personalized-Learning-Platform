"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createMistakeHunt, type MistakeHuntView } from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";

const SAMPLE_TOPICS = ["Photosynthesis", "How vaccines work", "Newton's laws of motion", "The French Revolution"];
type Difficulty = MistakeHuntView["difficulty"];

export function MistakeHunt() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("subtle");
  const [pending, setPending] = useState(false);
  const [hunt, setHunt] = useState<MistakeHuntView | null>(null);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);

  const start = async (chosenTopic: string) => {
    const value = chosenTopic.trim();
    if (value.length < 2 || pending) return;
    setTopic(value);
    setPending(true);
    try {
      const next = await createMistakeHunt(value, difficulty);
      setHunt(next);
      setFlagged(new Set());
      setChecked(false);
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void start(topic);
  };

  const toggle = (index: number) => {
    if (checked) return;
    setFlagged((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const mistakes = hunt ? hunt.sentences.filter((sentence) => sentence.isWrong).length : 0;
  const caught = hunt ? hunt.sentences.filter((sentence, i) => sentence.isWrong && flagged.has(i)).length : 0;
  const falseAlarms = flagged.size - caught;

  return (
    <div className="space-y-10">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            maxLength={120}
            placeholder="Any topic — e.g. the water cycle, binary search, inflation"
            aria-label="Topic"
            className="h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" variant="gradient" className="h-12" loading={pending} disabled={topic.trim().length < 2}>
            {!pending && <Search className="h-4 w-4" />}
            {pending ? "Planting mistakes…" : hunt ? "New hunt" : "Start the hunt"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div role="group" aria-label="Difficulty" className="inline-flex rounded-md border border-foreground p-0.5">
            {(
              [
                ["obvious", "Obvious mistakes"],
                ["subtle", "Subtle mistakes"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                aria-pressed={difficulty === value}
                className={cn(
                  "min-h-11 rounded-[3px] px-3 text-xs font-medium transition-colors",
                  difficulty === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {!hunt && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="label-mono mr-1">Try</span>
              {SAMPLE_TOPICS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  disabled={pending}
                  onClick={() => void start(sample)}
                  className="min-h-11 rounded-sm border border-input px-3 text-xs transition-colors hover:border-foreground disabled:opacity-50"
                >
                  {sample}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      {hunt && !pending && (
        <motion.section
          key={hunt.title + hunt.sentences[0]?.text}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          aria-labelledby="hunt-title"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground pb-3">
            <div>
              <h2 id="hunt-title" className="font-display text-2xl leading-tight">
                {hunt.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {checked
                  ? "Corrections are shown under each planted mistake."
                  : `${mistakes} of these ${hunt.sentences.length} sentences are wrong. Tap the ones you don't believe.`}
              </p>
            </div>
            <p className="label-mono">
              {checked ? `${caught} / ${mistakes} caught` : `${flagged.size} flagged`}
            </p>
          </div>

          <ol>
            {hunt.sentences.map((sentence, index) => {
              const isFlagged = flagged.has(index);
              const hit = checked && sentence.isWrong && isFlagged;
              const missed = checked && sentence.isWrong && !isFlagged;
              const falseAlarm = checked && !sentence.isWrong && isFlagged;
              return (
                <li key={index} className="border-b border-foreground/20">
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    disabled={checked}
                    aria-pressed={isFlagged}
                    className={cn(
                      "grid w-full grid-cols-[2rem_1fr] gap-x-3 px-2 py-4 text-left transition-colors sm:grid-cols-[2.5rem_1fr]",
                      !checked && "hover:bg-foreground/[0.04]",
                      !checked && isFlagged && "bg-mark/15",
                      hit && "bg-accent/10",
                      missed && "bg-amber/10",
                      falseAlarm && "bg-destructive/[0.06]"
                    )}
                  >
                    <span className="pt-0.5 font-mono text-sm tabular-nums text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "text-[17px] leading-relaxed",
                          !checked && isFlagged && "underline decoration-mark decoration-2 underline-offset-4",
                          checked && sentence.isWrong && "line-through decoration-foreground/40"
                        )}
                      >
                        {sentence.text}
                      </span>
                      {checked && (sentence.isWrong || falseAlarm) && (
                        <span className="mt-2 block text-sm leading-relaxed">
                          <span
                            className={cn(
                              "label-mono mr-2",
                              hit && "text-accent",
                              missed && "text-amber",
                              falseAlarm && "text-destructive"
                            )}
                          >
                            {hit ? "Caught" : missed ? "Missed" : "This one was true"}
                          </span>
                          {sentence.isWrong && <span className="font-medium">{sentence.correction} </span>}
                          <span className="text-muted-foreground">{sentence.reason}</span>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {checked ? (
            <div
              className={cn(
                "mt-6 flex flex-col gap-4 border-y-2 py-5 sm:flex-row sm:items-center sm:justify-between",
                caught === mistakes && falseAlarms === 0 ? "border-accent" : "border-amber"
              )}
            >
              <div>
                <p className="font-display text-3xl leading-none tabular-nums">
                  {caught} / {mistakes} <span className="text-base text-muted-foreground">mistakes caught</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {falseAlarms > 0
                    ? `${falseAlarms} true sentence${falseAlarms === 1 ? "" : "s"} doubted by mistake.`
                    : caught === mistakes
                      ? "Clean sweep — nothing got past you and nothing true was doubted."
                      : "No false alarms, but some mistakes slipped through."}
                </p>
              </div>
              <Button variant="outline" className="min-h-11 shrink-0" onClick={() => void start(hunt.topic)}>
                Another passage on this topic
              </Button>
            </div>
          ) : (
            <Button
              variant="gradient"
              size="lg"
              className="mt-6 w-full"
              disabled={flagged.size === 0}
              onClick={() => setChecked(true)}
            >
              {flagged.size === 0 ? "Flag at least one sentence" : "Check my answers"}
            </Button>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            The passage is written by AI. If a sentence marked true looks wrong to you, check a trusted
            source — you may have caught a mistake it didn&apos;t plant.
          </p>
        </motion.section>
      )}
    </div>
  );
}
