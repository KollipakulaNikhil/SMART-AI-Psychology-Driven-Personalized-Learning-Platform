"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { PillLink } from "./HomeSections";
import { HeroIllustration } from "./HeroIllustration";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function Hero() {
  const { firebaseUser } = useAuth();
  return (
    <section className="relative overflow-hidden">
      <div className="container grid min-h-[calc(100svh-4rem)] items-center gap-10 py-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6 lg:py-10">
        <div className="max-w-xl">
          <motion.h1 {...rise(0)} className="font-display text-[3.1rem] font-normal leading-[1.02] tracking-[-0.025em] sm:text-[4.2rem]">
            Your studies have <br className="hidden sm:block" />
            a <em className="font-normal">tutor</em> now.
          </motion.h1>
          <motion.p {...rise(0.1)} className="mt-7 max-w-[30rem] text-[17px] leading-relaxed text-muted-foreground">
            SMART AI works out how you learn, then writes every lesson for you — a narrated video, a
            board you can click, and a quiz that plays like a game.
          </motion.p>
          <motion.div {...rise(0.2)} className="mt-9">
            <PillLink href={firebaseUser ? "/dashboard" : "/login"} className="h-12 px-5 text-[15px]">
              {firebaseUser ? "Open dashboard" : "Start learning"}
            </PillLink>
          </motion.div>
          <motion.p
            {...rise(0.3)}
            className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground"
          >
            Start with a topic. Free to start.
            <span aria-hidden className="hidden h-3.5 w-px bg-foreground/20 sm:block" />
            <span className="inline-flex items-center gap-1.5">
              <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-mark text-[9px] font-bold text-white">5</span>
              languages, spoken and written
            </span>
          </motion.p>
        </div>

        <div className="relative">
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}
