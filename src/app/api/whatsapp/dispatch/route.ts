import { NextResponse } from "next/server";
import { whatsappConfigured } from "@/lib/whatsapp/client";
import { dispatchQueued } from "@/lib/whatsapp/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drains the WhatsApp outbox.
 *
 * Messages are queued by `transition` and sent here instead of inside the
 * request that placed the order, so Meta being slow or down never makes
 * ordering slow, and a send that fails has somewhere to wait.
 *
 * Called every half minute by the `whatsapp` service in docker-compose, and
 * safe to call by hand or twice over: each row is claimed by its own status
 * change, so a second caller finds nothing left to do.
 */
function authorised(req: Request): boolean {
  const expected = process.env.INTERNAL_SECRET || process.env.SESSION_SECRET || "";
  if (!expected) return false;
  const given = req.headers.get("x-internal-secret") ?? "";
  return given.length === expected.length && given === expected;
}

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ ok: true, skipped: "whatsapp not configured" });
  const result = await dispatchQueued();
  return NextResponse.json({ ok: true, ...result });
}
