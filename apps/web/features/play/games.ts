import { Flower2, Mountain, Skull, Sparkles } from "lucide-react";
import type { GameMeta } from "./GameShell";
import { BossPreview, BossScene } from "./scenes/BossScene";
import { ClimbPreview, ClimbScene } from "./scenes/ClimbScene";
import { ConstellationPreview, ConstellationScene } from "./scenes/ConstellationScene";
import { GardenPreview, GardenScene } from "./scenes/GardenScene";

export type GameId = "boss" | "climb" | "constellation" | "bloom";

export const GAMES: (GameMeta & { id: GameId })[] = [
  {
    id: "boss",
    name: "Boss Battle",
    tagline:
      "Duel the Void Warden. Right answers hurl spells; misses let him strike back. Lifelines, shields and boss rounds.",
    icon: Skull,
    tone: "dark",
    sceneBg: "#0b0716",
    unit: "Spells landed",
    cta: "Begin the duel",
    again: "Fight again",
    intro: (total, sec) =>
      `${total} questions in ${Math.ceil(total / 5)} stages. Land 70% to defeat the boss. Every 5th question is a boss round worth double; use 50/50 and Time Warp wisely, and chain 4 in a row to earn a shield. ${sec}s per question.`,
    ranks: ["Boss obliterated", "Boss defeated", "Boss still standing"],
    Scene: BossScene,
    Preview: BossPreview,
  },
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
