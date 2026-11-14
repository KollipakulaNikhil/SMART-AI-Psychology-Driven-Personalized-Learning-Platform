import {
  Atom,
  BookOpen,
  Brain,
  Calculator,
  Clock,
  Code2,
  Coins,
  Compass,
  Cpu,
  Database,
  Dna,
  Droplets,
  FlaskConical,
  Flame,
  Globe,
  Heart,
  Landmark,
  Layers,
  Leaf,
  Lightbulb,
  Lock,
  Map,
  Microscope,
  Music,
  Network,
  Palette,
  Puzzle,
  Rocket,
  Scale,
  Shield,
  Sparkles,
  Star,
  Sun,
  Target,
  TrendingUp,
  Users,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface Theme {
  /** Three-stop background gradient, dark to light. */
  bg: [string, string, string];
  accent: string;
  accent2: string;
}

/** One palette per scene, cycling, so consecutive scenes always feel different. */
export const THEMES: Theme[] = [
  { bg: ["#1e1b4b", "#312e81", "#5b21b6"], accent: "#a5b4fc", accent2: "#f0abfc" },
  { bg: ["#042f2e", "#0f766e", "#0e7490"], accent: "#5eead4", accent2: "#fde047" },
  { bg: ["#4c0519", "#9f1239", "#c2410c"], accent: "#fda4af", accent2: "#fcd34d" },
  { bg: ["#0c1e4a", "#1d4ed8", "#0891b2"], accent: "#7dd3fc", accent2: "#a7f3d0" },
  { bg: ["#052e16", "#166534", "#4d7c0f"], accent: "#86efac", accent2: "#fde68a" },
  { bg: ["#2e1065", "#7e22ce", "#be185d"], accent: "#f0abfc", accent2: "#fdba74" },
];

export const themeFor = (index: number): Theme => THEMES[index % THEMES.length];

/** Keyword → illustration. First match wins; anything else gets a stable pick from FALLBACK. */
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/energy|power|electric|current|voltage|charge|spark/i, Zap],
  [/brain|mind|think|memory|neuron|cogni|psycholog/i, Brain],
  [/cell|bio|organism|microb|bacteria|virus/i, Microscope],
  [/dna|gene|heredit|evolution/i, Dna],
  [/atom|particle|quantum|molecul|nucle/i, Atom],
  [/chem|reaction|acid|compound|lab/i, FlaskConical],
  [/math|equation|calcul|number|algebra|formula|sum|geometry/i, Calculator],
  [/code|program|software|algorithm|function|variable|syntax/i, Code2],
  [/data|database|storage|table|record|query/i, Database],
  [/network|internet|web|connect|protocol|server/i, Network],
  [/cpu|processor|computer|hardware|chip|machine/i, Cpu],
  [/money|cost|price|econom|market|profit|finance|trade|budget/i, Coins],
  [/growth|increase|trend|rise|improve|revenue/i, TrendingUp],
  [/time|clock|history|era|century|period|schedule/i, Clock],
  [/earth|world|global|planet|geograph|climate|country/i, Globe],
  [/map|region|location|territor/i, Map],
  [/plant|leaf|photosynth|forest|nature|ecosystem|green/i, Leaf],
  [/water|ocean|river|rain|liquid|fluid/i, Droplets],
  [/air|wind|gas|atmosphere|weather/i, Wind],
  [/sun|light|solar|star|space|radiat/i, Sun],
  [/fire|heat|thermal|combust|burn|temperature/i, Flame],
  [/health|heart|body|medic|disease|blood/i, Heart],
  [/people|society|social|human|community|culture|team/i, Users],
  [/law|justice|legal|right|rule|ethic/i, Scale],
  [/govern|politic|state|nation|constitution|democra/i, Landmark],
  [/secur|protect|safe|defen|privacy|risk/i, Shield],
  [/encrypt|password|secret|key|lock/i, Lock],
  [/music|sound|wave|frequency|audio|rhythm/i, Music],
  [/art|design|color|creative|paint|style/i, Palette],
  [/goal|target|aim|objective|purpose|focus/i, Target],
  [/idea|insight|innovat|invent|concept|theory/i, Lightbulb],
  [/tool|build|engineer|repair|construct|method/i, Wrench],
  [/problem|puzzle|solve|challenge|logic/i, Puzzle],
  [/layer|level|stack|structure|hierarch|tier/i, Layers],
  [/launch|rocket|start|begin|mission|future/i, Rocket],
  [/direction|navigat|guide|path|journey/i, Compass],
  [/learn|study|book|read|knowledge|educat|lesson/i, BookOpen],
];

const FALLBACK: LucideIcon[] = [Sparkles, Lightbulb, Star, Target, Puzzle, Rocket, Compass, Layers];

export function iconFor(text: string, salt = 0): LucideIcon {
  for (const [re, icon] of ICON_RULES) if (re.test(text)) return icon;
  let h = salt;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

/** Deterministic PRNG so decorative scatter is stable between renders. */
export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** When the i-th of n items appears in a scene of `duration` seconds (leaves a lead-in and a hold). */
export function revealTime(i: number, n: number, duration: number): number {
  const first = Math.min(1.1, duration * 0.12);
  const last = duration * 0.78;
  if (n <= 1) return first;
  return first + ((last - first) * i) / (n - 1);
}
