"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { LoginCard } from "@/features/auth/LoginCard";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && firebaseUser) router.replace("/dashboard");
  }, [loading, firebaseUser, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 py-12">
      <Logo />
      <LoginCard />
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        By continuing you agree to let SMART AI store your learning profile to personalize your
        lessons.
      </p>
    </main>
  );
}
