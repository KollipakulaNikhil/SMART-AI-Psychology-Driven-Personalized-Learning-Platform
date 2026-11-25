"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { FirebaseError } from "firebase/app";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;
type FormMode = "signin" | "signup";
type Mode = "choose" | FormMode;

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

/* Ink slab for the main action, paper for the secondary one — the dashboard's palette. */
const inkBtn =
  "group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-foreground text-[15px] font-medium text-background shadow-lift transition-[transform,box-shadow] hover:shadow-float active:scale-[0.99] disabled:opacity-60";
const paperBtn =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-background text-[15px] font-medium text-foreground transition-[background-color,border-color,transform] hover:border-foreground/40 hover:bg-elevated active:scale-[0.99] disabled:opacity-60";

const COPY: Record<FormMode, { eyebrow: string; title: string; italic: string; sub: string; submit: string }> = {
  signin: {
    eyebrow: "Log in",
    title: "Welcome",
    italic: "back.",
    sub: "Pick up where your last lesson left off.",
    submit: "Log in",
  },
  signup: {
    eyebrow: "Create account",
    title: "Start",
    italic: "learning.",
    sub: "Three minutes of discovery, then lessons built for how you think.",
    submit: "Create account",
  },
};

function Field({
  id,
  label,
  icon: Icon,
  error,
  trailing,
  ...input
}: React.ComponentProps<"input"> & {
  id: string;
  label: string;
  icon: typeof Mail;
  error?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-foreground">
        {label}
      </label>
      <div
        className={cn(
          "group flex h-12 items-center gap-3 rounded-xl border bg-background px-3.5 transition-[border-color,box-shadow]",
          "focus-within:border-foreground focus-within:shadow-[0_0_0_4px_hsl(var(--mark)/0.12)]",
          error ? "border-destructive" : "border-border hover:border-foreground/40"
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden />
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:outline-none"
          {...input}
        />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function WelcomePanel() {
  const [mode, setMode] = useState<Mode>("choose");
  const [showPassword, setShowPassword] = useState(false);
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

  const copy = mode === "choose" ? null : COPY[mode];

  return (
    <div className="relative w-full max-w-[420px]">
      {/* a second sheet tucked under the card, like a page in a notebook */}
      <div aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rotate-[1.2deg] rounded-[22px] border border-border bg-elevated" />

      <div className="relative overflow-hidden rounded-[22px] border border-border bg-card p-6 shadow-float sm:p-8">
        {/* vermilion margin rule */}
        <span aria-hidden className="absolute inset-y-6 left-0 w-[3px] rounded-r bg-mark" />

        <AnimatePresence mode="wait" initial={false}>
          {mode === "choose" || !copy ? (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="py-6"
            >
              <p className="label-mono text-center">Welcome</p>
              <h1 className="mt-3 text-center text-[2.3rem] font-normal leading-[1.05] tracking-[-0.03em] text-foreground">
                Welcome to <em className="text-primary">SMART AI</em>
              </h1>
              <p className="mx-auto mt-3 max-w-[300px] text-center text-[14.5px] leading-relaxed text-muted-foreground">
                Lessons built around how you think. Pick one to begin.
              </p>
              <div className="mt-9 space-y-3">
                <button type="button" className={inkBtn} onClick={() => setMode("signup")}>
                  Join SMART AI
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </button>
                <button type="button" className={paperBtn} onClick={() => setMode("signin")}>
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
                className="-ml-2 flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back
              </button>

              <p className="label-mono mt-3">{copy.eyebrow}</p>
              <h1 className="mt-2 text-[2.4rem] font-normal leading-[1.02] tracking-[-0.03em] text-foreground">
                {copy.title} <em className="text-primary">{copy.italic}</em>
              </h1>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{copy.sub}</p>

              <div className="mt-7 space-y-5">
                <button type="button" className={paperBtn} onClick={onGoogle} disabled={googleLoading}>
                  {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <GoogleIcon />}
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or with email
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  {mode === "signup" && (
                    <Field id="name" label="Your name" icon={User} placeholder="Asha Verma" autoComplete="name" {...register("name")} />
                  )}
                  <Field
                    id="email"
                    label="Email"
                    icon={Mail}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    error={errors.email?.message}
                    {...register("email")}
                  />
                  <Field
                    id="password"
                    label="Password"
                    icon={Lock}
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    error={errors.password?.message}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="-mr-1.5 grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                      </button>
                    }
                    {...register("password")}
                  />

                  <button type="submit" className={cn(inkBtn, "mt-2")} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        {copy.submit}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                      </>
                    )}
                  </button>
                </form>
              </div>

              <p className="mt-6 text-center text-[13.5px] text-muted-foreground">
                {mode === "signin" ? "New to SMART AI?" : "Already have an account?"}{" "}
                <button type="button" className="link-ink font-medium" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  {mode === "signin" ? "Join" : "Log in"}
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p aria-hidden className="relative mt-6 rotate-[-2deg] text-center font-hand text-[17px] text-muted-foreground">
        your first lesson is <span className="text-primary">about 40 seconds</span> away ↗
      </p>
    </div>
  );
}
