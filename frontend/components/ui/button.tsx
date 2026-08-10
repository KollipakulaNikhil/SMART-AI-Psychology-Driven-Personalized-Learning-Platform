import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap",
    "rounded-xl text-sm font-medium",
    // Transitioning only what changes keeps hover crisp instead of mushy.
    "transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:translate-y-0 active:scale-[0.985]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lift",
        gradient:
          "bg-brand-gradient text-white shadow-[0_10px_30px_-10px_hsl(239_84%_67%/0.7)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_hsl(239_84%_67%/0.85)]",
        secondary: "bg-elevated text-foreground hover:bg-muted",
        outline:
          "border border-border bg-card text-foreground shadow-soft hover:border-primary/45 hover:bg-elevated",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-7 text-base",
        icon: "h-10 w-10",
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
      {/* A light sweep across the primary action on hover — a small signal that
          the button is the live thing on the page, not a painted rectangle. */}
      {variant === "gradient" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-brand-sheen transition-transform duration-700 ease-out group-hover/btn:translate-x-full"
        />
      )}
      {loading && <Loader2 className="relative h-4 w-4 animate-spin" aria-hidden />}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
