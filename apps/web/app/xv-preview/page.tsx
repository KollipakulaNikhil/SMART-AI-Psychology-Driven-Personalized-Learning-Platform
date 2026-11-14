"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AnimatedExplainer } from "@/features/video/AnimatedExplainer";
import { ChapterRecap, EndCard, recapFor } from "@/features/video/ChapterRecap";
import { EXPLAINER_CSS } from "@/features/video/styles";
import { themeFor } from "@/features/video/theme";
import type { PresentationDetail } from "@/lib/types";

const mk = (title: string, points: string[], terms: string[], diagram: { type: string; nodes: string[] } | null, script: string) => ({
  index: 0,
  title,
  points,
  script,
  board: { keyTerms: terms, notes: [], diagram, timeline: null },
  studyNotes: null,
  imageCredit: null,
  imageUrl: null,
  renderedImageUrl: null,
  audioUrl: null,
  audioDurationSec: null,
});

const lesson = {
  id: "x",
  title: "How Photosynthesis Powers Life",
  topic: "Photosynthesis",
  languageLocale: "en-US",
  slides: [
    mk("Why plants matter", ["Plants make their own food using sunlight", "Almost every food chain starts with them", "They also release the oxygen we breathe"], ["Sunlight", "Oxygen"], null, "Imagine making your own food from nothing but light, water and air. Plants do exactly that, every single day. This is photosynthesis."),
    mk("The core reaction", ["Chloroplasts capture light energy in leaves", "Water is split to release oxygen gas", "Carbon dioxide is built into glucose sugar", "Glucose fuels growth and repair"], ["Chloroplast", "Glucose", "Chlorophyll"], null, "Inside every leaf cell are tiny green factories called chloroplasts. They capture sunlight and use it to turn carbon dioxide and water into glucose."),
    mk("Steps of the process", ["Light absorbed", "Water split", "Energy carriers made", "Sugar built"], ["Light reactions", "Calvin cycle"], { type: "flow", nodes: ["Light absorbed", "Water split", "ATP made", "Sugar built"] }, "First light is absorbed. Then water splits. Energy carriers are made and finally sugar is built."),
    mk("The Calvin cycle loop", [], ["Rubisco"], { type: "cycle", nodes: ["Carbon fixed", "Reduction", "Regeneration", "Repeat"] }, "The Calvin cycle repeats around and around, fixing carbon into sugar each turn."),
    mk("Light vs dark reactions", [], [], { type: "compare", nodes: ["Light reactions", "Needs sunlight", "Makes ATP", "Calvin cycle", "No light needed", "Makes sugar"] }, "Compare the two stages of photosynthesis side by side."),
    mk("Key takeaways", ["Plants convert light into chemical energy", "Chloroplasts are the site of photosynthesis", "The cycle feeds nearly all life on Earth"], ["Energy"], null, "To wrap up, plants turn light into chemical energy, and nearly all life depends on it."),
  ].map((s, i) => ({ ...s, index: i })),
} as unknown as PresentationDetail;

const NOTES = {
  explanation: "",
  definitions: [
    { term: "Chloroplast", meaning: "The part of a plant cell where photosynthesis happens." },
    { term: "Glucose", meaning: "A simple sugar the plant uses as fuel and building material." },
  ],
  keyFacts: [
    "Photosynthesis turns carbon dioxide and water into glucose and oxygen, using light energy.",
    "The oxygen released comes from splitting water, not from carbon dioxide.",
  ],
  example: null,
  practice: {
    question: "A plant is kept in bright light but sealed in a jar with no carbon dioxide. What happens to its glucose production, and why?",
    answer: "It stops. Light alone is not enough: carbon dioxide supplies the carbon atoms that glucose is built from.",
  },
  commonMistake: "Thinking plants get their mass from the soil. Almost all of it comes from carbon dioxide in the air.",
};

/** ?card=recap | recap-plain | end renders one overlay on its own, for checking its layout. */
function CardPreview({ card }: { card: string }) {
  const slide = card === "recap" ? { ...lesson.slides[1], studyNotes: NOTES } : lesson.slides[1];
  const recap = recapFor(slide as PresentationDetail["slides"][number]);
  return (
    <div className="mx-auto max-w-5xl p-4">
      <style>{EXPLAINER_CSS}</style>
      <div className="xv-root relative aspect-video w-full overflow-hidden rounded-2xl bg-indigo-950">
        {card === "end" ? (
          <EndCard theme={themeFor(1)} chapters={lesson.slides.map((s) => s.title)} hasQuiz onReplay={() => {}} onJump={() => {}} />
        ) : (
          recap && (
            <ChapterRecap
              recap={recap}
              theme={themeFor(1)}
              chapter={1}
              total={lesson.slides.length}
              nextTitle={lesson.slides[2].title}
              onContinue={() => {}}
              onRewatch={() => {}}
            />
          )
        )}
      </div>
    </div>
  );
}

export default function Page() {
  // A development fixture: it must not be a public page on the deployed site.
  if (process.env.NODE_ENV === "production") notFound();
  const [i, setI] = useState(0);
  const [card, setCard] = useState<string | null>(null);
  useEffect(() => setCard(new URLSearchParams(window.location.search).get("card")), []);
  if (card) return <CardPreview card={card} />;
  return (
    <div className="mx-auto max-w-5xl p-4">
      <AnimatedExplainer lesson={lesson} currentSlide={i} onSlideChange={setI} ttsSpeed={1} />
    </div>
  );
}
