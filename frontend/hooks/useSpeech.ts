"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Free browser text-to-speech (Web Speech API) — the fallback narrator used
 * by the interactive player when a premium ElevenLabs track isn't available
 * (quota exhausted, or the lesson is played before the audio stage finishes).
 * It never fails and costs nothing; it's just less lifelike than ElevenLabs.
 */
export interface UseSpeechResult {
  supported: boolean;
  speaking: boolean;
  speak: (text: string, opts?: { onEnd?: () => void; rate?: number; locale?: string }) => void;
  cancel: () => void;
}

/**
 * Picks a voice for the lesson's language. Exact locale first (hi-IN), then any
 * voice for the base language (hi-*), because browsers vary in how they tag
 * regional variants. Falls back to the curated English voices.
 */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: string | undefined
): SpeechSynthesisVoice | undefined {
  if (locale) {
    const normalized = locale.toLowerCase().replace("_", "-");
    const base = normalized.split("-")[0];
    const exact = voices.find((v) => v.lang?.toLowerCase().replace("_", "-") === normalized);
    if (exact) return exact;
    const sameLanguage = voices.find((v) => v.lang?.toLowerCase().startsWith(`${base}-`));
    if (sameLanguage) return sameLanguage;
    // No voice installed for this language — fall through to English rather
    // than letting the browser read the script with the wrong phonetics.
    if (base !== "en") return undefined;
  }

  // Prefer a natural-sounding English voice where the browser offers one.
  const preferred = [
    "Google US English",
    "Microsoft Aria Online (Natural) - English (United States)",
    "Microsoft Jenny Online (Natural) - English (United States)",
    "Samantha",
  ];
  for (const name of preferred) {
    const match = voices.find((v) => v.name === name);
    if (match) return match;
  }
  return voices.find((v) => v.lang?.startsWith("en")) ?? voices[0];
}

/**
 * Chromium silently stops a `SpeechSynthesisUtterance` after roughly 15 seconds,
 * so a whole slide script (~45s spoken) would cut off mid-sentence. Splitting
 * the script into short chunks queued back-to-back keeps every utterance well
 * under that ceiling while still sounding continuous.
 */
const MAX_CHUNK_CHARS = 140;

function chunkForSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > MAX_CHUNK_CHARS) {
      // A single very long sentence — break it on commas/clause boundaries.
      push();
      for (const clause of sentence.split(/(?<=,|;|:)\s+/)) {
        if ((current + clause).length > MAX_CHUNK_CHARS) push();
        current += `${clause} `;
      }
      push();
      continue;
    }
    if ((current + sentence).length > MAX_CHUNK_CHARS) push();
    current += sentence;
  }
  push();

  return chunks.length > 0 ? chunks : [text];
}

export function useSpeech(): UseSpeechResult {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  /**
   * Bumped by every `speak`/`cancel`. Utterance callbacks belonging to an older
   * session are ignored — without this, the `error` event Chrome fires when we
   * call `cancel()` would run the caller's `onEnd`, so pausing or stepping to
   * another slide would be mistaken for "narration finished" and auto-advance.
   */
  const sessionRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      sessionRef.current += 1;
      window.speechSynthesis.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    sessionRef.current += 1;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback<UseSpeechResult["speak"]>((text, opts) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      opts?.onEnd?.();
      return;
    }
    const synth = window.speechSynthesis;
    sessionRef.current += 1;
    const session = sessionRef.current;
    synth.cancel();

    const chunks = chunkForSpeech(text);
    const voice = pickVoice(voicesRef.current, opts?.locale);
    let index = 0;

    const speakNext = () => {
      // A newer speak()/cancel() superseded this one — drop it silently.
      if (session !== sessionRef.current) return;
      if (index >= chunks.length) {
        setSpeaking(false);
        opts?.onEnd?.();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      index += 1;
      if (voice) utterance.voice = voice;
      // Set lang even without a matching voice — some engines use it to pick
      // pronunciation rules for the text.
      if (opts?.locale) utterance.lang = opts.locale;
      utterance.rate = opts?.rate ?? 1;
      utterance.pitch = 1;
      utterance.onend = speakNext;
      // A genuine synthesis error shouldn't strand the lesson — move on to the
      // next chunk. Interruptions we caused are filtered by the session check.
      utterance.onerror = speakNext;
      synth.speak(utterance);
    };

    setSpeaking(true);
    speakNext();
  }, []);

  return { supported, speaking, speak, cancel };
}
