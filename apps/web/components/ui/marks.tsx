import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Hand-drawn marks — the notebook's pen. Each is a single irregular stroke in
 * vermilion, drawn as inline SVG so it scales with the type it annotates.
 * They are static: a mark already made on the page, not an animation.
 */

/** A word with a quick pen underline beneath it. */
export function Underlined({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-block whitespace-nowrap", className)}>
      {children}
      <svg
        aria-hidden
        viewBox="0 0 200 14"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-[0.14em] left-[-2%] h-[0.22em] w-[104%] overflow-visible"
      >
        <path
          d="M2 8.5c22-4.6 41-5.8 63-4.4 20 1.3 33 4.3 55 3.6 27-.9 46-5.2 78-3.9"
          fill="none"
          stroke="hsl(var(--mark))"
          strokeWidth="3.2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

/** A word ringed in pen — an editor's circle, not a perfect ellipse. */
export function Circled({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-block whitespace-nowrap", className)}>
      {children}
      <svg
        aria-hidden
        viewBox="0 0 220 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-[-9%] top-[-4%] h-[112%] w-[118%] overflow-visible"
      >
        <path
          d="M196 34c8 22-22 50-84 56-58 6-104-10-106-38C4 24 54 6 116 6c50 0 88 14 94 40 3 14-6 26-18 34"
          fill="none"
          stroke="hsl(var(--mark))"
          strokeWidth="2.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

/** A curved pen arrow, for margin notes pointing at something. */
export function PenArrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 80 48" className={cn("h-10 w-16 overflow-visible", className)}>
      <path
        d="M76 6C58 4 30 8 12 34"
        fill="none"
        stroke="hsl(var(--mark))"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9 19c0 6 1 11 3 16 5-2 10-3 16-3"
        fill="none"
        stroke="hsl(var(--mark))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A pen tick, for "done" states. */
export function PenTick({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={cn("h-4 w-4 overflow-visible", className)}>
      <path
        d="M3 11.5c2 1.6 3.4 3.2 4.6 5.2C10 11 13.4 6.6 18 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The numbered label that opens a section: `01 — How it works`.
 * The number is the only vermilion in it.
 */
export function SectionLabel({
  number,
  children,
  className,
}: {
  number?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("label-mono", className)}>
      {number && <span className="text-primary">{number}</span>}
      {number && <span aria-hidden className="h-px w-6 bg-foreground/40" />}
      <span>{children}</span>
    </p>
  );
}

/**
 * Standard header for an inner page: mono kicker, serif title, optional
 * standfirst and actions, closed by a heavy rule — the top of a journal page.
 */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b-2 border-foreground pb-5", className)}>
      {kicker && <p className="label-mono mb-3">{kicker}</p>}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="page-title text-balance">{title}</h1>
          {description && (
            <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
