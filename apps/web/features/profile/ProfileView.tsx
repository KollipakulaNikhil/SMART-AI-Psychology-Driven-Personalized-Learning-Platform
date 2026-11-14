"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  Brain,
  Compass,
  Eye,
  Gauge,
  Heart,
  Layers,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { TRAIT_DESCRIPTIONS, TRAIT_LABELS } from "@/lib/constants";
import { cn, formatDate, titleCase } from "@/lib/utils";

const TRAIT_ICONS: Record<string, typeof Brain> = {
  learningStyle: Eye,
  attentionSpan: Timer,
  pace: Gauge,
  knowledgeLevel: BookOpen,
  tone: MessageSquare,
  depth: Layers,
  visualPreference: Compass,
  examplePreference: Lightbulb,
  motivation: Heart,
  memoryType: Brain,
  confidence: ShieldCheck,
  revisionFrequency: Activity,
};

export function ProfileView() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="border-t border-foreground" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-foreground/20 py-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2.5 h-6 w-40" />
            <Skeleton className="mt-2.5 h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="ruled border-y border-foreground px-1 py-16 sm:px-8" style={{ ["--rule-gap" as string]: "2.5rem" }}>
        <p className="label-mono">Blank page</p>
        <p className="mt-3 font-display text-3xl leading-tight">No learning profile yet.</p>
        <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">
          Do the three-minute learning discovery so SMART AI can adapt every lesson to you.
        </p>
        <Link href="/dashboard/questionnaire" className={cn(buttonVariants({ variant: "gradient" }), "mt-6")}>
          Take the assessment
        </Link>
      </div>
    );
  }

  const entries = Object.entries(profile.traits) as [string, string][];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant="accent">Profile v{profile.version}</Badge>
          <span className="text-sm text-muted-foreground">
            Last assessed {formatDate(profile.completedAt)}
          </span>
        </div>
        <Link href="/dashboard/questionnaire" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <RefreshCw className="h-3.5 w-3.5" /> Retake questionnaire
        </Link>
      </div>

      {/* The profile as an index: one ruled entry per trait, not a wall of cards. */}
      <dl className="border-t border-foreground">
        {entries.map(([key, value], index) => {
          const Icon = TRAIT_ICONS[key] ?? Brain;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.25 }}
              className="grid gap-x-6 gap-y-1 border-b border-foreground/20 py-4 sm:grid-cols-[2.5rem_13rem_1fr]"
            >
              <span className="nums hidden pt-1 font-mono text-xs text-primary sm:block">
                {String(index + 1).padStart(2, "0")}
              </span>
              <dt className="label-mono pt-1">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {TRAIT_LABELS[key] ?? titleCase(key)}
              </dt>
              <dd>
                <p className="font-display text-xl leading-snug">{titleCase(value)}</p>
                {TRAIT_DESCRIPTIONS[key] && (
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {TRAIT_DESCRIPTIONS[key]}
                  </p>
                )}
              </dd>
            </motion.div>
          );
        })}
      </dl>
    </div>
  );
}
