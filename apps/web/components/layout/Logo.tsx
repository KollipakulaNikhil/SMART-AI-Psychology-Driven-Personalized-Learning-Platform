import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
  iconOnly?: boolean;
}

/**
 * The mark is a notebook page: an ink tile with a red margin rule and three
 * ruled lines, the last cut short — a line still being written.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="5" className="fill-foreground" />
      <path d="M10 5.5v21" stroke="hsl(var(--mark))" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M14 11.5h12M14 16h12M14 20.5h6.5"
        className="stroke-background"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", className, iconOnly = false }: LogoProps) {
  return (
    <Link href={href} className={cn("group flex min-h-11 items-center gap-2.5", className)} aria-label="SMART AI home">
      <LogoMark className="transition-transform duration-150 group-hover:-rotate-3" />
      {!iconOnly && (
        <span className="font-display text-[1.3rem] font-medium leading-none tracking-tight text-foreground">
          Smart <em className="font-normal italic text-primary">AI</em>
        </span>
      )}
    </Link>
  );
}
