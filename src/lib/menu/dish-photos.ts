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

/**
 * Dishes still on the menu under their older names (the locked-menu
 * renames are not live yet) borrow the photo of the dish they became.
 */
const ALIAS: Record<string, string> = {
  "margherita-pizza": "margherita-bella",
  "veggies-pizza": "indiano-garden",
  "four-cheese-pizza": "four-cheese-quattro",
  "pesto-pizza": "pesto-pomodoro",
  "pizza-al-fungi": "al-funghi-bianca",
  "landt-classic": "landt-classic-focaccia",
  "chicken-landt-classic": "chicken-landt-classic-focaccia",
  "paneer-pesto-sandwich": "paneer-pesto-focaccia",
  sandwich: "rosemary-chicken-pesto-focaccia",
  "classic-eggs-rolls": "tripple-egg-cheese-roll",
  "paneer-laffa-roll": "pesto-paneer-laffa-roll",
  "roasted-chicken-laffa-roll": "pesto-chicken-laffa-roll",
  "veg-burger": "golden-aloo-crunch",
  "chicken-burger": "southern-fried-chicken",
  "thai-chilly-chicken-bowl": "thai-chilly-chicken",
  "thai-paneer-chilly-bowl": "thai-chilly-paneer",
  "manchurian-bowl": "veg-manchurian",
};

export function dishPhoto(slug: string, uploaded: string | null): string | null {
  if (uploaded) return uploaded;
  const have = bundled();
  const key = have.has(slug) ? slug : ALIAS[slug];
  return key && have.has(key) ? `/brand/photos/dishes/${key}.webp` : null;
}
