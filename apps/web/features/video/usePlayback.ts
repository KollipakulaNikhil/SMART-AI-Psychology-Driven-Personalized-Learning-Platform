"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "@/hooks/useSpeech";

const CLOCK_INTERVAL_SEC = 0.05;

export interface PlaybackOptions {
  /** Narration length of each scene, in seconds. */
  durations: number[];
  /** Narration track per scene (null → the browser voice reads the script). */
  audioUrls: (string | null)[];
  scripts: string[];
  scene: number;
  onSceneChange: (index: number) => void;
  ttsSpeed: number;
  locale?: string;
  /** Return true to stop at the end of a scene instead of rolling into the next one. */
  holdAtEnd?: (scene: number) => boolean;
}

/**
 * The clock behind the animated video. Everything on screen is a pure function
 * of (scene, elapsed), so scrubbing, pausing and replaying all just work.
 *
 * `elapsed === null` means "nothing has played yet": the player shows a poster
 * frame instead of an empty first moment of the scene.
 */
export function usePlayback({
  durations,
  audioUrls,
  scripts,
  scene,
  onSceneChange,
  ttsSpeed,
  locale,
  holdAtEnd,
}: PlaybackOptions) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<number | null>(null);
  /** Where to start the next play of a scene; null = resume wherever it stopped. */
  const pendingOffset = useRef<number | null>(0);

  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  /** Stopped at the end of a scene, waiting for the viewer to move on. */
  const [held, setHeld] = useState(false);
  const [rate, setRateState] = useState(1);
  const [muted, setMutedState] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const { supported: ttsSupported, speak, cancel: cancelSpeech } = useSpeech();

  const last = durations.length - 1;
  const duration = durations[scene] ?? 0;
  const audioUrl = audioUrls[scene] ?? null;
  const usingAudio = Boolean(audioUrl);

  const rateRef = useRef(rate);
  rateRef.current = rate;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const stopClock = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const handleEnd = useCallback(() => {
    stopClock();
    if (scene < last && holdAtEnd?.(scene)) {
      setPlaying(false);
      setHeld(true);
      setElapsed(durations[scene] ?? 0);
    } else if (scene < last) {
      pendingOffset.current = 0;
      setElapsed(0);
      onSceneChange(scene + 1);
    } else {
      setPlaying(false);
      setEnded(true);
      setElapsed(durations[scene] ?? 0);
    }
  }, [stopClock, scene, last, onSceneChange, durations, holdAtEnd]);
  const handleEndRef = useRef(handleEnd);
  handleEndRef.current = handleEnd;

  // Drive the clock + narration whenever playback is on and the scene changes.
  const rateDep = usingAudio ? 0 : rate;
  useEffect(() => {
    if (!playing) return;

    let cancelled = false;
    let lastPublished = -1;
    const publish = (seconds: number) => {
      if (Math.abs(seconds - lastPublished) < CLOCK_INTERVAL_SEC) return;
      lastPublished = seconds;
      setElapsed(seconds);
    };

    if (usingAudio && audioRef.current) {
      const audio = audioRef.current;
      if (pendingOffset.current !== null) {
        audio.currentTime = pendingOffset.current;
        pendingOffset.current = null;
      }
      audio.playbackRate = rateRef.current;
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

    // No premium track: run our own clock, and read the script with the browser voice.
    pendingOffset.current = null;
    const startedAt = performance.now();
    setElapsed(0);
    const tick = () => {
      if (cancelled) return;
      const sec = ((performance.now() - startedAt) / 1000) * rateRef.current;
      publish(sec);
      // Speech ends the scene itself; with the voice off (or unavailable) the clock does.
      if ((mutedRef.current || !ttsSupported) && sec >= duration) {
        handleEndRef.current();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    if (ttsSupported && !mutedRef.current) {
      speak(scripts[scene] ?? "", {
        onEnd: () => {
          if (!cancelled) handleEndRef.current();
        },
        rate: ttsSpeed * rateRef.current,
        locale,
      });
    }
    return () => {
      cancelled = true;
      stopClock();
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, playing, restartKey, rateDep, usingAudio]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, scene]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
    if (muted) cancelSpeech();
  }, [muted, scene, cancelSpeech]);

  useEffect(
    () => () => {
      stopClock();
      cancelSpeech();
    },
    [stopClock, cancelSpeech],
  );

  const seek = useCallback(
    (target: number, offset = 0) => {
      const sceneIdx = Math.min(Math.max(0, target), last);
      // A browser voice can't start mid-script, so only premium tracks seek within a scene.
      const hasAudio = Boolean(audioUrls[sceneIdx]);
      const at = hasAudio ? Math.max(0, offset) : 0;
      setEnded(false);
      setHeld(false);
      pendingOffset.current = at;
      setElapsed(at > 0 || playing ? at : null);
      if (sceneIdx !== scene) {
        onSceneChange(sceneIdx);
      } else if (hasAudio && audioRef.current) {
        audioRef.current.currentTime = at;
        pendingOffset.current = null;
      } else if (playing) {
        setRestartKey((k) => k + 1);
      }
    },
    [last, audioUrls, playing, scene, onSceneChange],
  );

  /** Leaves a held scene for the next one. */
  const continueNext = useCallback(() => {
    setHeld(false);
    pendingOffset.current = 0;
    setElapsed(0);
    if (scene < last) onSceneChange(scene + 1);
    setPlaying(true);
  }, [scene, last, onSceneChange]);

  /** Plays the current scene again from its start. */
  const replayScene = useCallback(() => {
    setHeld(false);
    setEnded(false);
    pendingOffset.current = 0;
    setElapsed(0);
    setRestartKey((k) => k + 1);
    setPlaying(true);
  }, []);

  /** Starts playing a given scene from its beginning, whatever state the player was in. */
  const playScene = useCallback(
    (target: number) => {
      seek(target);
      setPlaying(true);
    },
    [seek],
  );

  const toggle = useCallback(() => {
    if (held) {
      continueNext();
      return;
    }
    if (ended) {
      setEnded(false);
      pendingOffset.current = 0;
      setElapsed(0);
      if (scene !== 0) onSceneChange(0);
      else setRestartKey((k) => k + 1);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [held, continueNext, ended, scene, onSceneChange]);

  const setRate = useCallback((r: number) => setRateState(r), []);
  const setMuted = useCallback((update: (m: boolean) => boolean) => setMutedState(update), []);

  return {
    audioRef,
    audioUrl,
    playing,
    elapsed,
    ended,
    held,
    continueNext,
    replayScene,
    playScene,
    rate,
    muted,
    duration,
    toggle,
    seek,
    setRate,
    setMuted,
    onAudioEnded: () => handleEndRef.current(),
  };
}
