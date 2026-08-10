"use client";

import { useEffect, useState } from "react";
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
  Presentation as PresentationIcon,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLesson } from "@/hooks/useLessons";
import { useSubmitQuiz } from "@/hooks/useLearning";
import { downloadLessonAsset, generateVideo, type DownloadableAsset } from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import { LESSON_LANGUAGE_LABELS, staticUrl } from "@/lib/constants";
import { cn, formatDate, titleCase } from "@/lib/utils";
import type { QuizAttemptResult } from "@/lib/types";
import { TutorChat } from "./TutorChat";
import { InteractiveLesson } from "./InteractiveLesson";

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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {DOWNLOADS.map(({ asset, label, icon: Icon, hint }) => (
        <Button
          key={asset}
          variant="outline"
          className="h-auto flex-col items-start gap-1 p-4"
          disabled={!available[asset]}
          loading={busy === asset}
          onClick={() => handleDownload(asset)}
        >
          <span className="flex w-full items-center justify-between">
            <Icon className="h-4 w-4 text-primary" />
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span className="font-semibold">{label}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {available[asset] ? hint : "Not generated"}
          </span>
        </Button>
      ))}
    </div>
  );
}

function SlideCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Slides</CardTitle>
        <span className="text-sm tabular-nums text-muted-foreground">
          {index + 1} / {images.length}
        </span>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-xl border border-border bg-black/40">
          <AnimatePresence mode="wait">
            <motion.img
              key={index}
              src={images[index]}
              alt={`Slide ${index + 1}`}
              className="aspect-video w-full object-contain"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            />
          </AnimatePresence>

          <div className="absolute inset-y-0 left-0 flex items-center pl-2">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full opacity-80"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full opacity-80"
              disabled={index === images.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, thumbIndex) => (
            <button
              key={image}
              type="button"
              onClick={() => setIndex(thumbIndex)}
              className={cn(
                "shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                thumbIndex === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={`Slide ${thumbIndex + 1} thumbnail`} className="h-14 w-24 object-cover" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Quiz({
  lessonId,
  questions,
}: {
  lessonId: string;
  questions: { question: string; options: string[]; correctIndex: number; explanation: string }[];
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
    <Card id="quiz">
      <CardHeader>
        <CardTitle>Check your understanding</CardTitle>
        <CardDescription>
          Finish the quiz to record your mastery — Smart Review schedules your next revision
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.map((quizItem, questionIndex) => {
          const picked = answers[questionIndex];
          return (
            <div key={questionIndex}>
              <p className="mb-3 font-medium">
                {questionIndex + 1}. {quizItem.question}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {quizItem.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === quizItem.correctIndex;
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
                      onClick={() => setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }))}
                      className={cn(
                        "rounded-xl border p-3 text-left text-sm transition-colors",
                        !graded && isPicked && "border-primary bg-primary/10",
                        !graded && !isPicked && "border-border hover:border-primary/60 hover:bg-muted/40",
                        graded && isCorrect && "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
                        graded && isPicked && !isCorrect && "border-destructive/60 bg-destructive/10 text-red-300",
                        graded && !isPicked && !isCorrect && "border-border opacity-50"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {graded && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"
                >
                  {picked === quizItem.correctIndex ? "Correct — " : "Not quite — "}
                  {quizItem.explanation}
                </motion.p>
              )}
            </div>
          );
        })}

        {result ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              result.passed ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10"
            )}
          >
            <div>
              <p className="font-semibold">
                {result.score}/{result.total} correct ({result.scorePct}%)
                {result.streak > 1 && ` · 🔥 ${result.streak}-day streak`}
              </p>
              <p className="text-sm text-muted-foreground">
                {result.passed
                  ? `Locked in. Smart Review will bring this back on ${formatDate(result.nextReviewAt)} (${result.intervalDays} day${result.intervalDays === 1 ? "" : "s"}).`
                  : "Below 60% — this comes back tomorrow. A rewatch now will make it stick."}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={retake}>
              Retake
            </Button>
          </motion.div>
        ) : (
          <Button
            variant="gradient"
            className="w-full"
            disabled={!allAnswered}
            loading={submitQuiz.isPending}
            onClick={finish}
          >
            {allAnswered ? "Finish quiz & schedule review" : "Answer every question to finish"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function LessonDetail({ lessonId }: { lessonId: string }) {
  const { data: lesson, isLoading, isError } = useLesson(lessonId);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [injectedQuestion, setInjectedQuestion] = useState<{ text: string; nonce: number } | null>(null);
  const [startingVideo, setStartingVideo] = useState(false);

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
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="aspect-video w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !lesson) {
    return <p className="py-16 text-center text-muted-foreground">This lesson could not be loaded.</p>;
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

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{lesson.subject}</Badge>
          <Badge variant="outline">
            {titleCase(lesson.profileSnapshot.learningStyle)} learner · {lesson.profileSnapshot.pace} pace
          </Badge>
          {lesson.language !== "en" && (
            <Badge variant="outline">
              <Languages className="h-3 w-3" /> {lessonLanguageLabel}
            </Badge>
          )}
          {lesson.hasAvatar && (
            <Badge variant="success">
              <UserRound className="h-3 w-3" /> AI presenter
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{lesson.title || lesson.topic}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{lesson.summary}</p>
      </div>

      {/* Interactive lesson (primary) + tutor, side by side */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InteractiveLesson
            lesson={lesson}
            currentSlide={currentSlide}
            onSlideChange={setCurrentSlide}
            onAskTerm={(term) =>
              setInjectedQuestion({ text: `Explain "${term}" in simple terms.`, nonce: Date.now() })
            }
            ttsSpeed={ttsSpeed}
          />
        </div>
        <TutorChat
          lessonId={lesson.id}
          currentSlideIndex={currentSlide}
          currentSlideTitle={lesson.slides[currentSlide]?.title ?? null}
          injected={injectedQuestion}
        />
      </div>

      <Quiz lessonId={lesson.id} questions={lesson.quiz} />

      {/* Downloadable video (secondary) — renders in the background */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Downloadable video</CardTitle>
          <CardDescription>
            {videoReady
              ? "Your narrated MP4 is ready — watch or download it below."
              : videoProcessing
                ? "Rendering your MP4 in the background — you can keep learning above. Refresh to check."
                : "The video for this lesson isn't available."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {videoReady && videoUrl && (
            <div className="overflow-hidden rounded-xl">
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
          {videoProcessing && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Building the video on the server — this can take a few minutes
              {lesson.hasAvatar ? " (longer with the AI presenter)" : ""}…
              {/*
                The server refuses to start a second render over a running one,
                so offering "Restart" here would silently do nothing. Re-checking
                is the action that's actually available.
              */}
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] })}
                className="ml-auto text-primary hover:underline"
                type="button"
              >
                Check now
              </button>
            </div>
          )}
          {!videoReady && !videoProcessing && (
            <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {lesson.status.video === "failed"
                  ? "The video render didn't finish. You can try again."
                  : "The downloadable video hasn't been built yet."}
              </p>
              <Button variant="gradient" size="sm" onClick={triggerVideo} loading={startingVideo}>
                <Film className="h-3.5 w-3.5" /> Generate video
              </Button>
            </div>
          )}
          <DownloadButtons lessonId={lesson.id} available={available} />
        </CardContent>
      </Card>

      <SlideCarousel images={slideImages} />
    </div>
  );
}
