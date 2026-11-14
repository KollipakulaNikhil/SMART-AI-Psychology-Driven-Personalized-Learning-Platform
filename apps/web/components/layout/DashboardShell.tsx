"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { pageTransition } from "@/lib/motion";

/* The sidebar is the notebook's contents page: numbered entries, no icons. */
const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/generate", label: "New lesson", exact: false },
  { href: "/dashboard/paths", label: "Learning paths", exact: false },
  { href: "/dashboard/crossover", label: "Crossover", exact: false },
  { href: "/dashboard/research", label: "Research Lab", exact: false },
  { href: "/dashboard/mistake-hunt", label: "Mistake Hunt", exact: false },
  { href: "/dashboard/history", label: "History", exact: false },
  { href: "/dashboard/profile", label: "Learning profile", exact: false },
];

/** `scope` keeps the desktop and mobile-drawer instances' shared layoutId from colliding
 *  when both are mounted at once (drawer open on a lg+ viewport, or during its exit anim). */
function NavLinks({ onNavigate, scope }: { onNavigate?: () => void; scope: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Notebook" className="flex flex-col">
      <p className="label-mono mb-2 px-3">Contents</p>
      <ul className="border-t border-foreground/20">
        {NAV_ITEMS.map(({ href, label, exact }, index) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="border-b border-foreground/20">
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-11 items-baseline gap-3 px-3 py-3 text-[15px] transition-colors",
                  active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`nav-pill-${scope}`}
                    className="absolute inset-y-0 left-0 w-[3px] bg-mark"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className={cn("nums font-mono text-[11px] font-normal", active ? "text-primary" : "text-muted-foreground")}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="group-hover:underline group-hover:decoration-foreground/40 group-hover:underline-offset-4">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserSection() {
  const { sessionUser, firebaseUser, signOut } = useAuth();
  const router = useRouter();
  const name = sessionUser?.name ?? firebaseUser?.displayName ?? firebaseUser?.email ?? "Learner";

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  };

  return (
    <div className="mt-auto border-t border-foreground pt-4">
      <div className="flex items-center gap-3 px-1">
        <Avatar src={sessionUser?.photoUrl ?? firebaseUser?.photoURL} name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {sessionUser?.email ?? firebaseUser?.email}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Protected dashboard chrome: sidebar on desktop, sheet menu on mobile.
 * Redirects unauthenticated visitors to /login and profile-less users to
 * the questionnaire (their first required step).
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const { firebaseUser, hasProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (!hasProfile && pathname !== "/dashboard/questionnaire") {
      router.replace("/dashboard/questionnaire");
    }
  }, [loading, firebaseUser, hasProfile, pathname, router]);

  // The drawer is a modal: Escape closes it, focus moves into it on open and
  // returns to the menu button on close.
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const returnTo = menuButtonRef.current;
    const frame = requestAnimationFrame(() => {
      drawerRef.current?.querySelector<HTMLElement>("[data-drawer-close]")?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      returnTo?.focus();
    };
  }, [mobileOpen]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 border-r border-foreground/20 p-6 lg:block">
          <Skeleton className="h-9 w-32" />
          <div className="mt-10 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-64" />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-foreground/20 bg-background p-5 lg:flex">
        <div className="mb-9 flex items-center justify-between pl-1">
          <Logo href="/dashboard" />
          <ThemeToggle />
        </div>
        <NavLinks scope="desktop" />
        <UserSection />
      </aside>

      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-foreground bg-background px-4 lg:hidden">
        <Logo href="/dashboard" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-drawer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-hidden
              className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              ref={drawerRef}
              id="mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Notebook contents"
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r-2 border-foreground bg-background p-5 lg:hidden"
            >
              <div className="mb-9 flex items-center justify-between pl-1">
                <Logo href="/dashboard" />
                <Button
                  data-drawer-close
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} scope="mobile" />
              <UserSection />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="min-w-0 flex-1 px-4 pb-20 pt-24 sm:px-6 lg:ml-64 lg:px-12 lg:pt-12">
        {/* popLayout lets the incoming page start fading in immediately instead of
            waiting on the outgoing one — frequent in-app nav should feel snappy,
            not like a page-load. */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={pathname}
            initial="hidden"
            animate="show"
            exit="exit"
            variants={pageTransition}
            className="mx-auto w-full max-w-6xl"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
