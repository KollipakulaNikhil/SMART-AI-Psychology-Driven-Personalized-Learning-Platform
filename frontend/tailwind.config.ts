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
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 14s ease-in-out infinite",
        sheen: "sheen 5s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
