"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { FirebaseError } from "firebase/app";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;
type Mode = "choose" | "signin" | "signup";

function firebaseErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists — try logging in.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and retry.";
      default:
        return error.message.replace("Firebase: ", "");
    }
  }
  return "Sign-in failed. Please try again.";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l4-3.09Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 1.29 6.62l4 3.09C6.23 6.87 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

/* The two button looks from the welcome screen: a dark, softly lit slab and a white one. */
const darkBtn =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-neutral-700 to-neutral-950 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_18px_-10px_rgba(0,0,0,0.6)] transition-[filter,transform] hover:brightness-125 active:scale-[0.99] disabled:opacity-60 dark:from-neutral-100 dark:to-neutral-300 dark:text-neutral-900";
const lightBtn =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-[15px] font-medium text-neutral-900 shadow-sm transition-[background-color,transform] hover:bg-neutral-50 active:scale-[0.99] disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800";
const field =
  "h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus-visible:ring-2 focus-visible:ring-neutral-900/15 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-300";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:focus-visible:ring-neutral-200";

export function WelcomePanel() {
  const [mode, setMode] = useState<Mode>("choose");
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (error) {
      toast.error(firebaseErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  const onSubmit = async (values: LoginValues) => {
    try {
      if (mode === "signup") {
        if (!values.name || values.name.trim().length < 2) {
          toast.error("Please enter your name to create an account.");
          return;
        }
        await signUpWithEmail(values.name.trim(), values.email, values.password);
      } else {
        await signInWithEmail(values.email, values.password);
      }
      router.push("/dashboard");
    } catch (error) {
      toast.error(firebaseErrorMessage(error));
    }
  };

  return (
    <div className="w-full max-w-[340px]">
      <AnimatePresence mode="wait" initial={false}>
        {mode === "choose" ? (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <h1 className="text-center font-sans text-[2rem] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Welcome to SMART AI
            </h1>
            <div className="mt-8 space-y-3">
              <button type="button" className={cn(darkBtn, focusRing)} onClick={() => setMode("signup")}>
                Join SMART AI
              </button>
              <button type="button" className={cn(lightBtn, focusRing)} onClick={() => setMode("signin")}>
                Log in
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <button
              type="button"
              onClick={() => setMode("choose")}
              className={cn("-ml-2 flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100", focusRing)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </button>
            <h1 className="mt-3 font-sans text-[1.75rem] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {mode === "signup" ? "Create your account" : "Log in"}
            </h1>
            <p className="mt-1.5 text-[14px] text-neutral-500">
              {mode === "signup"
                ? "Three minutes of discovery, then lessons built for how you think."
                : "Pick up where your last lesson left off."}
            </p>

            <div className="mt-7 space-y-4">
              <button type="button" className={cn(lightBtn, focusRing)} onClick={onGoogle} disabled={googleLoading}>
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <GoogleIcon />}
                Continue with Google
              </button>

              <div className="flex items-center gap-3 text-[12px] text-neutral-400">
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                or with email
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
                {mode === "signup" && (
                  <div>
                    <label htmlFor="name" className="sr-only">Name</label>
                    <input id="name" placeholder="Your name" autoComplete="name" className={field} {...register("name")} />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="sr-only">Email</label>
                  <input id="email" type="email" placeholder="you@example.com" autoComplete="email" className={field} {...register("email")} />
                  {errors.email && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{errors.email.message}</p>}
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className={field}
                    {...register("password")}
                  />
                  {errors.password && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>}
                </div>
                <button type="submit" className={cn(darkBtn, focusRing, "mt-2")} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {mode === "signup" ? "Create account" : "Log in"}
                </button>
              </form>

              <p className="pt-1 text-center text-[13px] text-neutral-500">
                {mode === "signin" ? "New to SMART AI?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "Join" : "Log in"}
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
