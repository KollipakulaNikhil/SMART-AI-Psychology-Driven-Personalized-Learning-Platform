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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { TRAIT_DESCRIPTIONS, TRAIT_LABELS } from "@/lib/constants";
import { formatDate, titleCase } from "@/lib/utils";

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
        <p className="text-lg font-medium">No learning profile yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Take the 20-question psychology assessment so SMART AI can adapt every lesson to you.
        </p>
        <Link href="/dashboard/questionnaire" className={buttonVariants({ variant: "gradient" })}>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([key, value], index) => {
          const Icon = TRAIT_ICONS[key] ?? Brain;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="h-full">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                      <Icon className="h-5 w-5 text-primary" aria-hidden />
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {TRAIT_LABELS[key] ?? titleCase(key)}
                      </p>
                      <p className="font-semibold text-primary">{titleCase(value)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {TRAIT_DESCRIPTIONS[key] ?? ""}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
