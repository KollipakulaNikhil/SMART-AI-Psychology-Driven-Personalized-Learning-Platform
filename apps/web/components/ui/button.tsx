import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Buttons are solid printed rectangles. The primary action is vermilion, the
 * default is ink; both answer a hover with a hard offset shadow — the block
 * lifts off the page like a stamp — rather than a glow or a sheen.
 */
// The block lifts 3px up-left and leaves a hard 4px shadow where it sat;
// pressing seats it back on the page. With reduced motion the shadow still
// appears, just without the movement.
const SOLID_HOVER =
  "motion-safe:hover:-translate-x-[3px] motion-safe:hover:-translate-y-[3px] active:!translate-x-0 active:!translate-y-0 active:!shadow-none";

const buttonVariants = cva(
  [
    "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-sm font-semibold tracking-[-0.005em]",
    "transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-[120ms] ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        default: `border border-foreground bg-foreground text-background hover:shadow-hard-mark ${SOLID_HOVER}`,
        // Name kept for existing call sites: this is THE primary action, now a
        // flat vermilion block.
        gradient: `border border-foreground bg-primary text-primary-foreground dark:border-primary hover:shadow-hard ${SOLID_HOVER}`,
        secondary: "border border-transparent bg-elevated text-foreground hover:border-foreground/30 hover:bg-muted",
        outline: `border border-foreground/70 bg-transparent text-foreground hover:border-foreground hover:bg-card hover:shadow-hard ${SOLID_HOVER}`,
        ghost: "text-foreground hover:bg-foreground/[0.07]",
        destructive: `border border-destructive bg-destructive text-destructive-foreground hover:shadow-hard-sm ${SOLID_HOVER}`,
        link: "text-foreground underline decoration-primary decoration-1 underline-offset-4 hover:text-primary hover:decoration-2",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3.5 text-[13px]",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="relative h-4 w-4 animate-spin" aria-hidden />}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
