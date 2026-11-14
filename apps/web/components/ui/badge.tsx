import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// A badge is a small printed tag: mono caps, hairline border, square-ish.
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10.5px] font-medium uppercase leading-4 tracking-[0.08em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-primary/[0.07] text-primary",
        secondary: "border-foreground/25 bg-elevated text-foreground",
        accent: "border-accent/40 bg-accent/[0.08] text-accent",
        success: "border-accent/40 bg-accent/[0.08] text-accent",
        warning: "border-amber/50 bg-amber/10 text-amber",
        destructive: "border-destructive/40 bg-destructive/[0.07] text-destructive",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
