import fs from "node:fs";
import path from "node:path";

/**
 * Studio photos made in Canva (Master Brand Guide shot list), bundled in
 * public/brand/photos/dishes/<slug>.webp. A photo the owner uploads in
 * /admin always wins; these fill the gap, and dishes without one keep their
 * illustrated sticker. Read once per server start.
 */
let cache: Set<string> | null = null;

function bundled(): Set<string> {
  if (cache) return cache;
  try {
    const dir = path.join(process.cwd(), "public", "brand", "photos", "dishes");
    cache = new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)));
  } catch {
    cache = new Set();
  }
  return cache;
}

export function dishPhoto(slug: string, uploaded: string | null): string | null {
  if (uploaded) return uploaded;
  return bundled().has(slug) ? `/brand/photos/dishes/${slug}.webp` : null;
}
