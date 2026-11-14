"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  AudioLines,
  Captions,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Film,
  Languages,
  Loader2,
  Mountain,
  Presentation as PresentationIcon,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLesson } from "@/hooks/useLessons";
import { useSubmitQuiz } from "@/hooks/useLearning";
import { downloadLessonAsset, generateVideo, type DownloadableAsset } from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import { LESSON_LANGUAGE_LABELS, staticUrl } from "@/lib/constants";
import { cn, formatDate, titleCase } from "@/lib/utils";
import type { QuizAttemptResult, QuizQuestion } from "@/lib/types";
import { LessonSidePanel } from "./LessonSidePanel";
import { InteractiveLesson } from "./InteractiveLesson";
import { AnimatedExplainer } from "@/features/video/AnimatedExplainer";

const DOWNLOADS: { asset: DownloadableAsset; label: string; icon: typeof Film; hint: string }[] = [
  { asset: "video", label: "Video", icon: Film, hint: "MP4 · narrated lesson" },
  { asset: "ppt", label: "PowerPoint", icon: PresentationIcon, hint: "PPTX · editable deck" },
  { asset: "pdf", label: "PDF", icon: FileText, hint: "PDF · printable handout" },
  { asset: "audio", label: "Audio", icon: AudioLines, hint: "MP3 · full narration" },
  { asset: "subtitles", label: "Subtitles", icon: Captions, hint: "SRT · caption file" },
];

function DownloadButtons({ lessonId, available }: { lessonId: string; available: Record<DownloadableAsset, boolean> }) {
  const [busy, setBusy] = useState<DownloadableAsset | null>(null);

  const handleDownload = async (asset: DownloadableAsset) => {
    setBusy(asset);
    try {
      await downloadLessonAsset(lessonId, asset);
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <table className="w-full border-t border-foreground text-sm">
      <caption className="sr-only">Downloads</caption>
      <thead>
        <tr className="border-b border-foreground/20">
          <th scope="col" className="label-mono py-2 pr-3 text-left font-medium">Asset</th>
          <th scope="col" className="label-mono hidden py-2 pr-3 text-left font-medium sm:table-cell">Format</th>
          <th scope="col" className="label-mono py-2 pr-3 text-left font-medium">Status</th>
          <th scope="col" className="py-2 text-right">
            <span className="sr-only">Download</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {DOWNLOADS.map(({ asset, label, icon: Icon, hint }) => (
          <tr key={asset} className="border-b border-foreground/20">
            <th scope="row" className="py-2 pr-3 text-left font-medium">
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {label}
              </span>
            </th>
            <td className="hidden py-2 pr-3 text-muted-foreground sm:table-cell">{hint}</td>
            <td className="py-2 pr-3">
              <span className={cn("label-mono", available[asset] ? "text-accent" : "text-muted-foreground")}>
                {available[asset] ? "Ready" : "Not generated"}
              </span>
            </td>
            <td className="py-1 text-right">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={!available[asset]}
                loading={busy === asset}
                onClick={() => handleDownload(asset)}
                aria-label={`Download ${label}`}
              >
                {busy !== asset && <Download className="h-4 w-4" aria-hidden />}
                <span className="hidden sm:inline">Download</span>
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SlideCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  return (
    <section aria-labelledby="slides-title">
      <div className="flex items-baseline justify-between gap-4 border-b border-foreground pb-3">
        <h2 id="slides-title" className="font-display text-2xl leading-tight">
          Slides
        </h2>
        <span className="nums font-mono text-xs text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
        </span>
      </div>
      <figure className="mt-5">
        <div className="overflow-hidden rounded-lg border-2 border-foreground bg-black">
          <AnimatePresence mode="wait">
            <motion.img
              key={index}
              src={images[index]}
              alt={`Slide ${index + 1}`}
              className="aspect-video w-full object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          </AnimatePresence>
        </div>
        <figcaption className="mt-3 flex items-center justify-between gap-3">
          <span className="label-mono">
            <span className="text-primary">Fig. 3</span> Slide {index + 1}
          </span>
          <span className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={index === images.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </span>
        </figcaption>
      </figure>

      <div className="scrollbar-thin mt-4 flex gap-2 overflow-x-auto pb-1">
        {images.map((image, thumbIndex) => (
          <button
            key={image}
            type="button"
            onClick={() => setIndex(thumbIndex)}
            aria-label={`Show slide ${thumbIndex + 1}`}
            aria-current={thumbIndex === index ? "true" : undefined}
            className={cn(
              "shrink-0 overflow-hidden rounded-sm border-2 transition-colors",
              thumbIndex === index ? "border-mark" : "border-transparent opacity-60 hover:opacity-100"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-14 w-24 object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}

function Quiz({
  lessonId,
  questions,
}: {
  lessonId: string;
  questions: QuizQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const submitQuiz = useSubmitQuiz();
  if (questions.length === 0) return null;

  const allAnswered = questions.every((_, index) => answers[index] !== undefined);
  /** Correctness is only revealed once the server has graded the attempt. */
  const graded = result !== null;

  const finish = async () => {
    try {
      const attempt = await submitQuiz.mutateAsync({
        presentationId: lessonId,
        answers: questions.map((_, index) => answers[index]),
      });
      setResult(attempt);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const retake = () => {
    setAnswers({});
    setResult(null);
  };

  return (
    <section id="quiz" aria-labelledby="quiz-title" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-foreground pb-3">
        <div className="max-w-xl">
          <h2 id="quiz-title" className="font-display text-2xl leading-tight">
            Check your understanding
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Finish the quiz to record your mastery — Smart Review schedules your next revision
            automatically.
          </p>
        </div>
        <Link
          href={`/dashboard/lesson/${lessonId}/play`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 shrink-0")}
        >
          <Mountain className="h-3.5 w-3.5" /> Play as a game
        </Link>
      </div>

      <ol>
        {questions.map((quizItem, questionIndex) => {
          const picked = answers[questionIndex];
          return (
            <li
              key={questionIndex}
              className="grid grid-cols-[2rem_1fr] gap-x-3 border-b border-foreground/20 py-6 sm:grid-cols-[2.5rem_1fr] sm:gap-x-4"
            >
              <span className="nums pt-1 font-mono text-sm text-primary">
                {String(questionIndex + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-[17px] font-medium leading-snug">{quizItem.question}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {quizItem.options.map((option, optionIndex) => {
                    const answer = result?.answerKey[questionIndex];
                    const isCorrect = graded && answer !== undefined && optionIndex === answer.correctIndex;
                    const isPicked = picked === optionIndex;
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        // Answers stay changeable until the quiz is submitted, and
                        // nothing is marked right or wrong before then — otherwise
                        // the score is decided by the first click and the answer
                        // key is on screen while you're still answering.
                        disabled={graded}
                        aria-pressed={isPicked}
                        onClick={() => setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }))}
                        className={cn(
                          "flex min-h-11 items-baseline gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                          !graded && isPicked && "border-foreground bg-foreground text-background",
                          !graded && !isPicked && "border-input hover:border-foreground",
                          graded && isCorrect && "border-accent bg-accent/10 text-foreground",
                          graded && isPicked && !isCorrect && "border-destructive bg-destructive/[0.07] text-foreground",
                          graded && !isPicked && !isCorrect && "border-border opacity-55"
                        )}
                      >
                        <span
                          className={cn(
                            "font-mono text-xs uppercase",
                            !graded && isPicked ? "text-background/70" : "text-muted-foreground",
                            graded && isCorrect && "text-accent",
                            graded && isPicked && !isCorrect && "text-destructive"
                          )}
                        >
                          {String.fromCharCode(97 + optionIndex)}.
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                {graded && result && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "mt-3 border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground",
                      picked === result.answerKey[questionIndex].correctIndex ? "border-accent" : "border-mark"
                    )}
                  >
                    <span className="font-semibold text-foreground">
                      {picked === result.answerKey[questionIndex].correctIndex ? "Correct — " : "Not quite — "}
                    </span>
                    {result.answerKey[questionIndex].explanation}
                  </motion.p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {result ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-6 flex flex-col gap-4 border-y-2 py-5 sm:flex-row sm:items-center sm:justify-between",
            result.passed ? "border-accent" : "border-amber"
          )}
        >
          <div className="flex items-baseline gap-5">
            <p className={cn("nums font-display text-5xl leading-none", result.passed ? "text-accent" : "text-amber")}>
              {result.scorePct}%
            </p>
            <div>
              <p className="nums font-medium">
                {result.score}/{result.total} correct
                {result.streak > 1 && (
                  <span className="label-mono ml-2 text-amber">· {result.streak}-day streak</span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.passed
                  ? `Locked in. Smart Review will bring this back on ${formatDate(result.nextReviewAt)} (${result.intervalDays} day${result.intervalDays === 1 ? "" : "s"}).`
                  : "Below 60% — this comes back tomorrow. A rewatch now will make it stick."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={retake}>
            Retake
          </Button>
        </motion.div>
      ) : (
        <Button
          variant="gradient"
          size="lg"
          className="mt-6 w-full"
          disabled={!allAnswered}
          loading={submitQuiz.isPending}
          onClick={finish}
        >
          {allAnswered ? "Finish quiz & schedule review" : "Answer every question to finish"}
        </Button>
      )}
    </section>
  );
}

export function LessonDetail({ lessonId }: { lessonId: string }) {
  const { data: lesson, isLoading, isError } = useLesson(lessonId);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [injectedQuestion, setInjectedQuestion] = useState<{ text: string; nonce: number } | null>(null);
  const [startingVideo, setStartingVideo] = useState(false);
  const [viewMode, setViewMode] = useState<"animated" | "board">("animated");

  // While the video is actively rendering, poll so the download section updates
  // itself when it's ready — the interactive lesson works meanwhile.
  const videoRendering = lesson?.status.video === "processing";
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!videoRendering) return;
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
    }, 8000);
    return () => clearInterval(timer);
  }, [videoRendering, lessonId, queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    );
  }

  if (isError || !lesson) {
    return <div className="border-y border-foreground py-12">
        <p className="label-mono">Missing page</p>
        <p className="mt-3 font-display text-2xl">This lesson could not be loaded.</p>
        <Link href="/dashboard/history" className="link-ink mt-3 inline-flex min-h-11 items-center text-sm font-medium">
          Back to your lessons
        </Link>
      </div>;
  }

  const videoUrl = staticUrl(lesson.assets.videoUrl);
  const slideImages = lesson.slides
    .map((slide) => staticUrl(slide.renderedImageUrl))
    .filter((url): url is string => Boolean(url));

  const available: Record<DownloadableAsset, boolean> = {
    video: Boolean(lesson.assets.videoUrl),
    ppt: Boolean(lesson.assets.pptUrl),
    pdf: Boolean(lesson.assets.pdfUrl),
    audio: Boolean(lesson.assets.audioUrl),
    subtitles: Boolean(lesson.assets.srtUrl),
  };

  const vttUrl = staticUrl(lesson.assets.vttUrl);
  const lessonLanguageLabel = LESSON_LANGUAGE_LABELS[lesson.language] ?? lesson.language;
  const ttsSpeed =
    lesson.profileSnapshot.pace === "slow" ? 0.9 : lesson.profileSnapshot.pace === "fast" ? 1.1 : 1;

  const videoReady = lesson.status.video === "ready" && Boolean(videoUrl);
  const videoProcessing = lesson.status.video === "processing";

  const triggerVideo = async () => {
    setStartingVideo(true);
    try {
      await generateVideo(lesson.id);
      queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setStartingVideo(false);
    }
  };

  const meta: string[] = [
    lesson.subject,
    `${titleCase(lesson.profileSnapshot.learningStyle)} learner · ${lesson.profileSnapshot.pace} pace`,
    ...(lesson.language !== "en" ? [lessonLanguageLabel] : []),
  ];

  return (
    <div className="space-y-12">
      <header className="border-b-2 border-foreground pb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-foreground/20 pb-2.5">
          <p className="label-mono flex-wrap">
            {meta.map((item, index) => (
              <span key={item} className="inline-flex items-center gap-2">
                {index > 0 && <span aria-hidden>·</span>}
                <span className={index === 0 ? "text-primary" : undefined}>{item}</span>
              </span>
            ))}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {lesson.language !== "en" && (
              <Badge variant="outline">
                <Languages className="h-3 w-3" aria-hidden /> {lessonLanguageLabel}
              </Badge>
            )}
            {lesson.hasAvatar && (
              <Badge variant="success">
                <UserRound className="h-3 w-3" aria-hidden /> AI presenter
              </Badge>
            )}
            {lesson.sourceFileName && (
              <Badge variant="outline">
                <FileText className="h-3 w-3" aria-hidden /> From {lesson.sourceFileName}
              </Badge>
            )}
          </div>
        </div>
        <h1 className="page-title mt-6 max-w-4xl text-balance">{lesson.title || lesson.topic}</h1>
        {lesson.summary && (
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {lesson.summary}
          </p>
        )}
      </header>

      {/* The lesson (primary) with its study notes + tutor beside it */}
      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-3">
        <figure className="min-w-0 space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="label-mono">
              <span className="text-primary">Fig. 1</span> The lesson
            </span>
          <div role="group" aria-label="Lesson view" className="inline-flex rounded-md border border-foreground p-0.5">
            {(
              [
                ["animated", "Animated video", Film],
                ["board", "Board", PresentationIcon],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          </div>
          {viewMode === "animated" ? (
            <AnimatedExplainer
              lesson={lesson}
              currentSlide={currentSlide}
              onSlideChange={setCurrentSlide}
              ttsSpeed={ttsSpeed}
            />
          ) : (
            <InteractiveLesson
              lesson={lesson}
              currentSlide={currentSlide}
              onSlideChange={setCurrentSlide}
              onAskTerm={(term) =>
                setInjectedQuestion({ text: `Explain "${term}" in simple terms.`, nonce: Date.now() })
              }
              onAskTutor={(text) => setInjectedQuestion({ text, nonce: Date.now() })}
              ttsSpeed={ttsSpeed}
            />
          )}
        </figure>
        <LessonSidePanel lesson={lesson} currentSlide={currentSlide} injected={injectedQuestion} />
      </div>

      <Quiz lessonId={lesson.id} questions={lesson.quiz} />

      {/* Downloadable video (secondary) — renders in the background */}
      <section aria-labelledby="downloads-title" className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="downloads-title" className="font-display text-2xl leading-tight">
            Take it with you
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {videoReady
              ? "Your narrated MP4 is ready — watch or download it here."
              : videoProcessing
                ? "Rendering your MP4 in the background — you can keep learning above. Refresh to check."
                : "The video for this lesson isn't available."}
          </p>
          {videoProcessing && (
            <div className="mt-4 border-l-2 border-mark pl-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                Building the video on the server — this can take a few minutes (longer if the AI
                presenter is enabled)…
              </p>
              {/*
                The server refuses to start a second render over a running one,
                so offering "Restart" here would silently do nothing. Re-checking
                is the action that's actually available.
              */}
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] })}
                className="link-ink mt-1 inline-flex min-h-11 items-center font-medium"
                type="button"
              >
                Check now
              </button>
            </div>
          )}
          {!videoReady && !videoProcessing && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {lesson.status.video === "failed"
                  ? "The video render didn't finish. You can try again."
                  : "The downloadable video hasn't been built yet."}
              </p>
              <Button variant="gradient" size="sm" className="min-h-11" onClick={triggerVideo} loading={startingVideo}>
                <Film className="h-3.5 w-3.5" /> Generate video
              </Button>
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-6 lg:col-span-8">
          {videoReady && videoUrl && (
            <div className="overflow-hidden rounded-lg border-2 border-foreground">
              <video
                controls
                preload="metadata"
                crossOrigin="anonymous"
                className="aspect-video w-full bg-black"
                src={videoUrl}
              >
                {vttUrl && (
                  <track
                    kind="subtitles"
                    src={vttUrl}
                    srcLang={lesson.language}
                    label={lessonLanguageLabel}
                    default
                  />
                )}
              </video>
            </div>
          )}
          <DownloadButtons lessonId={lesson.id} available={available} />
        </div>
      </section>

      <SlideCarousel images={slideImages} />
    </div>
  );
}
