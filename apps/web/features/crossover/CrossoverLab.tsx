"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeftRight, Eye, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLessons } from "@/hooks/useLessons";
import { createCrossover, type CrossoverView } from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";
import type { PresentationSummary } from "@/lib/types";

function LessonPicker({
  label,
  lessons,
  value,
  other,
  onChange,
}: {
  label: string;
  lessons: PresentationSummary[];
  value: string;
  /** The lesson chosen on the other side — can't be picked twice. */
  other: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="label-mono">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Choose a lesson…</option>
        {lessons.map((lesson) => (
          <option key={lesson.id} value={lesson.id} disabled={lesson.id === other}>
            {lesson.title || lesson.topic} — {lesson.subject}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CrossoverLab() {
  const { data, isLoading } = useLessons(50);
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CrossoverView | null>(null);
  const [answerShown, setAnswerShown] = useState(false);

  const lessons = (data?.items ?? []).filter((lesson) => lesson.status.content === "ready");

  /** Two random lessons, from different subjects whenever the library allows it. */
  const surprise = () => {
    if (lessons.length < 2) return;
    const first = lessons[Math.floor(Math.random() * lessons.length)];
    const others = lessons.filter((lesson) => lesson.id !== first.id);
    const farApart = others.filter((lesson) => lesson.subject !== first.subject);
    const pool = farApart.length > 0 ? farApart : others;
    setFirstId(first.id);
    setSecondId(pool[Math.floor(Math.random() * pool.length)].id);
  };

  const run = async () => {
    setPending(true);
    setAnswerShown(false);
    try {
      setResult(await createCrossover(firstId, secondId));
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (lessons.length < 2) {
    return (
      <div className="border-y border-foreground py-10">
        <p className="font-display text-2xl">You need two lessons to connect.</p>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          A crossover links two lessons you&apos;ve already made. You have {lessons.length} so far.
        </p>
        <Link href="/dashboard/generate" className="link-ink mt-3 inline-flex min-h-11 items-center text-sm font-medium">
          Create a lesson
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section aria-label="Choose lessons">
        <div className="grid items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
          <LessonPicker label="Lesson A" lessons={lessons} value={firstId} other={secondId} onChange={setFirstId} />
          <ArrowLeftRight className="mx-auto mb-3.5 hidden h-5 w-5 text-muted-foreground md:block" aria-hidden />
          <LessonPicker label="Lesson B" lessons={lessons} value={secondId} other={firstId} onChange={setSecondId} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="gradient"
            className="min-h-11"
            disabled={!firstId || !secondId || firstId === secondId}
            loading={pending}
            onClick={run}
          >
            {pending ? "Finding the connection…" : "Connect them"}
          </Button>
          <Button variant="outline" className="min-h-11" onClick={surprise} disabled={pending}>
            <Shuffle className="h-4 w-4" /> Surprise me
          </Button>
        </div>
      </section>

      {result && !pending && (
        <motion.section
          key={`${result.first.id}:${result.second.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          aria-labelledby="crossover-bridge"
          className="space-y-8"
        >
          <div className="border-y-2 border-foreground py-6">
            <p className="label-mono">
              <span className="text-primary">The shared idea</span>
            </p>
            <p id="crossover-bridge" className="mt-3 max-w-3xl text-balance font-display text-2xl leading-snug sm:text-3xl">
              {result.bridge}
            </p>
          </div>

          <div>
            <div className="hidden grid-cols-[1fr_1fr_1.4fr] gap-x-6 border-b border-foreground pb-2 md:grid">
              {[result.first, result.second].map((lesson) => (
                <Link key={lesson.id} href={`/dashboard/lesson/${lesson.id}`} className="label-mono hover:text-foreground">
                  <span className="truncate">{lesson.title}</span>
                </Link>
              ))}
              <span className="label-mono">Why they match</span>
            </div>
            <ol>
              {result.links.map((link, index) => (
                <li
                  key={index}
                  className="grid gap-x-6 gap-y-1.5 border-b border-foreground/20 py-4 md:grid-cols-[1fr_1fr_1.4fr]"
                >
                  <p className="font-medium">
                    <span className="label-mono mr-2 md:hidden">A</span>
                    {link.first}
                  </p>
                  <p className="font-medium text-primary">
                    <span className="label-mono mr-2 md:hidden">B</span>
                    {link.second}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{link.why}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="border-l-2 border-amber bg-amber/[0.07] p-4">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-amber">
              Where the comparison breaks
            </p>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed">{result.breaksAt}</p>
          </div>

          <div className="rounded-lg border border-border p-5">
            <p className="label-mono">A question that needs both</p>
            <p className="mt-2 max-w-3xl text-[17px] font-medium leading-snug">{result.challenge.question}</p>
            {answerShown ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("mt-3 max-w-3xl border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted-foreground")}
              >
                {result.challenge.answer}
              </motion.p>
            ) : (
              <Button variant="outline" size="sm" className="mt-3 min-h-11" onClick={() => setAnswerShown(true)}>
                <Eye className="h-4 w-4" /> Think first, then reveal
              </Button>
            )}
          </div>
        </motion.section>
      )}
    </div>
  );
}
