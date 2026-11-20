import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only public, indexable pages — /dashboard and /api require sign-in. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
