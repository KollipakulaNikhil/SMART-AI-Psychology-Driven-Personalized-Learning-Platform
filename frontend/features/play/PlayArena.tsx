"use client";

import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PresentationDetail } from "@/lib/types";
import { GamePicker } from "./GamePicker";
import { GameShell, type GameMeta } from "./GameShell";
import { GAMES, LAST_GAME_KEY, type GameId } from "./games";
import { useQuizGame } from "./useQuizGame";

/** Picks a game, then runs it. Remounting per game id gives each run fresh state. */
export function PlayArena({ lesson }: { lesson: PresentationDetail }) {
  const [selected, setSelected] = useState<GameId | null>(null);
  const [lastPlayed, setLastPlayed] = useState<GameId | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_GAME_KEY) as GameId | null;
      if (saved && GAMES.some((g) => g.id === saved)) setLastPlayed(saved);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const pick = (id: GameId) => {
    setSelected(id);
    setLastPlayed(id);
    try {
      localStorage.setItem(LAST_GAME_KEY, id);
    } catch {
      /* ignore */
    }
  };

  if (lesson.quiz.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">
        This lesson has no quiz to play yet.
      </div>
    );
  }

  const meta = GAMES.find((g) => g.id === selected);
  if (!meta) return <GamePicker lastPlayed={lastPlayed} onPick={pick} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <meta.icon className="h-4 w-4 text-amber-500" /> {meta.name}
        </p>
        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
          <LayoutGrid className="h-3.5 w-3.5" /> Change game
        </Button>
      </div>
      <GameView key={meta.id} lesson={lesson} meta={meta} />
    </div>
  );
}

function GameView({ lesson, meta }: { lesson: PresentationDetail; meta: GameMeta }) {
  const game = useQuizGame(lesson);
  const Scene = meta.Scene;
  return (
    <GameShell game={game} meta={meta}>
      <Scene game={game} />
    </GameShell>
  );
}
