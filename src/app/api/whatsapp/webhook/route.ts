import { NextResponse } from "next/server";
import { applyReceipts, handleInbound } from "@/lib/whatsapp/inbound";
import { parseWebhook, validSignature } from "@/lib/whatsapp/intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta's webhook, called for guest replies and delivery receipts.
 *
 * GET is the one-time handshake when the URL is saved in the Meta dashboard:
 * it must echo `hub.challenge` if our verify token matches.
 *
 * POST must prove it is Meta by signature before anything is read. Always
 * answer 200 once it has, even if handling failed: Meta retries a non-200
 * for days, and a poison message would otherwise be replayed forever.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  if (expected && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === expected) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET ?? "")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  try {
    const { messages, receipts } = parseWebhook(JSON.parse(raw));
    await applyReceipts(receipts);
    for (const m of messages) await handleInbound(m);
  } catch (e) {
    console.error("whatsapp webhook:", e);
  }
  return NextResponse.json({ ok: true });
}
