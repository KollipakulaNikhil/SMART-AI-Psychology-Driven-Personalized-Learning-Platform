import type { LessonLanguage } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export const BRAND = {
  name: "SMART AI",
  tagline: "Learning that adapts to your mind",
} as const;

/** Converts a backend /static/... path into an absolute URL. */
export function staticUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${API_BASE_URL}${path}`;
}

/** Display names for lesson languages, in the language's own script. */
export const LESSON_LANGUAGE_LABELS: Record<LessonLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  te: "తెలుగు",
  ta: "தமிழ்",
  es: "Español",
};

export const TRAIT_LABELS: Record<string, string> = {
  learningStyle: "Learning style",
  attentionSpan: "Attention span",
  pace: "Preferred pace",
  knowledgeLevel: "Knowledge level",
  tone: "Teaching tone",
  depth: "Depth",
  visualPreference: "Visual preference",
  examplePreference: "Examples & analogies",
  motivation: "Motivation",
  memoryType: "Memory strategy",
  confidence: "Confidence",
  revisionFrequency: "Revision habit",
};

export const TRAIT_DESCRIPTIONS: Record<string, string> = {
  learningStyle: "The channel your brain absorbs new information through most easily.",
  attentionSpan: "How long you stay deeply focused — this sets lesson length and slide density.",
  pace: "The narration speed and momentum your lessons are delivered at.",
  knowledgeLevel: "Where explanations start and how much terminology is used.",
  tone: "The personality of your AI tutor's voice and writing.",
  depth: "Whether lessons survey broadly or drill into fewer ideas completely.",
  visualPreference: "How image-forward your slides are designed to be.",
  examplePreference: "How often concepts are grounded in analogies and real-world examples.",
  motivation: "Why you learn — used to frame relevance in your lessons.",
  memoryType: "The retention technique your narration is structured around.",
  confidence: "How much encouragement your tutor weaves into hard topics.",
  revisionFrequency: "How many quiz questions each lesson ends with.",
};
