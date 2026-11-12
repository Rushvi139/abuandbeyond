import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { searchWords } from "@/lib/stays-search";

export const dynamic = "force-dynamic";

/**
 * Hotel names for the checkout's property box, from the Stay Directory
 * (Google Places data we swept, plus hotels earlier guests typed in).
 * Public businesses only — "Home" addresses are never stored there. Returns
 * names and areas; coordinates stay on the server and are attached to the
 * order there.
 */
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`stays:${ip}`, 120, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const words = searchWords(q);
  if (words.length === 0) return NextResponse.json({ ok: true, data: [] });

  const sql = db();
  const esc = (w: string) => w.replace(/[%_\\]/g, (c) => "\\" + c);
  // Every word typed must appear in the name or the area, in any order:
  // "top hill" finds "Hilltop Resort", "hilltone nakki" finds it by its zone.
  const match = words.map((w) => {
    const like = "%" + esc(w) + "%";
    return sql`and (name ilike ${like} or coalesce(zone, '') ilike ${like})`;
  });
  const first = esc(words[0]) + "%";
  const rows = await sql<{ id: string; name: string; zone: string | null }[]>`
    select id, name, zone from stays
    where active ${match}
    order by (regexp_replace(name, '^(hotel|the)\\s+', '', 'i') ilike ${first}) desc,
      (source is distinct from 'guest') desc, length(name), name
    limit 8`;
  return NextResponse.json({ ok: true, data: rows }, { headers: { "Cache-Control": "no-store" } });
}
