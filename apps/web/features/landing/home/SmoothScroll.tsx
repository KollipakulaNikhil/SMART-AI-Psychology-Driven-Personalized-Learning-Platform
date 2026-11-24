"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Eased wheel scrolling for the landing page, so the sticky phone story glides
 * between steps instead of jumping a notch at a time. Off for anyone who asks
 * the OS for reduced motion; touch scrolling stays native either way.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.14, smoothWheel: true, anchors: { offset: -64 } });
    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });
    // CSS smooth-scroll would fight Lenis on anchor jumps.
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      html.style.scrollBehavior = previous;
    };
  }, []);

  return null;
}
