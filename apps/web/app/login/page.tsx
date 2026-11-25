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
      {/* White fading into navy blue behind the page (deep navy in dark mode). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_100%_100%,rgba(16,36,94,0.30),transparent_70%),linear-gradient(155deg,#ffffff_0%,#f1f4fb_40%,#c8d3ec_100%)] dark:bg-[radial-gradient(55%_50%_at_0%_0%,rgba(255,255,255,0.08),transparent_70%),linear-gradient(155deg,#0d1838_0%,#0b1a44_50%,#132f66_100%)]"
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
