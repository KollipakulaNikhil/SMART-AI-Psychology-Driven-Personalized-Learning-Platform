"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TRAIT_LABELS } from "@/lib/constants";
import { titleCase } from "@/lib/utils";
import type { LearningProfileData } from "@/lib/types";

/** Celebration screen shown right after the questionnaire is scored. */
export function ProfileReveal({ profile }: { profile: LearningProfileData }) {
  const entries = Object.entries(profile.traits) as [string, string][];

  return (
    <div className="mx-auto max-w-3xl text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 200 }}
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-xl shadow-primary/30"
      >
        <Sparkles className="h-8 w-8 text-white" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h1 className="text-3xl font-bold sm:text-4xl">Your learning mind, mapped.</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Every lesson SMART AI generates from now on — slides, narration speed, examples, depth —
          is shaped by this profile.
        </p>
      </motion.div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {entries.map(([key, value], index) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + index * 0.05 }}
          >
            <Card>
              <CardContent className="p-4 text-left">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {TRAIT_LABELS[key] ?? titleCase(key)}
                </p>
                <p className="mt-1 font-semibold text-primary">{titleCase(value)}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-10"
      >
        <Link href="/dashboard/generate" className={buttonVariants({ variant: "gradient", size: "lg" })}>
          Generate my first lesson <Sparkles className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  );
}
