import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin area and private manage/review links must never be indexed.
      disallow: ["/admin", "/booking/", "/review/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
