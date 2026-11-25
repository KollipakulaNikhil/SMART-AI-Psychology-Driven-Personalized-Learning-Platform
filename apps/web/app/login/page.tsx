"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WelcomePanel } from "@/features/auth/WelcomePanel";
import { WelcomeStory } from "@/features/auth/WelcomeStory";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && firebaseUser) router.replace("/dashboard");
  }, [loading, firebaseUser, router]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Same paper, ink and vermilion as the dashboard: a few soft washes of the
          theme colours sit behind the page instead of a separate gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_8%_0%,hsl(var(--mark)/0.10),transparent_70%),radial-gradient(50%_45%_at_100%_100%,hsl(var(--amber)/0.14),transparent_70%),radial-gradient(40%_40%_at_60%_40%,hsl(var(--secondary)/0.06),transparent_70%)]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1320px] flex-col px-4 sm:px-8">
        <header className="flex h-20 items-center justify-between">
          <Logo href="/" />
          <div className="flex items-center gap-3 sm:gap-5">
            <Link href="/" className="link-ink hidden text-sm sm:inline">
              What is SMART AI?
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="grid flex-1 items-stretch gap-8 pb-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
          <div className="hidden lg:block">
            <WelcomeStory />
          </div>
          <div className="flex flex-col items-center justify-center py-6 sm:py-10">
            <WelcomePanel />
            <p className="mt-8 max-w-[340px] text-center text-[12px] leading-relaxed text-muted-foreground">
              By continuing you agree to let SMART AI store your learning profile to personalize your lessons.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
