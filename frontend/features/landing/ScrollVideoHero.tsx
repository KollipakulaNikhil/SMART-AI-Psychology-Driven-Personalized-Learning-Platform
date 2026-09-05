"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Apple-product-page-style scroll-scrubbed hero: a sequence of frames (not a
 * <video>) is drawn onto a <canvas>, one frame per scroll position, so the
 * scrollbar acts like a video scrubber. The frames are extracted at 6fps from
 * a licensed neural-network flythrough clip (Pexels, free/no-attribution
 * license — "Futuristic Neural Network Animation with Glowing Nodes" by
 * Nicola Narracci; source kept at `frontend/assets-src/` (outside `public/`
 * so the raw 34MB clip is never shipped) for re-extraction, frames at
 * `public/demo/scroll-frames/`), chosen to visually match the
 * product's own "map how you learn" story: a glowing node/edge network, same
 * indigo/violet the rest of the brand uses.
 *
 * Self-contained like the HeroScene it replaced: swapping this back out is
 * one import change in `LandingSections.tsx`.
 */

const FRAME_COUNT = 60;
const FRAME_PATH = (index: number) => `/demo/scroll-frames/frame-${String(index + 1).padStart(3, "0")}.webp`;

/** Extra scroll distance (beyond one viewport) the scrub consumes while pinned. */
const SCRUB_DISTANCE_PX = 2400;

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

export function ScrollVideoHero() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(-1);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const reducedMotion = useReducedMotion();

  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    // "Cover" fit: fill the canvas, crop overflow, never letterbox.
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }, []);

  // Preload every frame. Sequential `onload` (not Promise.all) so the first
  // frame paints as soon as it's ready instead of waiting on all 72.
  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    const images: HTMLImageElement[] = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = FRAME_PATH(i);
      if (i === 0) {
        img.onload = () => {
          if (cancelled) return;
          setFirstFrameReady(true);
          drawFrame(0);
        };
      }
      images.push(img);
    }
    imagesRef.current = images;

    return () => {
      cancelled = true;
    };
  }, [drawFrame, reducedMotion]);

  // Canvas backing-store size must match its CSS size (device-pixel-ratio
  // aware) or the drawn frame looks soft; redo on resize and repaint whatever
  // frame was showing so a resize never flashes blank.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      if (currentFrameRef.current >= 0) drawFrame(currentFrameRef.current);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawFrame]);

  // Scroll → frame index. rAF-throttled so a fast scroll never queues more
  // than one paint per frame; only actually redraws when the target frame
  // index changes, not on every scroll pixel.
  useEffect(() => {
    if (reducedMotion) return;
    let rafId = 0;

    const computeAndDraw = () => {
      rafId = 0;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const scrubRange = rect.height - window.innerHeight;
      const traversed = Math.min(Math.max(-rect.top, 0), Math.max(scrubRange, 1));
      const progress = scrubRange > 0 ? traversed / scrubRange : 0;
      const frameIndex = Math.min(FRAME_COUNT - 1, Math.round(progress * (FRAME_COUNT - 1)));
      if (frameIndex !== currentFrameRef.current) {
        currentFrameRef.current = frameIndex;
        drawFrame(frameIndex);
      }
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(computeAndDraw);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [drawFrame, reducedMotion]);

  const heroCopy = (
    <div className="dark mx-auto max-w-3xl px-4 text-center">
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
        A 20-question assessment maps your attention span, pace and memory style.
        {reducedMotion
          ? " Then every lesson is written, drawn, narrated and quizzed for that profile."
          : " Scroll — that's the network behind it, mapping itself."}
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
  );

  if (reducedMotion) {
    // No scrubbing, no extra scroll height — a single real frame as a still
    // backdrop, same dark-vignette treatment as the animated version.
    return (
      <section
        id="hero-scrub"
        className="relative flex min-h-[85vh] items-center justify-center overflow-hidden"
      >
        <img
          src={FRAME_PATH(30)}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 65% at 50% 45%, rgba(13,13,23,0.88) 0%, rgba(13,13,23,0.6) 45%, rgba(13,13,23,0.15) 72%, rgba(13,13,23,0) 90%)",
          }}
        />
        <div className="relative py-20">{heroCopy}</div>
      </section>
    );
  }

  return (
    <section
      id="hero-scrub"
      ref={wrapperRef}
      className="relative"
      style={{ height: `calc(100vh + ${SCRUB_DISTANCE_PX}px)` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Poster frame as a CSS background so there is never a blank flash
         *  before the first <canvas> paint (image decode + first scroll tick). */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${FRAME_PATH(0)})` }}
        />
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-500",
            firstFrameReady ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Permanent legibility scrim — frames vary in brightness (title card
         *  vs. a bright plant photo mid-lesson), so this can't be scroll-tied;
         *  it has to hold constant contrast behind the copy regardless of
         *  which frame happens to be showing. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 68% 60% at 50% 42%, rgba(13,13,23,0.86) 0%, rgba(13,13,23,0.58) 44%, rgba(13,13,23,0.18) 70%, rgba(13,13,23,0) 88%)",
          }}
        />

        <div className="relative flex h-full w-full items-center justify-center">{heroCopy}</div>

        <div className="absolute inset-x-0 bottom-8 flex justify-center text-xs text-white/60">
          <span className="animate-bounce">Scroll to explore ↓</span>
        </div>
      </div>
    </section>
  );
}
