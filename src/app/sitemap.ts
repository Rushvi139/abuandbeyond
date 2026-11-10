import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { LANDINGS } from "@/lib/seo-pages";

/** /sitemap.xml — every public page Google should index. Private routes stay out (see robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" | "yearly") => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page("/", 1, "daily"),
    ...LANDINGS.map((l) => page(`/${l.slug}`, 0.8, "weekly")),
    page("/support", 0.5, "monthly"),
    page("/contact", 0.5, "monthly"),
    page("/wall", 0.4, "weekly"),
    page("/merch", 0.3, "monthly"),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
    page("/refunds", 0.2, "yearly"),
  ];
}
