import type { Metadata, Viewport } from "next";
import { Inter, Kalam, Space_Grotesk } from "next/font/google";
import { Providers } from "@/context/Providers";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/** Display face for headings — distinctive at large sizes without being loud. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
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
  title: {
    default: "SMART AI — Learning that adapts to your mind",
    template: "%s · SMART AI",
  },
  description:
    "SMART AI maps your learning psychology, then generates lessons — slides, narration and video — built for the way you actually learn.",
};

export const viewport: Viewport = {
  themeColor: "#FBFAFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${kalam.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
