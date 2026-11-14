"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LoginCard } from "@/features/auth/LoginCard";
import { AuthAccentPanel } from "@/features/auth/AuthAccentPanel";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && firebaseUser) router.replace("/dashboard");
  }, [loading, firebaseUser, router]);

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="relative flex flex-col px-5 py-6 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <Logo href="/" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col justify-center py-12 lg:pl-4">
          <LoginCard />
        </div>

        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground lg:pl-4">
          By continuing you agree to let SMART AI store your learning profile to personalize your
          lessons.
        </p>
      </div>

      <AuthAccentPanel />
    </main>
  );
}
