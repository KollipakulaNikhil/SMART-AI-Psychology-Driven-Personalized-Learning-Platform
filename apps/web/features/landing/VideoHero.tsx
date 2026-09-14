"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Hero background: a looping ambient video (not scroll-scrubbed — see
 * `ScrollVideoHero.tsx` for that variant, kept but unused). Same licensed
 * neural-network flythrough clip (Pexels, free/no-attribution license —
 * "Futuristic Neural Network Animation with Glowing Nodes" by Nicola
 * Narracci; source at `frontend/assets-src/`, compressed for web at
 * `public/demo/neural-network-hero.mp4`), chosen to visually match the
 * product's own "map how you learn" story: a glowing node/edge network in
 * the brand's indigo/violet.
 *
 * Self-contained: swapping this back out is one import change in
 * `LandingSections.tsx`.
 */

const VIDEO_SRC = "/demo/neural-network-hero.mp4";
const POSTER_SRC = "/demo/neural-network-hero-poster.jpg";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function VideoHero() {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * Same load-bearing sequence already proven in `LessonVideo.tsx`: React
   * sets `muted` as a property after the element exists, so the browser can
   * evaluate autoplay against a not-yet-muted element and refuse it; and
   * `play()` called during mount — before resource selection has settled,
   * twice over under StrictMode's double-invoked effects — leaves the
   * element stalled at readyState 0 showing only the poster. `defaultMuted`
   * (not just `muted`) plus an explicit `load()` before `play()` makes the
   * sequence deterministic instead of racing the browser's own resource
   * selection.
   */
  useEffect(() => {
    if (reducedMotion) return;
    const video = videoRef.current;
    if (!video) return;
    video.defaultMuted = true;
    video.muted = true;
    video.load();
    video.play().catch(() => undefined);
  }, [reducedMotion]);

  return (
    // Fills the first screen exactly: the navbar floats over it, so 100svh
    // (small viewport height — stable under mobile browser chrome) means no
    // strip of the next section peeks in below the fold.
    <section
      id="hero-video"
      className="relative flex min-h-screen min-h-[100svh] items-center justify-center overflow-hidden"
    >
      {reducedMotion ? (
        <img src={POSTER_SRC} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          loop
          playsInline
          preload="auto"
          aria-hidden
          // If the first play() lost the race with resource selection, take
          // the next chance the element gives us.
          onCanPlay={(event) => {
            if (event.currentTarget.paused) event.currentTarget.play().catch(() => undefined);
          }}
          // Ambient background video with no pause control of its own — if the
          // browser pauses it for any reason (tab-throttling heuristics, a
          // brief buffering stall), resume automatically rather than leaving
          // a frozen frame. Guarded on visibility so it doesn't fight a
          // legitimate background-tab pause.
          onPause={(event) => {
            if (!document.hidden) event.currentTarget.play().catch(() => undefined);
          }}
        />
      )}

      {/* Permanent legibility scrim — the footage is dark but not evenly so
       *  (bright glow bursts move through frame), so contrast behind the
       *  copy can't just rely on the source being dark on average. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 50% 45%, rgba(13,13,23,0.88) 0%, rgba(13,13,23,0.6) 45%, rgba(13,13,23,0.15) 72%, rgba(13,13,23,0) 90%)",
        }}
      />

      {/* Scoped dark-theme zone: reuses the app's own `.dark` CSS variables
       *  (text-foreground, border-border, bg-card, .text-gradient, …) so the
       *  copy is styled correctly for a permanently-dark backdrop without
       *  hand-picked one-off colors. */}
      <div className="dark relative mx-auto max-w-3xl px-4 py-20 text-center">
        <Badge
          variant="outline"
          className="border-border bg-card px-3.5 py-1.5 text-[13px] text-foreground shadow-soft"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Psychology-driven learning
        </Badge>

        <h1 className="text-display mt-6 text-foreground">
          The tutor that learns <span className="text-gradient">how you learn</span> first
        </h1>

        <p className="text-lead mx-auto mt-6 max-w-2xl">
          A 20-question assessment maps your attention span, pace and memory style. Then every
          lesson is written, drawn, narrated and quizzed for that profile.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "group w-full sm:w-auto")}
          >
            Map my learning style
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
          <a
            href="#how-it-works"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}
          >
            See how it works
          </a>
        </div>

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {["Free to start", "5 languages", "No credit card"].map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-accent" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
