"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PenTick, Underlined } from "@/components/ui/marks";
import { TRAIT_LABELS, TRAIT_DESCRIPTIONS } from "@/lib/constants";
import { cn, titleCase } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { LearningProfileData } from "@/lib/types";

/** Celebration screen shown right after the questionnaire is scored. */
export function ProfileReveal({ profile }: { profile: LearningProfileData }) {
  const entries = Object.entries(profile.traits) as [string, string][];

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border-b-2 border-foreground pb-6"
      >
        <p className="label-mono">
          <PenTick className="h-3.5 w-3.5 text-accent" /> Profile mapped
        </p>
        <h1 className="text-h2 mt-4 text-balance">
          Your learning mind,{" "}
          <Underlined>
            <em>mapped</em>
          </Underlined>
          .
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Every lesson SMART AI generates from now on — slides, narration speed, examples, depth —
          is shaped by these {entries.length} dimensions.
        </p>
      </motion.div>

      <motion.dl initial="hidden" animate="show" variants={staggerContainer(0.05, 0.2)}>
        {entries.map(([key, value], index) => (
          <motion.div
            key={key}
            variants={fadeUp}
            className="grid gap-x-6 gap-y-1 border-b border-foreground/20 py-4 sm:grid-cols-[2.5rem_11rem_1fr]"
          >
            <span className="nums hidden pt-1 font-mono text-xs text-primary sm:block">
              {String(index + 1).padStart(2, "0")}
            </span>
            <dt className="label-mono pt-1">{TRAIT_LABELS[key] ?? titleCase(key)}</dt>
            <dd>
              <p className="font-display text-xl leading-snug">{titleCase(value)}</p>
              {TRAIT_DESCRIPTIONS[key] && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{TRAIT_DESCRIPTIONS[key]}</p>
              )}
            </dd>
          </motion.div>
        ))}
      </motion.dl>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 + entries.length * 0.05 + 0.2 }}
        className="mt-10"
      >
        <Link href="/dashboard/generate" className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "group")}>
          Generate my first lesson
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </div>
  );
}
