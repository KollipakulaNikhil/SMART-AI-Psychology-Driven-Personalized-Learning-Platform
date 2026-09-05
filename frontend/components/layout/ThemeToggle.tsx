"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { springSnappy } from "@/lib/motion";

/**
 * Icon-only toggle that flips between light/dark. Renders a neutral shell
 * until mounted so SSR/CSR markup matches (theme is only knowable client-side)
 * — this is the one place a hydration mismatch would otherwise flash.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full",
        "border border-border bg-card text-muted-foreground shadow-soft",
        "hover:text-foreground hover:border-primary/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mounted && isDark ? (
          <motion.span
            key="moon"
            initial={{ opacity: 0, rotate: -90, scale: 0.4 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.4 }}
            transition={springSnappy}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Moon className="h-4 w-4" aria-hidden />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ opacity: 0, rotate: 90, scale: 0.4 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.4 }}
            transition={springSnappy}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sun className="h-4 w-4" aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
