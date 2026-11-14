"use client";

import { useMemo } from "react";
import { seeded, type Theme } from "./theme";

/**
 * The scene's world: a deep gradient, slow colour blooms, a perspective grid,
 * drifting shapes and twinkles. `progress` (0→1 across the scene) nudges the
 * layers at different speeds, which reads as the camera moving through it.
 */
export function Backdrop({ theme, seed, progress }: { theme: Theme; seed: number; progress: number }) {
  const shapes = useMemo(() => {
    const rand = seeded(seed * 97 + 13);
    return Array.from({ length: 16 }, (_, i) => ({
      x: rand() * 100,
      y: rand() * 100,
      size: 1.4 + rand() * 3.4,
      kind: i % 4,
      depth: 0.3 + rand() * 1.2,
      delay: rand() * -8,
      dur: 6 + rand() * 8,
    }));
  }, [seed]);

  const sparkles = useMemo(() => {
    const rand = seeded(seed * 31 + 5);
    return Array.from({ length: 26 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      size: 0.25 + rand() * 0.45,
      delay: rand() * -4,
    }));
  }, [seed]);

  const shift = (progress - 0.5) * 100;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${theme.bg[0]}, ${theme.bg[1]} 55%, ${theme.bg[2]})` }}
    >
      <div
        className="xv-drift absolute -left-[10%] -top-[20%] h-[75%] w-[60%] rounded-full opacity-50 blur-3xl"
        style={{ background: theme.accent }}
      />
      <div
        className="xv-drift absolute -bottom-[25%] -right-[10%] h-[70%] w-[55%] rounded-full opacity-40 blur-3xl"
        style={{ background: theme.accent2, animationDelay: "-6s" }}
      />

      {/* perspective floor grid */}
      <div
        className="absolute inset-x-0 bottom-0 h-[46%] opacity-25"
        style={{
          backgroundImage: `linear-gradient(${theme.accent} 1px, transparent 1px), linear-gradient(90deg, ${theme.accent} 1px, transparent 1px)`,
          backgroundSize: "4cqw 4cqw",
          transform: "perspective(40cqw) rotateX(58deg)",
          transformOrigin: "bottom",
          maskImage: "linear-gradient(to top, black, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent)",
          backgroundPosition: `${shift * 0.6}cqw 0`,
          transition: "background-position .1s linear",
        }}
      />

      {shapes.map((s, i) => (
        <div
          key={i}
          className="xv-float absolute"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}cqw`,
            height: `${s.size}cqw`,
            opacity: 0.22,
            transform: `translateX(${-shift * s.depth * 0.12}cqw)`,
            transition: "transform .1s linear",
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }}
        >
          {s.kind === 0 && (
            <div className="h-full w-full rounded-full border-2" style={{ borderColor: theme.accent }} />
          )}
          {s.kind === 1 && (
            <div className="h-full w-full rotate-12 rounded-md" style={{ background: theme.accent2, opacity: 0.6 }} />
          )}
          {s.kind === 2 && (
            <div
              className="h-full w-full"
              style={{ background: theme.accent, clipPath: "polygon(50% 0, 100% 100%, 0 100%)", opacity: 0.6 }}
            />
          )}
          {s.kind === 3 && (
            <svg viewBox="0 0 10 10" className="h-full w-full" fill="none" stroke={theme.accent2} strokeWidth={1.4}>
              <path d="M5 1 V9 M1 5 H9" strokeLinecap="round" />
            </svg>
          )}
        </div>
      ))}

      {sparkles.map((s, i) => (
        <div
          key={i}
          className="xv-twinkle absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}cqw`,
            height: `${s.size}cqw`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* vignette keeps text legible and the frame cinematic */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)" }}
      />
    </div>
  );
}
