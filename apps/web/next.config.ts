import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
