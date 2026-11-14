"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Captions as CaptionsIcon,
  ListChecks,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { staticUrl } from "@/lib/constants";
import type { PresentationDetail } from "@/lib/types";
import { Captions } from "./Captions";
import { ChapterRecap, EndCard, recapFor } from "./ChapterRecap";
import { Scene } from "./scenes";
import { EXPLAINER_CSS } from "./styles";
import { themeFor } from "./theme";
import { usePlayback } from "./usePlayback";

const RATES = [0.75, 1, 1.25, 1.5];
/** Fallback narration length for slides with no synthesized audio. */
const estimate = (script: string, ttsSpeed: number) =>
  Math.max(5, script.split(/\s+/).filter(Boolean).length / (2.5 * Math.max(0.5, ttsSpeed)));

const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

interface AnimatedExplainerProps {
  lesson: PresentationDetail;
  currentSlide: number;
  onSlideChange: (index: number) => void;
  ttsSpeed: number;
}

/**
 * A fully animated explainer built from the lesson: no slides on screen. Each
 * chapter is a staged scene (animated world, a presenter, illustrated points,
 * moving diagrams, live captions) timed to the narration, with YouTube-style
 * controls. It renders in the browser, so it's playable the moment the lesson
 * exists — no video render to wait for.
 */
export function AnimatedExplainer({ lesson, currentSlide, onSlideChange, ttsSpeed }: AnimatedExplainerProps) {
  const slides = lesson.slides;
  const scene = Math.min(Math.max(0, currentSlide), Math.max(0, slides.length - 1));

  const durations = useMemo(
    () => slides.map((s) => (s.audioUrl && s.audioDurationSec ? s.audioDurationSec : estimate(s.script, ttsSpeed))),
    [slides, ttsSpeed],
  );
  const audioUrls = useMemo(() => slides.map((s) => staticUrl(s.audioUrl)), [slides]);
  const scripts = useMemo(() => slides.map((s) => s.script), [slides]);
  const starts = useMemo(() => {
    let acc = 0;
    return durations.map((d) => {
      const at = acc;
      acc += d;
      return at;
    });
  }, [durations]);
  const total = durations.reduce((a, b) => a + b, 0);

  // Stop after each chapter to recap and ask one question — on unless switched off.
  const [checkIns, setCheckIns] = useState(true);
  const recaps = useMemo(() => slides.map(recapFor), [slides]);
  const holdAtEnd = useCallback((index: number) => checkIns && recaps[index] !== null, [checkIns, recaps]);

  const pb = usePlayback({
    durations,
    audioUrls,
    scripts,
    scene,
    onSceneChange: onSlideChange,
    ttsSpeed,
    locale: lesson.languageLocale,
    holdAtEnd,
  });

  const [captionsOn, setCaptionsOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const slide = slides[scene];
  const D = durations[scene] ?? 0;
  // Before first play the scene shows a "poster" frame instead of its empty opening.
  const t = pb.elapsed ?? D * 0.62;
  const progress = D > 0 ? Math.min(1, t / D) : 0;
  const globalTime = (starts[scene] ?? 0) + Math.min(t, D);
  const started = pb.elapsed !== null;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  }, []);

  const seekGlobal = useCallback(
    (sec: number) => {
      const clamped = Math.min(Math.max(0, sec), Math.max(0, total - 0.01));
      let idx = starts.findIndex((s, i) => clamped >= s && clamped < s + durations[i]);
      if (idx < 0) idx = slides.length - 1;
      pb.seek(idx, clamped - starts[idx]);
    },
    [total, starts, durations, slides.length, pb],
  );

  const onBarPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekGlobal(((e.clientX - rect.left) / rect.width) * total);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key.toLowerCase()) {
      case " ":
      case "k":
        e.preventDefault();
        pb.toggle();
        break;
      case "arrowright":
      case "l":
        e.preventDefault();
        seekGlobal(globalTime + 5);
        break;
      case "arrowleft":
      case "j":
        e.preventDefault();
        seekGlobal(globalTime - 5);
        break;
      case "f":
        toggleFullscreen();
        break;
      case "m":
        pb.setMuted((m) => !m);
        break;
      case "c":
        setCaptionsOn((c) => !c);
        break;
    }
  };

  if (!slide) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        This lesson has no slides yet.
      </div>
    );
  }

  const theme = themeFor(scene);
  const sceneProps = {
    slide,
    lessonTitle: lesson.title || lesson.topic,
    index: scene,
    total: slides.length,
    theme,
    t,
    D,
    speaking: pb.playing && !pb.ended,
  };

  return (
    <div className="space-y-3">
      <style>{EXPLAINER_CSS}</style>
      <div
        ref={wrapRef}
        tabIndex={0}
        onKeyDown={onKey}
        className={cn(
          "overflow-hidden rounded-2xl bg-black shadow-float outline-none ring-1 ring-black/20 focus-visible:ring-2 focus-visible:ring-ring",
          fullscreen && "flex h-screen flex-col justify-center rounded-none",
        )}
      >
        {pb.audioUrl && <audio ref={pb.audioRef} src={pb.audioUrl} preload="auto" onEnded={pb.onAudioEnded} />}

        {/* ── Stage ─────────────────────────────────────────────────────── */}
        <div
          className="xv-root relative mx-auto aspect-video w-full cursor-pointer select-none overflow-hidden"
          data-paused={!pb.playing}
          style={fullscreen ? { width: "min(100%, calc((100vh - 3.5rem) * 16 / 9))" } : undefined}
          onClick={pb.toggle}
          role="img"
          aria-label={`Animated lesson: ${slide.title}`}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={scene}
              className="absolute inset-0"
              initial={{ clipPath: "circle(0% at 50% 55%)" }}
              animate={{ clipPath: "circle(150% at 50% 55%)" }}
              exit={{ opacity: 1, transition: { duration: 0.8 } }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <Scene {...sceneProps} />
            </motion.div>
          </AnimatePresence>

          {captionsOn && started && !pb.ended && !pb.held && <Captions script={slide.script} progress={progress} theme={theme} />}

          <AnimatePresence>
            {pb.held && recaps[scene] && (
              <ChapterRecap
                key={`recap-${scene}`}
                recap={recaps[scene]!}
                theme={theme}
                chapter={scene}
                total={slides.length}
                nextTitle={slides[scene + 1]?.title ?? null}
                onContinue={pb.continueNext}
                onRewatch={pb.replayScene}
              />
            )}
            {pb.ended && (
              <EndCard
                key="end"
                theme={theme}
                chapters={slides.map((s) => s.title)}
                hasQuiz={(lesson.quiz?.length ?? 0) > 0}
                onReplay={pb.toggle}
                onJump={pb.playScene}
              />
            )}
            {!pb.playing && !pb.ended && !pb.held && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 grid place-items-center bg-black/25"
              >
                <motion.span
                  whileHover={{ scale: 1.08 }}
                  className="grid h-[9cqw] w-[9cqw] place-items-center rounded-full bg-white/95 text-slate-900 shadow-2xl"
                >
                  <Play style={{ width: "4cqw", height: "4cqw", marginLeft: "0.6cqw" }} className="fill-current" />
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Controls ──────────────────────────────────────────────────── */}
        <div className="bg-neutral-950 px-3 pb-2 pt-3 text-white">
          <div
            className="group relative h-4 cursor-pointer touch-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onBarPointer(e);
            }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoverPct(((e.clientX - rect.left) / rect.width) * 100);
              if (e.buttons === 1) onBarPointer(e);
            }}
            onPointerLeave={() => setHoverPct(null)}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(total)}
            aria-valuenow={Math.round(globalTime)}
          >
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-all group-hover:h-1.5">
              <div
                className="h-full rounded-full bg-brand-gradient"
                style={{ width: `${total ? (globalTime / total) * 100 : 0}%` }}
              />
            </div>
            {starts.slice(1).map((s, i) => (
              <span
                key={i}
                className="absolute top-1/2 h-1.5 w-0.5 -translate-y-1/2 bg-neutral-950"
                style={{ left: `${(s / total) * 100}%` }}
              />
            ))}
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `${total ? (globalTime / total) * 100 : 0}%` }}
            />
            {hoverPct !== null && total > 0 && (
              <span
                className="pointer-events-none absolute -top-8 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-2 py-1 text-[11px]"
                style={{ left: `${Math.min(96, Math.max(4, hoverPct))}%` }}
              >
                {clock((hoverPct / 100) * total)}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
            <CtrlButton label={pb.playing ? "Pause" : pb.ended ? "Replay" : "Play"} onClick={pb.toggle}>
              {pb.ended ? (
                <RotateCcw className="h-5 w-5" />
              ) : pb.playing ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
            </CtrlButton>
            <CtrlButton label="Previous chapter" onClick={() => pb.seek(scene - 1)} disabled={scene === 0}>
              <SkipBack className="h-4 w-4 fill-current" />
            </CtrlButton>
            <CtrlButton label="Next chapter" onClick={() => pb.seek(scene + 1)} disabled={scene >= slides.length - 1}>
              <SkipForward className="h-4 w-4 fill-current" />
            </CtrlButton>
            <CtrlButton label={pb.muted ? "Unmute" : "Mute"} onClick={() => pb.setMuted((m) => !m)}>
              {pb.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </CtrlButton>
            <span className="px-1 text-xs tabular-nums text-white/80">
              {clock(globalTime)} / {clock(total)}
            </span>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => pb.setRate(RATES[(RATES.indexOf(pb.rate) + 1) % RATES.length])}
                className="min-h-9 rounded-md px-2 text-xs font-semibold tabular-nums text-white/90 transition hover:bg-white/10"
                aria-label={`Playback speed ${pb.rate}×`}
              >
                {pb.rate}×
              </button>
              <CtrlButton
                label={checkIns ? "Chapter check-ins on" : "Chapter check-ins off"}
                onClick={() => setCheckIns((on) => !on)}
                active={checkIns}
              >
                <ListChecks className="h-4 w-4" />
              </CtrlButton>
              <CtrlButton label="Captions" onClick={() => setCaptionsOn((c) => !c)} active={captionsOn}>
                <CaptionsIcon className="h-4 w-4" />
              </CtrlButton>
              <CtrlButton label="Fullscreen" onClick={toggleFullscreen}>
                {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </CtrlButton>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chapters ──────────────────────────────────────────────────────── */}
      <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
        {slides.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => pb.seek(i)}
            className={cn(
              "flex min-h-11 w-44 shrink-0 flex-col rounded-xl border p-2.5 text-left transition-colors",
              i === scene ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/60",
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Chapter {i + 1} · {clock(starts[i])}
            </span>
            <span className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug">{s.title}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Space play/pause · ← → skip 5s · F fullscreen · C captions · M mute · the video pauses after each chapter for a quick check
      </p>
    </div>
  );
}

function CtrlButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid h-9 min-w-9 place-items-center rounded-md px-1.5 transition hover:bg-white/10 disabled:opacity-30",
        active && "text-amber-300",
      )}
    >
      {children}
    </button>
  );
}
