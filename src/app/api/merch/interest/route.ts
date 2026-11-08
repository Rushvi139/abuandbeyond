import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "10-digit mobile number"),
  name: z.string().trim().max(80).optional().or(z.literal("")),
  wants: z.array(z.string().trim().max(40)).max(8).default([]),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" }, { status: 400 });
  const { phone, name, wants } = parsed.data;
  await db()`
    insert into merch_interest (phone, name, wants) values (${"+91" + phone}, ${name || null}, ${wants})
    on conflict (phone) do update set wants = excluded.wants, name = coalesce(excluded.name, merch_interest.name)`;
  return NextResponse.json({ ok: true });
}
