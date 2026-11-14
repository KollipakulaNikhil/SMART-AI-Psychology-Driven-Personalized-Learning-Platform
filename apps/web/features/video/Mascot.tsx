"use client";

import { useId } from "react";
import type { Theme } from "./theme";

export type Mood = "happy" | "think" | "wow";
export type Arm = "rest" | "wave" | "point" | "cheer";

/**
 * "Nova", the presenter: a small round robot drawn in SVG. It bobs, blinks, and
 * its mouth flaps while the narration is playing; mood and arm pose follow what
 * the scene is doing.
 */
export function Mascot({
  theme,
  mood,
  arm,
  speaking,
  className,
}: {
  theme: Theme;
  mood: Mood;
  arm: Arm;
  speaking: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const eyeR = mood === "wow" ? 12 : 9;
  const rightArmTransform =
    arm === "cheer" ? "rotate(-150 148 150)" : arm === "point" ? "rotate(-52 148 150)" : "rotate(0 148 150)";
  const leftArmTransform = arm === "cheer" ? "rotate(150 52 150)" : "rotate(0 52 150)";

  return (
    <svg viewBox="0 0 200 260" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.accent} />
          <stop offset="1" stopColor={theme.accent2} />
        </linearGradient>
        <linearGradient id={`${id}-head`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c7d2fe" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.accent2} stopOpacity="0.9" />
          <stop offset="1" stopColor={theme.accent2} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={100} cy={248} rx={58} ry={9} fill="#000" opacity={0.28} />

      <g className="xv-bob">
        {/* legs */}
        <rect x={72} y={216} width={20} height={28} rx={9} fill="#e2e8f0" />
        <rect x={108} y={216} width={20} height={28} rx={9} fill="#e2e8f0" />
        <rect x={66} y={236} width={32} height={12} rx={6} fill={theme.accent} />
        <rect x={102} y={236} width={32} height={12} rx={6} fill={theme.accent} />

        {/* arms (behind the torso) */}
        <g transform={leftArmTransform} style={{ transition: "transform .5s" }}>
          <rect x={30} y={146} width={20} height={58} rx={10} fill="#e2e8f0" />
          <circle cx={40} cy={206} r={11} fill={theme.accent} />
        </g>
        <g transform={rightArmTransform} style={{ transition: "transform .5s" }}>
          <g className={arm === "wave" ? "xv-wave" : undefined} style={{ transformOrigin: "148px 150px" }}>
            <rect x={150} y={146} width={20} height={58} rx={10} fill="#e2e8f0" />
            <circle cx={160} cy={206} r={11} fill={theme.accent} />
          </g>
        </g>

        {/* torso */}
        <rect x={52} y={128} width={96} height={96} rx={30} fill={`url(#${id}-body)`} />
        <rect x={68} y={148} width={64} height={46} rx={16} fill="#0f172a" opacity={0.85} />
        <path
          d="M100 186 C86 176 82 166 90 160 C95 156 100 160 100 164 C100 160 105 156 110 160 C118 166 114 176 100 186 Z"
          fill={theme.accent2}
          className="xv-pulse"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />

        {/* head */}
        <line x1={100} y1={34} x2={100} y2={48} stroke="#e2e8f0" strokeWidth={5} strokeLinecap="round" />
        <circle cx={100} cy={30} r={22} fill={`url(#${id}-glow)`} className="xv-pulse" />
        <circle cx={100} cy={30} r={8} fill={theme.accent2} />
        <rect x={32} y={44} width={136} height={92} rx={42} fill={`url(#${id}-head)`} />
        <rect x={24} y={76} width={12} height={28} rx={6} fill={theme.accent} />
        <rect x={164} y={76} width={12} height={28} rx={6} fill={theme.accent} />
        <rect x={46} y={58} width={108} height={64} rx={28} fill="#0f172a" />

        {/* face */}
        <g className="xv-blink">
          <circle cx={78} cy={86} r={eyeR} fill={theme.accent} />
          <circle cx={122} cy={86} r={mood === "think" ? 6 : eyeR} fill={theme.accent} />
          <circle cx={81} cy={83} r={3} fill="#fff" />
          <circle cx={125} cy={83} r={3} fill="#fff" />
        </g>
        {mood === "think" && <path d="M108 70 L136 64" stroke={theme.accent} strokeWidth={4} strokeLinecap="round" />}
        <circle cx={62} cy={102} r={6} fill={theme.accent2} opacity={0.35} />
        <circle cx={138} cy={102} r={6} fill={theme.accent2} opacity={0.35} />
        {speaking ? (
          <rect x={88} y={100} width={24} height={14} rx={7} fill={theme.accent2} className="xv-talk" />
        ) : mood === "wow" ? (
          <ellipse cx={100} cy={106} rx={7} ry={8} fill={theme.accent2} />
        ) : (
          <path d="M88 104 Q100 114 112 104" stroke={theme.accent2} strokeWidth={4} strokeLinecap="round" fill="none" />
        )}
      </g>
    </svg>
  );
}
