"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  Captions as CaptionsIcon,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Presentation as PresentationIcon,
  Repeat,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { staticUrl } from "@/lib/constants";
import { useSpeech } from "@/hooks/useSpeech";
import { chunkScript } from "@/features/video/Captions";
import type { PresentationDetail, SlideView } from "@/lib/types";
import { BoardSlideView, useBoardEvents } from "./BoardSlideView";
import { TeachBack, coveredKeys, teachItemsFor } from "./TeachBack";

/**
 * Board items are written at timestamps, so the player needs a clock rather than
 * a step counter. Updating it every animation frame would re-render the board
 * ~60×/s for no visible gain: at 12/s the writing still lands on the right word,
 * and the work drops five-fold.
 */
const CLOCK_INTERVAL_SEC = 0.08;

/** Nothing has played yet — show the finished board so the slide is readable. */
const SHOW_ALL = Number.POSITIVE_INFINITY;

const RATES = [0.75, 1, 1.25, 1.5];
const SEEK_STEP_SEC = 5;
const SENTENCE_END = /[.!?।…]["')\]]?$/;

/** Fallback narration length for slides with no synthesized audio. */
function estimateDuration(script: string, ttsSpeed: number): number {
  const words = script.split(/\s+/).filter(Boolean).length;
  return Math.max(4, words / (2.5 * Math.max(0.5, ttsSpeed)));
}

const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

interface InteractiveLessonProps {
  lesson: PresentationDetail;
  /** Current slide index (lifted so the tutor knows what's on screen). */
  currentSlide: number;
  onSlideChange: (index: number) => void;
  onAskTerm: (term: string) => void;
  /** Sends a ready-made question to the tutor (teach-back feedback). */
  onAskTutor: (question: string) => void;
  ttsSpeed: number;
}

/**
 * The interactive, self-paced lesson: the board is written in time with the
 * narration. Narration uses the premium ElevenLabs track when present, else the
 * free browser voice — so the lesson is fully playable the instant content
 * exists, with no video render to wait for.
 */
export function InteractiveLesson(props: InteractiveLessonProps) {
  if (props.lesson.slides.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          This lesson has no slides yet.
        </CardContent>
      </Card>
    );
  }
  return <BoardPlayer {...props} />;
}

function BoardPlayer({
  lesson,
  currentSlide: requestedSlide,
  onSlideChange,
  onAskTerm,
  onAskTutor,
  ttsSpeed,
}: InteractiveLessonProps) {
  const slides = lesson.slides;
  // Clamp: the index is owned by the parent, so a shorter lesson (or an index
  // carried over from a previous one) must not read past the end and crash.
  const currentSlide = Math.min(Math.max(0, requestedSlide), slides.length - 1);
  const slide = slides[currentSlide] as SlideView;

  const [elapsed, setElapsed] = useState(SHOW_ALL);
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [captionsOn, setCaptionsOn] = useState(true);
  /** Bumped to restart narration in place (seek or speed change on the browser voice, replay). */
  const [playNonce, setPlayNonce] = useState(0);

  // Teach-back: the board is wiped and rebuilt from the learner's own explanation.
  const [teaching, setTeaching] = useState(false);
  const [teachText, setTeachText] = useState("");
  const [teachInterim, setTeachInterim] = useState("");
  const [teachChecked, setTeachChecked] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<number | null>(null);
  /** Which slide the narration is positioned in, for resume-vs-restart. */
  const playedSlideRef = useRef<number | null>(null);
  /** Where in the slide narration should (re)start — kept current by the clock. */
  const resumeAtRef = useRef(0);
  const { supported: ttsSupported, speak, cancel: cancelSpeech } = useSpeech();

  const audioUrl = staticUrl(slide.audioUrl);
  const usingPremiumVoice = Boolean(audioUrl);

  const estimatedDuration = useMemo(() => estimateDuration(slide.script, ttsSpeed), [slide, ttsSpeed]);

  // What the board rescales its timeline against: the real audio length when we
  // have it, the stored probe next, and only then an estimate.
  const durationSec = usingPremiumVoice
    ? audioDuration ?? slide.audioDurationSec ?? estimatedDuration
    : estimatedDuration;

  const events = useBoardEvents(slide, durationSec);
  const captionChunks = useMemo(() => chunkScript(slide.script), [slide.script]);

  const teachItems = useMemo(() => teachItemsFor(slide), [slide]);
  const teachCovered = useMemo(
    () => coveredKeys(teachItems, `${teachText} ${teachInterim}`),
    [teachItems, teachText, teachInterim]
  );
  const teach = useMemo(
    () => (teaching ? { covered: teachCovered, revealMissed: teachChecked } : undefined),
    [teaching, teachCovered, teachChecked]
  );
  const resetTeach = () => {
    setTeachText("");
    setTeachInterim("");
    setTeachChecked(false);
  };

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
      playedSlideRef.current = null;
      resumeAtRef.current = 0;
      // Browsing to a slide you're not playing should show it complete.
      setElapsed(SHOW_ALL);
      onSlideChange(index);
    },
    [slides.length, stopNarration, onSlideChange]
  );

  const handleNarrationEnd = useCallback(() => {
    stopClock();
    playedSlideRef.current = null;
    resumeAtRef.current = 0;
    setElapsed(SHOW_ALL);
    if (autoAdvance && currentSlide < slides.length - 1) {
      onSlideChange(currentSlide + 1);
    } else {
      setPlaying(false);
    }
  }, [autoAdvance, stopClock, currentSlide, onSlideChange, slides.length]);
  // The browser voice holds its end callback for the whole slide, so it must
  // see the latest auto-play setting rather than the one from when it started.
  const narrationEndRef = useRef(handleNarrationEnd);
  narrationEndRef.current = handleNarrationEnd;

  // A new slide's audio element needs its duration re-read.
  useEffect(() => {
    setAudioDuration(null);
    // Each slide is explained from scratch.
    setTeachText("");
    setTeachInterim("");
    setTeachChecked(false);
  }, [currentSlide]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, audioUrl]);

  // Drive narration + the board clock whenever the slide changes while playing.
  useEffect(() => {
    if (!playing) return;

    let cancelled = false;
    const fresh = playedSlideRef.current !== currentSlide;
    const startAt = fresh ? 0 : resumeAtRef.current;
    playedSlideRef.current = currentSlide;

    // Throttle state updates without giving up rAF's frame alignment.
    let lastPublished = -1;
    const publish = (seconds: number) => {
      resumeAtRef.current = seconds;
      if (Math.abs(seconds - lastPublished) < CLOCK_INTERVAL_SEC) return;
      lastPublished = seconds;
      setElapsed(seconds);
    };

    if (usingPremiumVoice && audioRef.current) {
      const audio = audioRef.current;
      // Resuming the same slide continues where it stopped; a new slide starts
      // from the top. Restarting on resume would erase a board the learner
      // paused specifically to read.
      if (Math.abs(audio.currentTime - startAt) > 0.25) audio.currentTime = startAt;
      audio.playbackRate = rate;
      setElapsed(startAt);
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
      // The free browser voice can't be seeked or resumed, so pick up from the
      // start of the sentence the position falls in and run our own clock
      // against the same estimated duration the board's timeline was scaled to.
      const words = slide.script.split(/\s+/).filter(Boolean);
      let wordIndex = Math.min(
        Math.max(0, words.length - 1),
        Math.floor((startAt / Math.max(0.001, estimatedDuration)) * words.length)
      );
      while (wordIndex > 0 && !SENTENCE_END.test(words[wordIndex - 1])) wordIndex -= 1;
      const offset = words.length > 0 ? (wordIndex / words.length) * estimatedDuration : 0;

      setElapsed(offset);
      resumeAtRef.current = offset;
      const startedAt = performance.now();
      const tick = () => {
        if (cancelled) return;
        publish(offset + ((performance.now() - startedAt) / 1000) * rate);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
      speak(words.slice(wordIndex).join(" "), {
        onEnd: () => narrationEndRef.current(),
        rate: ttsSpeed * rate,
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
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide, playing, playNonce]);

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

  /** Moves within the slide. `play` starts narration from there if it was stopped. */
  const seekTo = (seconds: number, play = false) => {
    const target = Math.min(Math.max(0, seconds), Math.max(0, durationSec - 0.1));
    resumeAtRef.current = target;
    playedSlideRef.current = currentSlide;
    setElapsed(target);
    if (usingPremiumVoice && audioRef.current) audioRef.current.currentTime = target;
    if (playing) {
      // The audio element just follows currentTime; the browser voice has to be restarted.
      if (!usingPremiumVoice) setPlayNonce((n) => n + 1);
    } else if (play) {
      setPlaying(true);
    }
  };

  const replay = () => {
    playedSlideRef.current = null;
    resumeAtRef.current = 0;
    setElapsed(0);
    if (playing) setPlayNonce((n) => n + 1);
    else setPlaying(true);
  };

  const cycleRate = () => {
    setRate((current) => RATES[(RATES.indexOf(current) + 1) % RATES.length]);
    if (playing && !usingPremiumVoice) setPlayNonce((n) => n + 1);
  };

  const finished = elapsed === SHOW_ALL;
  const position = finished ? durationSec : Math.min(elapsed, durationSec);
  const slideProgress = durationSec > 0 ? position / durationSec : 0;

  const onBarPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo(((event.clientX - rect.left) / rect.width) * durationSec);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (teaching || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = (event.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const key = event.key.toLowerCase();
    // Space on a focused button already clicks it.
    if (key === "k" || (key === " " && tag !== "BUTTON")) {
      event.preventDefault();
      togglePlay();
    } else if (key === "arrowright") {
      event.preventDefault();
      seekTo(position + SEEK_STEP_SEC);
    } else if (key === "arrowleft") {
      event.preventDefault();
      seekTo(position - SEEK_STEP_SEC);
    } else if (key === "c") {
      setCaptionsOn((on) => !on);
    }
  };

  // The line being spoken, with the words already said lit.
  const caption = captionChunks.find((chunk) => slideProgress < chunk.to) ?? captionChunks[captionChunks.length - 1];
  const litWords = caption
    ? Math.floor(
        Math.min(1, Math.max(0, (slideProgress - caption.from) / Math.max(0.0001, caption.to - caption.from))) *
          caption.words.length
      )
    : 0;

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <CardContent
          className="p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
          tabIndex={0}
          onKeyDown={onKey}
          aria-label={`Board lesson: ${slide.title}`}
        >
          <BoardSlideView
            slide={slide}
            elapsed={elapsed}
            durationSec={durationSec}
            onTermClick={onAskTerm}
            // Start a beat early so the item is seen being written again.
            onReplayFrom={(seconds) => {
              setTeaching(false);
              seekTo(seconds - 0.4, true);
            }}
            teach={teach}
          />

          {teaching && (
            <TeachBack
              key={currentSlide}
              slideTitle={slide.title}
              locale={lesson.boardLanguageLocale || lesson.languageLocale}
              total={teachItems.length}
              coveredCount={teachCovered.size}
              text={teachText}
              onTextChange={setTeachText}
              onInterimChange={setTeachInterim}
              checked={teachChecked}
              onCheck={() => setTeachChecked(true)}
              onRetry={resetTeach}
              onExit={() => setTeaching(false)}
              onAskTutor={onAskTutor}
            />
          )}

          {!teaching && captionsOn && (
            <p className="mt-3 flex min-h-[3.75rem] items-center border-l-2 border-mark bg-foreground/[0.04] px-4 py-2 text-[15px] leading-relaxed">
              {finished || !caption ? (
                <span className="text-sm text-muted-foreground">
                  Press play and the board is written as it&apos;s explained. Tap a key term to ask the
                  tutor, or any note or diagram box to hear that part again.
                </span>
              ) : (
                <span>
                  {caption.words.map((word, i) => (
                    <span
                      key={i}
                      className={cn(
                        "transition-colors duration-150",
                        i < litWords
                          ? "text-foreground"
                          : i === litWords
                            ? "font-semibold text-primary"
                            : "text-muted-foreground/70"
                      )}
                    >
                      {word}{" "}
                    </span>
                  ))}
                </span>
              )}
            </p>
          )}

          {/* Controls */}
          <div className={cn("mt-4 space-y-2", teaching && "hidden")}>
            <div className="flex items-center gap-3">
              <div
                className="relative h-6 flex-1 cursor-pointer touch-none"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onBarPointer(event);
                }}
                onPointerMove={(event) => {
                  if (event.buttons === 1) onBarPointer(event);
                }}
                role="slider"
                aria-label="Position in this slide"
                aria-valuemin={0}
                aria-valuemax={Math.round(durationSec)}
                aria-valuenow={Math.round(position)}
                aria-valuetext={`${clock(position)} of ${clock(durationSec)}`}
              >
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-foreground/10">
                  <div className="h-full bg-primary" style={{ width: `${slideProgress * 100}%` }} />
                </div>
                {/* One tick per board item, at the moment it gets written. */}
                {durationSec > 0 &&
                  events.map((event) => (
                    <span
                      key={event.key}
                      aria-hidden
                      className={cn(
                        "absolute top-1/2 h-3 w-0.5 -translate-y-1/2",
                        event.at <= position ? "bg-primary" : "bg-foreground/40"
                      )}
                      style={{ left: `${Math.min(100, (event.at / durationSec) * 100)}%` }}
                    />
                  ))}
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
                  style={{ left: `${slideProgress * 100}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {clock(position)} / {clock(durationSec)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => goTo(currentSlide - 1)}
                  disabled={currentSlide === 0}
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="gradient"
                  size="icon"
                  className="h-11 w-11"
                  onClick={togglePlay}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={replay} aria-label="Replay slide">
                  <Repeat className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => goTo(currentSlide + 1)}
                  disabled={currentSlide === slides.length - 1}
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {teachItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    title="Wipe the board and explain this slide yourself"
                    onClick={() => {
                      stopNarration();
                      setPlaying(false);
                      resetTeach();
                      setTeaching(true);
                    }}
                  >
                    <PresentationIcon className="h-3.5 w-3.5" /> Teach it back
                  </Button>
                )}
                <span className="tabular-nums">
                  Slide {currentSlide + 1} / {slides.length}
                </span>
                <Badge variant={usingPremiumVoice ? "success" : "outline"} className="gap-1">
                  <Volume2 className="h-3 w-3" />
                  {usingPremiumVoice ? "AI voice" : ttsSupported ? "Browser voice" : "No voice"}
                </Badge>
                <button
                  type="button"
                  onClick={cycleRate}
                  aria-label={`Playback speed ${rate}×`}
                  title="Playback speed"
                  className="flex min-h-11 min-w-12 items-center justify-center rounded-sm border border-input px-2 font-mono tabular-nums text-foreground transition-colors hover:border-foreground"
                >
                  {rate}×
                </button>
                <button
                  type="button"
                  onClick={() => setCaptionsOn((on) => !on)}
                  aria-pressed={captionsOn}
                  aria-label="Captions"
                  title="Captions"
                  className={cn(
                    "flex min-h-11 min-w-11 items-center justify-center rounded-sm border transition-colors",
                    captionsOn ? "border-foreground bg-foreground text-background" : "border-input hover:border-foreground"
                  )}
                >
                  <CaptionsIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAutoAdvance((v) => !v)}
                  aria-pressed={autoAdvance}
                  className={cn(
                    "flex min-h-11 items-center rounded-sm border px-2.5 py-1 font-mono uppercase tracking-wider transition-colors",
                    autoAdvance ? "border-foreground bg-foreground text-background" : "border-input"
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
            aria-label={`Slide ${i + 1}: ${s.title}`}
            className="flex min-h-11 flex-1 items-center py-1"
          >
            <span
              className={cn(
                "h-1.5 w-full transition-colors",
                i < currentSlide ? "bg-foreground/60" : i === currentSlide ? "bg-mark" : "bg-foreground/15"
              )}
            />
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Space play/pause · ← → skip 5s · C captions</p>
    </div>
  );
}
