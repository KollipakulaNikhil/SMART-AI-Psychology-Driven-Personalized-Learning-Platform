"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WelcomePanel } from "@/features/auth/WelcomePanel";
import { WelcomeStory } from "@/features/auth/WelcomeStory";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && firebaseUser) router.replace("/dashboard");
  }, [loading, firebaseUser, router]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#d8d0f4_0%,#efdcec_45%,#e4def8_100%)] p-2.5 sm:p-4 dark:bg-[linear-gradient(135deg,#1d1a2b_0%,#26192a_45%,#1a1a2a_100%)]">
      <div className="flex min-h-[calc(100svh-1.25rem)] flex-col rounded-[28px] bg-white shadow-[0_30px_80px_-40px_rgba(60,40,120,0.45)] sm:min-h-[calc(100svh-2rem)] dark:bg-neutral-950">
        <header className="flex items-center justify-between px-6 pt-5 sm:px-8 sm:pt-7">
          <Link
            href="/"
            className="rounded text-xl font-semibold tracking-tight text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:text-neutral-50"
          >
            smart ai.
          </Link>
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
            What is SMART AI? →
          </Link>
        </header>

        <div className="grid flex-1 gap-6 p-4 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <WelcomeStory />
          </div>
          <div className="flex flex-col items-center justify-center py-10">
            <WelcomePanel />
            <p className="mt-10 max-w-[300px] text-center text-[12px] leading-relaxed text-neutral-400">
              By continuing you agree to let SMART AI store your learning profile to personalize your lessons.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
