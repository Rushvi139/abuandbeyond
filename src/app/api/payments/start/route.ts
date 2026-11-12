import { NextResponse } from "next/server";
import { z } from "zod";
import { site, startPayuAttempt } from "@/lib/payments/payu-flow";

export const runtime = "nodejs";

/**
 * Hands back a fresh, signed PayU form for an order that still needs paying —
 * the "Pay now" button on a guest's order page. The browser only names the
 * order; the amount and everything else signed come from our database.
 */
export async function POST(req: Request) {
  const parsed = z.object({ code: z.string().trim().min(4).max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Unknown order" }, { status: 400 });
  try {
    const r = await startPayuAttempt(parsed.data.code, site(req));
    if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, data: r });
  } catch (e) {
    console.error("[payments/start]", e);
    return NextResponse.json({ ok: false, error: "We can't open the payment page right now." }, { status: 502 });
  }
}
