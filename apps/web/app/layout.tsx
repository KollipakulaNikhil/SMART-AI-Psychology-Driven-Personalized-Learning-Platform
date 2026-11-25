import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono, Kalam } from "next/font/google";
import { Providers } from "@/context/Providers";
import { SITE_URL } from "@/lib/site";
import "@/styles/globals.css";

/** Body and UI: a humane grotesque that stays out of the serif's way. */
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Display serif. Loaded as a variable font with its optical-size and softness
 * axes so big headlines get the tight, high-contrast cut while small serif
 * labels stay sturdy.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
  variable: "--font-display",
  display: "swap",
});

/** Labels, counters, section numbers and metadata. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * The board's handwriting. Self-hosted through next/font rather than relying on
 * a locally-installed face, so the board looks the same on every machine — and
 * because Kalam covers Devanagari, a Hindi board keeps the handwritten look
 * instead of falling back to whatever the OS picks.
 */
const kalam = Kalam({
  subsets: ["latin", "devanagari"],
  weight: ["400", "700"],
  variable: "--font-hand",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SMART AI — Lessons written for the way you learn",
    template: "%s · SMART AI",
  },
  description:
    "SMART AI works out how you learn in a three-minute discovery, then writes each lesson for you — narrated animated video, an interactive board, quiz games and a tutor, in five languages.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1330" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${kalam.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
