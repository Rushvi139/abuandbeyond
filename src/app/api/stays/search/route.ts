import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Hotel names for the checkout's property box, from the Stay Directory
 * (Google Places data we swept). Public businesses only — never a customer's
 * address. Returns names and areas; coordinates stay on the server and are
 * attached to the order there.
 */
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`stays:${ip}`, 120, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ ok: true, data: [] });

  const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const starts = `${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const rows = await db()<{ id: string; name: string; zone: string | null }[]>`
    select id, name, zone from stays
    where active and name ilike ${like}
    order by (name ilike ${starts}) desc, length(name), name
    limit 8`;
  return NextResponse.json({ ok: true, data: rows }, { headers: { "Cache-Control": "no-store" } });
}
