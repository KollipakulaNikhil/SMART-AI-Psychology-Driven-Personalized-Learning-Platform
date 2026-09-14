import { Flower2, Mountain, Sparkles } from "lucide-react";
import type { GameMeta } from "./GameShell";
import { ClimbPreview, ClimbScene } from "./scenes/ClimbScene";
import { ConstellationPreview, ConstellationScene } from "./scenes/ConstellationScene";
import { GardenPreview, GardenScene } from "./scenes/GardenScene";

export type GameId = "climb" | "constellation" | "bloom";

export const GAMES: (GameMeta & { id: GameId })[] = [
  {
    id: "climb",
    name: "Knowledge Climb",
    tagline: "Walk a mountain trail to the summit. Right answers light lanterns along the way.",
    icon: Mountain,
    tone: "dark",
    sceneBg: "#100e2e",
    unit: "Lanterns",
    cta: "Start climb",
    again: "Climb again",
    intro: (total, sec) =>
      `${total} waypoints to the summit. Each right answer lights a lantern; answer fast for bonus points, chain answers for a combo. ${sec}s per question.`,
    ranks: ["Clear summit", "Summit reached", "Summit in the clouds"],
    Scene: ClimbScene,
    Preview: ClimbPreview,
  },
  {
    id: "constellation",
    name: "Constellation",
    tagline: "A comet places one star per question. Draw your own constellation across the night.",
    icon: Sparkles,
    tone: "dark",
    sceneBg: "#070b1f",
    unit: "Stars",
    cta: "Light the first star",
    again: "Draw again",
    intro: (total, sec) =>
      `${total} stars to place. Every right answer lights a star and links it to the last; misses leave a faint one. ${sec}s per question.`,
    ranks: ["Perfect constellation", "Constellation drawn", "Faint constellation"],
    Scene: ConstellationScene,
    Preview: ConstellationPreview,
  },
  {
    id: "bloom",
    name: "Bloom",
    tagline: "Grow a flower from seed. Every right answer opens a new bloom on the stem.",
    icon: Flower2,
    tone: "light",
    sceneBg: "#fff1e0",
    unit: "Blooms",
    cta: "Plant the seed",
    again: "Grow again",
    intro: (total, sec) =>
      `${total} blooms to open. Each right answer grows the stem and opens a flower; a miss leaves a wilted bud. ${sec}s per question.`,
    ranks: ["Full bloom", "In bloom", "Still budding"],
    Scene: GardenScene,
    Preview: GardenPreview,
  },
];

export const LAST_GAME_KEY = "smartai.play.lastGame";
