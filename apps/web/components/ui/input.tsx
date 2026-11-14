import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-md border border-input bg-card px-4 py-2 text-[15px] transition-colors",
      "placeholder:text-muted-foreground",
      "hover:border-foreground/50 focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/35",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
