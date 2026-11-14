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
        /* Bright vermilion for drawn marks and large numerals — not small text. */
        mark: "hsl(var(--mark))",
      },
      borderRadius: {
        // Small, bookish radii: 8 / 6 / 3px.
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 5px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "'Times New Roman'", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "'SFMono-Regular'", "Menlo", "monospace"],
        // Kalam ships Latin AND Devanagari, so the board keeps its handwriting
        // look in Hindi instead of silently falling back to a system face.
        hand: ["var(--font-hand)", "'Segoe Print'", "'Bradley Hand'", "cursive"],
      },
      backgroundImage: {
        // Legacy name. The app chrome no longer uses it; it survives only for
        // the lesson board and video player, which keep their own dark look.
        "brand-gradient": "linear-gradient(90deg, #E8552D 0%, #E8552D 100%)",
        grid: `linear-gradient(hsl(var(--border)) 1px, transparent 1px),
               linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
      },
      boxShadow: {
        // Shadows are rare and tight here — paper doesn't float. Depth is the
        // job of rules and borders. `hard` is the printed offset used on hover.
        soft: "0 1px 0 0 hsl(var(--foreground) / 0.05)",
        lift: "0 1px 0 0 hsl(var(--foreground) / 0.06), 0 10px 22px -16px hsl(var(--foreground) / 0.35)",
        float: "0 1px 0 0 hsl(var(--foreground) / 0.08), 0 18px 34px -22px hsl(var(--foreground) / 0.5)",
        hard: "4px 4px 0 0 hsl(var(--foreground))",
        "hard-sm": "2px 2px 0 0 hsl(var(--foreground))",
        "hard-mark": "4px 4px 0 0 hsl(var(--mark))",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
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
