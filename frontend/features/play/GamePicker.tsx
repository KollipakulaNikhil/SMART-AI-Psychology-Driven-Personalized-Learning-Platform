"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { GAMES, type GameId } from "./games";

export function GamePicker({ lastPlayed, onPick }: { lastPlayed: GameId | null; onPick: (id: GameId) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {GAMES.map((game, i) => {
        const Icon = game.icon;
        const Preview = game.Preview;
        return (
          <motion.button
            key={game.id}
            type="button"
            onClick={() => onPick(game.id)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.985 }}
            className={cn(
              "group flex flex-col overflow-hidden rounded-3xl border border-border bg-card text-left shadow-soft",
              "transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="relative aspect-video w-full overflow-hidden">
              <Preview />
              {lastPlayed === game.id && (
                <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                  Last played
                </span>
              )}
              <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-primary shadow-lift transition-transform group-hover:scale-110">
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <p className="flex items-center gap-2 font-display text-lg font-semibold">
                <Icon className="h-4 w-4 text-amber-500" /> {game.name}
              </p>
              <p className="text-sm text-muted-foreground">{game.tagline}</p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
