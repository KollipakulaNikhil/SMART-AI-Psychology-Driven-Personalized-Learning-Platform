import type { NextConfig } from "next";
import path from "path";

/**
 * Sent on every response. Deliberately no script-src/connect-src allow-list:
 * Firebase sign-in, Blob-hosted media and the browser voice each need their own
 * origins, and a wrong list fails as a blank page. These directives are the ones
 * that close real holes without that risk.
 */
const SECURITY_HEADERS = [
  // Never downgrade to http, including on subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // No other site may frame the app (clickjacking), inject a <base>, or host its forms.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone is used by Teach-it-back; nothing else here is used at all.
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The monorepo root — without this Next mis-infers it in some environments.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // @smart-ai/core ships compiled CommonJS (see packages/core's build step),
  // so it's a normal external dependency — no transpilePackages needed. That
  // matters specifically because Next.js cannot honor serverExternalPackages
  // for a native module (sharp) imported from inside a transpilePackages
  // entry — it bundles it anyway. Keeping core pre-compiled avoids that.
  serverExternalPackages: [
    "sharp",
    "ffmpeg-static",
    "ffprobe-static",
    "pdf-parse",
    "@napi-rs/canvas",
    "pptxgenjs",
    "pdfkit",
    "firebase-admin",
    "mongoose",
  ],
  // Being external keeps ffmpeg-static/ffprobe-static's JS out of the webpack
  // bundle, but Vercel's own file tracer still decides what to physically
  // ship for the deployed function — and it was dropping the large ffmpeg
  // binary itself (a bare path.join(__dirname, "ffmpeg"), not a `require()`,
  // so the tracer doesn't reliably see it), producing a runtime ENOENT.
  // Force-include both binaries explicitly.
  outputFileTracingIncludes: {
    "/api/generate/audio": [
      "../../node_modules/ffmpeg-static/**",
      "../../node_modules/ffprobe-static/**",
    ],
    // pdf-parse's pdfjs-dist dependency loads its worker via a dynamically
    // computed path (`new Worker(new URL(...))`-style), not a static
    // require() — the tracer misses it the same way it missed the ffmpeg
    // binary above, producing a "Cannot find module .../pdf.worker.mjs" at
    // runtime. course.controller.ts imports extractPdfText unconditionally,
    // so even the plain (non-PDF) /api/courses route needs this.
    "/api/courses": ["../../node_modules/pdf-parse/**", "../../node_modules/pdfjs-dist/**"],
    "/api/courses/from-pdf": ["../../node_modules/pdf-parse/**", "../../node_modules/pdfjs-dist/**"],
    "/api/generate/content/from-pdf": [
      "../../node_modules/pdf-parse/**",
      "../../node_modules/pdfjs-dist/**",
    ],
  },
  images: {
    // Slide previews, generated assets, and Pexels imagery.
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
