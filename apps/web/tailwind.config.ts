import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* One step above card — for controls and panels resting on a card. */
        elevated: "hsl(var(--elevated))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        /* Progress/achievement signal only — see globals.css note. */
        amber: {
          DEFAULT: "hsl(var(--amber))",
          foreground: "hsl(var(--amber-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        // Kalam ships Latin AND Devanagari, so the board keeps its handwriting
        // look in Hindi instead of silently falling back to a system face.
        hand: ["var(--font-hand)", "'Segoe Print'", "'Bradley Hand'", "cursive"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #6366F1 0%, #8B5CF6 55%, #06B6D4 100%)",
        "brand-sheen":
          "linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.28) 50%, transparent 80%)",
        grid: `linear-gradient(hsl(var(--border)) 1px, transparent 1px),
               linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
      },
      boxShadow: {
        // Layered and low-opacity reads as depth; one big blur reads as haze.
        // Tinted slightly indigo rather than neutral grey — a pure black shadow
        // on a warm-white page looks like dirt.
        soft: "0 1px 2px rgba(31,33,58,0.05), 0 6px 20px -8px rgba(31,33,58,0.10)",
        lift: "0 2px 6px rgba(31,33,58,0.06), 0 20px 44px -16px rgba(31,33,58,0.18)",
        float: "0 4px 10px rgba(31,33,58,0.07), 0 34px 70px -22px rgba(31,33,58,0.26)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        // Slow drift for the hero's background orbs.
        float: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(0,-18px,0) scale(1.04)" },
        },
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        "sheen-y": {
          "0%": { transform: "translateY(-120%)" },
          "100%": { transform: "translateY(120%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Knowledge Climb (game) — stars, clouds and the summit confetti.
        twinkle: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        drift: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-140px)" },
        },
        confetti: {
          "0%": { transform: "translate3d(0,-20px,0) rotate(0deg)", opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "translate3d(0,720px,0) rotate(720deg)", opacity: "0" },
        },
        "float-up": {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(-56px)", opacity: "0" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 14s ease-in-out infinite",
        sheen: "sheen 5s ease-in-out infinite",
        "sheen-y": "sheen-y 5s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
        "spin-slow": "spin-slow 18s linear infinite",
        shimmer: "shimmer 2.5s ease-in-out infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
        drift: "drift 60s linear infinite alternate",
        confetti: "confetti 2.8s cubic-bezier(0.25, 0.8, 0.4, 1) forwards",
        "float-up": "float-up 1.1s ease-out forwards",
      },
    },
  },
  plugins: [animate],
};

export default config;
