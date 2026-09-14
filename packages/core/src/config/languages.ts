/**
 * Lesson languages.
 *
 * Narration for every language here is free and key-less: the Microsoft Edge
 * neural voices bundled via `msedge-tts` cover all of them, and because they
 * are synthesized server-side they bake into the downloadable MP4 (unlike the
 * browser voice, which is live-only).
 *
 * The Edge voice names below were verified against `MsEdgeTTS.getVoices()` —
 * do not add a language without checking its voices actually exist there.
 */

export const LESSON_LANGUAGES = ["en", "hi", "te", "ta", "es"] as const;

export type LessonLanguage = (typeof LESSON_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: LessonLanguage = "en";

interface LanguageDefinition {
  /** English name, used in prompts and logs. */
  label: string;
  /** The language's own name, shown to the learner in the picker. */
  nativeLabel: string;
  /** BCP-47 tag — subtitle tracks and the browser-voice fallback both need it. */
  locale: string;
  /** Free Edge neural voice per learner tone. */
  edgeVoices: Record<"friendly" | "professional" | "academic", string>;
  /**
   * Whether to try premium ElevenLabs before the free Edge voice. Only English
   * is routed through ElevenLabs: the multilingual tier was explicitly scoped to
   * the free voices, so non-English lessons skip straight to Edge rather than
   * spending a paid quota that may not cover the language anyway.
   */
  preferElevenLabs: boolean;
}

export const LANGUAGES: Record<LessonLanguage, LanguageDefinition> = {
  en: {
    label: "English",
    nativeLabel: "English",
    locale: "en-US",
    edgeVoices: {
      friendly: "en-US-AriaNeural",
      professional: "en-US-GuyNeural",
      academic: "en-US-EricNeural",
    },
    preferElevenLabs: true,
  },
  hi: {
    label: "Hindi",
    nativeLabel: "हिन्दी",
    locale: "hi-IN",
    edgeVoices: {
      friendly: "hi-IN-SwaraNeural",
      professional: "hi-IN-MadhurNeural",
      academic: "hi-IN-MadhurNeural",
    },
    preferElevenLabs: false,
  },
  te: {
    label: "Telugu",
    nativeLabel: "తెలుగు",
    locale: "te-IN",
    edgeVoices: {
      friendly: "te-IN-ShrutiNeural",
      professional: "te-IN-MohanNeural",
      academic: "te-IN-MohanNeural",
    },
    preferElevenLabs: false,
  },
  ta: {
    label: "Tamil",
    nativeLabel: "தமிழ்",
    locale: "ta-IN",
    edgeVoices: {
      friendly: "ta-IN-PallaviNeural",
      professional: "ta-IN-ValluvarNeural",
      academic: "ta-IN-ValluvarNeural",
    },
    preferElevenLabs: false,
  },
  es: {
    label: "Spanish",
    nativeLabel: "Español",
    locale: "es-ES",
    edgeVoices: {
      friendly: "es-ES-ElviraNeural",
      professional: "es-ES-AlvaroNeural",
      academic: "es-ES-AlvaroNeural",
    },
    preferElevenLabs: false,
  },
};

export function isLessonLanguage(value: unknown): value is LessonLanguage {
  return typeof value === "string" && (LESSON_LANGUAGES as readonly string[]).includes(value);
}

/** Narrows any stored/received value to a supported language, defaulting to English. */
export function toLessonLanguage(value: unknown): LessonLanguage {
  return isLessonLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function languageDefinition(language: LessonLanguage): LanguageDefinition {
  return LANGUAGES[language];
}

/**
 * What language the board and slide text is written in.
 *
 * An unset board language means "same as the narration" — the behaviour every
 * lesson had before the two could differ, so old documents keep rendering the
 * way they were generated.
 */
export function resolveBoardLanguage(
  narrationLanguage: unknown,
  boardLanguage: unknown
): LessonLanguage {
  const narration = toLessonLanguage(narrationLanguage);
  return isLessonLanguage(boardLanguage) ? boardLanguage : narration;
}

/**
 * Scripts whose glyphs the handwriting/Latin font stacks do not cover, so the
 * SVG board renderer and burned-in subtitles must switch to an Indic face.
 */
export function needsIndicFont(language: LessonLanguage): boolean {
  return language === "hi" || language === "te" || language === "ta";
}
