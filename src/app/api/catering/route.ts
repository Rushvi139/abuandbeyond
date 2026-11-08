import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(2, "Your name, please").max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "10-digit mobile number"),
  occasion: z.string().trim().max(60).optional().or(z.literal("")),
  guests: z.coerce.number().int().min(1).max(2000).optional(),
  eventOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" }, { status: 400 });
  const d = parsed.data;
  await db()`
    insert into catering_enquiries (name, phone, occasion, guests, event_on, notes)
    values (${d.name}, ${"+91" + d.phone}, ${d.occasion || null}, ${d.guests ?? null}, ${d.eventOn || null}, ${d.notes || null})`;
  return NextResponse.json({ ok: true });
}
