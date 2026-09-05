"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TRAIT_LABELS, TRAIT_DESCRIPTIONS } from "@/lib/constants";
import { titleCase } from "@/lib/utils";
import { fadeUp, hoverLift, staggerContainer } from "@/lib/motion";
import type { LearningProfileData } from "@/lib/types";

/** Celebration screen shown right after the questionnaire is scored. */
export function ProfileReveal({ profile }: { profile: LearningProfileData }) {
  const entries = Object.entries(profile.traits) as [string, string][];

  return (
    <div className="mx-auto max-w-3xl text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 13, stiffness: 200 }}
        className="glow-amber mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber/80 to-amber"
      >
        <Sparkles className="h-8 w-8 text-amber-foreground" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-amber/15 px-3 py-1 text-xs font-medium text-amber">
          <Sparkles className="h-3 w-3" aria-hidden /> Profile mapped
        </span>
        <h1 className="text-3xl font-bold sm:text-4xl">
          Your learning mind, <span className="text-gradient">mapped</span>.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Every lesson SMART AI generates from now on — slides, narration speed, examples, depth —
          is shaped by these {entries.length} dimensions.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer(0.06, 0.3)}
        className="mt-10 grid gap-3 sm:grid-cols-3"
      >
        {entries.map(([key, value]) => (
          <motion.div key={key} variants={fadeUp} whileHover={hoverLift}>
            <Card>
              <CardContent className="p-4 text-left">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {TRAIT_LABELS[key] ?? titleCase(key)}
                </p>
                <p className="mt-1 font-semibold text-primary">{titleCase(value)}</p>
                {TRAIT_DESCRIPTIONS[key] && (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {TRAIT_DESCRIPTIONS[key]}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 + entries.length * 0.06 + 0.3 }}
        className="mt-10"
      >
        <Link href="/dashboard/generate" className={buttonVariants({ variant: "gradient", size: "lg" })}>
          Generate my first lesson <Sparkles className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  );
}
