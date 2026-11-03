import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Public pages only — admin and the per-customer token pages stay out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/book`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/impressum`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/datenschutz`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
