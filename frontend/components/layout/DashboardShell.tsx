"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCog,
  History,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "./Logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/generate", label: "New lesson", icon: Sparkles, exact: false },
  { href: "/dashboard/paths", label: "Learning paths", icon: Map, exact: false },
  { href: "/dashboard/history", label: "History", icon: History, exact: false },
  { href: "/dashboard/profile", label: "Learning profile", icon: BrainCog, exact: false },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
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
    <div className="mt-auto border-t border-border pt-4">
      <div className="flex items-center gap-3 px-2">
        <Avatar src={sessionUser?.photoUrl ?? firebaseUser?.photoURL} name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
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

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 border-r border-border p-6 lg:block">
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/40 p-5 backdrop-blur-xl lg:flex">
        <Logo href="/dashboard" className="mb-8 px-2" />
        <NavLinks />
        <UserSection />
      </aside>

      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:hidden">
        <Logo href="/dashboard" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card p-5 lg:hidden"
            >
              <Logo href="/dashboard" className="mb-8 px-2" />
              <NavLinks onNavigate={() => setMobileOpen(false)} />
              <UserSection />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 px-4 pb-16 pt-24 sm:px-6 lg:ml-64 lg:px-10 lg:pt-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
