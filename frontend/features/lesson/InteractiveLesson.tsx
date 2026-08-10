"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { staticUrl } from "@/lib/constants";
import { useSpeech } from "@/hooks/useSpeech";
import type { PresentationDetail, SlideView } from "@/lib/types";
import { BoardSlideView } from "./BoardSlideView";

/**
 * Board items are written at timestamps, so the player needs a clock rather than
 * a step counter. Updating it every animation frame would re-render the board
 * ~60×/s for no visible gain: at 12/s the writing still lands on the right word,
 * and the work drops five-fold.
 */
const CLOCK_INTERVAL_SEC = 0.08;

/** Nothing has played yet — show the finished board so the slide is readable. */
const SHOW_ALL = Number.POSITIVE_INFINITY;

/** Fallback narration length for slides with no synthesized audio. */
function estimateDuration(script: string, ttsSpeed: number): number {
  const words = script.split(/\s+/).filter(Boolean).length;
  return Math.max(4, words / (2.5 * Math.max(0.5, ttsSpeed)));
}

interface InteractiveLessonProps {
  lesson: PresentationDetail;
  /** Current slide index (lifted so the tutor knows what's on screen). */
  currentSlide: number;
  onSlideChange: (index: number) => void;
  onAskTerm: (term: string) => void;
  ttsSpeed: number;
}

/**
 * The interactive, self-paced lesson: the board is written in time with the
 * narration. Narration uses the premium ElevenLabs track when present, else the
 * free browser voice — so the lesson is fully playable the instant content
 * exists, with no video render to wait for.
 */
export function InteractiveLesson({
  lesson,
  currentSlide: requestedSlide,
  onSlideChange,
  onAskTerm,
  ttsSpeed,
}: InteractiveLessonProps) {
  const slides = lesson.slides;
  // Clamp: the index is owned by the parent, so a shorter lesson (or an index
  // carried over from a previous one) must not read past the end and crash.
  const currentSlide = Math.min(Math.max(0, requestedSlide), Math.max(0, slides.length - 1));
  const slide = slides[currentSlide] as SlideView | undefined;

  const [elapsed, setElapsed] = useState(SHOW_ALL);
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<number | null>(null);
  /** Which slide the audio element is currently positioned in, for resume-vs-restart. */
  const playedSlideRef = useRef<number | null>(null);
  const { supported: ttsSupported, speak, cancel: cancelSpeech } = useSpeech();

  const audioUrl = slide ? staticUrl(slide.audioUrl) : null;
  const usingPremiumVoice = Boolean(audioUrl);

  const estimatedDuration = useMemo(
    () => (slide ? estimateDuration(slide.script, ttsSpeed) : 0),
    [slide, ttsSpeed]
  );

  // What the board rescales its timeline against: the real audio length when we
  // have it, the stored probe next, and only then an estimate.
  const durationSec = usingPremiumVoice
    ? audioDuration ?? slide?.audioDurationSec ?? estimatedDuration
    : estimatedDuration;

  const stopClock = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const stopNarration = useCallback(() => {
    stopClock();
    audioRef.current?.pause();
    cancelSpeech();
  }, [cancelSpeech, stopClock]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length) return;
      stopNarration();
      setPlaying(false);
      // Browsing to a slide you're not playing should show it complete.
      setElapsed(SHOW_ALL);
      onSlideChange(index);
    },
    [slides.length, stopNarration, onSlideChange]
  );

  const handleNarrationEnd = useCallback(() => {
    stopClock();
    setElapsed(SHOW_ALL);
    if (autoAdvance && currentSlide < slides.length - 1) {
      onSlideChange(currentSlide + 1);
    } else {
      setPlaying(false);
    }
  }, [autoAdvance, stopClock, currentSlide, onSlideChange, slides.length]);

  // A new slide's audio element needs its duration re-read.
  useEffect(() => {
    setAudioDuration(null);
  }, [currentSlide]);

  // Drive narration + the board clock whenever the slide changes while playing.
  useEffect(() => {
    if (!playing || !slide) return;

    let cancelled = false;
    // Throttle state updates without giving up rAF's frame alignment.
    let lastPublished = -1;
    const publish = (seconds: number) => {
      if (Math.abs(seconds - lastPublished) < CLOCK_INTERVAL_SEC) return;
      lastPublished = seconds;
      setElapsed(seconds);
    };

    if (usingPremiumVoice && audioRef.current) {
      const audio = audioRef.current;
      // Resuming the same slide continues where it stopped; a new slide starts
      // from the top. Restarting on resume would erase a board the learner
      // paused specifically to read.
      if (playedSlideRef.current !== currentSlide) {
        audio.currentTime = 0;
        setElapsed(0);
      }
      playedSlideRef.current = currentSlide;
      void audio.play().catch(() => setPlaying(false));

      const tick = () => {
        if (cancelled) return;
        publish(audio.currentTime);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
      return () => {
        cancelled = true;
        stopClock();
        audio.pause();
      };
    }

    if (ttsSupported) {
      // Free browser voice gives no position, so run our own clock against the
      // same estimated duration the board's timeline was scaled to.
      setElapsed(0);
      playedSlideRef.current = currentSlide;
      const startedAt = performance.now();
      const tick = () => {
        if (cancelled) return;
        publish((performance.now() - startedAt) / 1000);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
      speak(slide.script, {
        onEnd: handleNarrationEnd,
        rate: ttsSpeed,
        locale: lesson.languageLocale,
      });
      return () => {
        cancelled = true;
        stopClock();
        cancelSpeech();
      };
    }

    // No narration available at all — just show the finished board.
    setElapsed(SHOW_ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide, playing]);

  // Cleanup on unmount.
  useEffect(() => stopNarration, [stopNarration]);

  const togglePlay = () => {
    if (playing) {
      stopNarration();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  const replay = () => {
    stopNarration();
    playedSlideRef.current = null;
    setElapsed(0);
    setPlaying(false);
    // next tick re-triggers the play effect
    requestAnimationFrame(() => setPlaying(true));
  };

  const slideProgress =
    elapsed === SHOW_ALL ? 1 : durationSec > 0 ? Math.min(1, elapsed / durationSec) : 0;
  const progressPct = ((currentSlide + slideProgress) / Math.max(1, slides.length)) * 100;

  if (!slide) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          This lesson has no slides yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <BoardSlideView
            slide={slide}
            elapsed={elapsed}
            durationSec={durationSec}
            onTermClick={onAskTerm}
          />

          {/* Controls */}
          <div className="mt-4 space-y-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-gradient transition-all duration-150"
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => goTo(currentSlide - 1)}
                  disabled={currentSlide === 0}
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button variant="gradient" size="icon" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={replay} aria-label="Replay slide">
                  <Repeat className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => goTo(currentSlide + 1)}
                  disabled={currentSlide === slides.length - 1}
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  Slide {currentSlide + 1} / {slides.length}
                </span>
                <Badge variant={usingPremiumVoice ? "success" : "outline"} className="gap-1">
                  <Volume2 className="h-3 w-3" />
                  {usingPremiumVoice ? "AI voice" : ttsSupported ? "Browser voice" : "No voice"}
                </Badge>
                <button
                  type="button"
                  onClick={() => setAutoAdvance((v) => !v)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 transition-colors",
                    autoAdvance ? "border-primary/50 text-primary" : "border-border"
                  )}
                >
                  Auto-play {autoAdvance ? "on" : "off"}
                </button>
              </div>
            </div>
          </div>

          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="auto"
              onLoadedMetadata={(event) => {
                const value = event.currentTarget.duration;
                // Streamed mp3s can report Infinity until fully buffered.
                if (Number.isFinite(value) && value > 0) setAudioDuration(value);
              }}
              onEnded={handleNarrationEnd}
              className="hidden"
            />
          )}
        </CardContent>
      </Card>

      {/* Slide dots */}
      <div className="flex flex-wrap gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.index}
            type="button"
            onClick={() => goTo(i)}
            title={s.title}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              i < currentSlide ? "bg-primary/60" : i === currentSlide ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}
