"use client";

import Link from "next/link";
import { motion, useScroll } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { FooterMark } from "./Showcase";

/* ------------------------------------------------------------------ nav --- */

const NAV: [string, string][] = [
  ["How it works", "#story"],
  ["Your way", "#your-way"],
  ["Languages", "#languages"],
  ["Games", "#games"],
  ["FAQ", "#faq"],
];

/** Dark pill with the small up-right arrow — the one primary action. */
export function PillLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13.5px] font-semibold text-background",
        "transition-[transform,background-color] duration-150 hover:bg-foreground/90 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {children}
      <ArrowUpRight
        className="h-3.5 w-3.5 text-amber transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-background/70"
        aria-hidden
      />
    </Link>
  );
}

export function SiteNav() {
  const { firebaseUser } = useAuth();
  const { scrollYProgress } = useScroll();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-foreground/10 bg-background/90 backdrop-blur">
      {/* reading progress */}
      <motion.div
        aria-hidden
        style={{ scaleX: scrollYProgress }}
        className="absolute inset-x-0 -bottom-px h-[2px] origin-left bg-mark"
      />
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-3">
          <ThemeToggle />
          {!firebaseUser && (
            <Link href="/login" className="hidden h-10 items-center px-2 text-sm font-medium sm:flex">
              Log in
            </Link>
          )}
          <PillLink href={firebaseUser ? "/dashboard" : "/login"}>
            {firebaseUser ? "Open dashboard" : "Start learning"}
          </PillLink>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- footer --- */

const FOOTER: { title: string; links: [string, string][] }[] = [
  { title: "Learn", links: [["Start the discovery", "/login"], ["Log in", "/login"]] },
  {
    title: "Product",
    links: [["How it works", "#story"], ["Your way", "#your-way"], ["Lessons", "#more"], ["Languages", "#languages"], ["Games", "#games"], ["FAQ", "#faq"]],
  },
];

export function SiteFooter() {
  return (
    <footer className="overflow-hidden border-t border-foreground/10 pb-10 pt-14">
      <div className="container grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            A learning notebook. It works out how you learn, then writes the lesson.
          </p>
        </div>
        {FOOTER.map((col) => (
          <nav key={col.title} aria-label={col.title} className="lg:col-span-2">
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="lg:col-span-3">
          <p className="text-sm font-semibold">Languages</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground" lang="mul">
            English · हिन्दी · తెలుగు · தமிழ் · Español
          </p>
        </div>
      </div>
      <FooterMark />
      <div className="container mt-6 text-xs text-muted-foreground">© {new Date().getFullYear()} SMART AI</div>
    </footer>
  );
}
