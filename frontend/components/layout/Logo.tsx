import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ href = "/", className, iconOnly = false }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn("group flex items-center gap-2.5", className)}
      aria-label="SMART AI home"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-[0_8px_20px_-8px_hsl(239_84%_67%/0.9)] transition-transform duration-200 group-hover:scale-105">
        {/* inner highlight — makes the mark read as a lit tile, not a flat swatch */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 to-transparent"
        />
        <BrainCircuit className="relative h-5 w-5 text-white" aria-hidden />
      </span>
      {!iconOnly && (
        <span className="font-display text-lg font-bold tracking-tight">
          SMART <span className="text-gradient">AI</span>
        </span>
      )}
    </Link>
  );
}
