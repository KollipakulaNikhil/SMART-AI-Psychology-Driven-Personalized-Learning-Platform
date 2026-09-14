"use client";

import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-amber/70 to-amber transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      >
        {/* Achievement signal gets a live sheen so progress reads as "moving", not painted. */}
        <span
          aria-hidden
          className="absolute inset-0 -translate-x-full animate-sheen bg-gradient-to-r from-transparent via-white/50 to-transparent"
        />
      </div>
    </div>
  );
}
