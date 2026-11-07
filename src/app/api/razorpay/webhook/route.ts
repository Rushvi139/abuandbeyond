import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPaid } from "@/lib/payments/mark-paid";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { transition } from "@/lib/orders/transition";

export const runtime = "nodejs";

type RzpEvent = {
  event: string;
  payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; method?: string; status?: string } } };
};

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, sig)) return NextResponse.json({ ok: false }, { status: 400 });

  const eventId = req.headers.get("x-razorpay-event-id") ?? "";
  const sql = db();
  if (eventId) {
    const inserted = await sql`insert into webhook_events (id, provider) values (${eventId}, 'razorpay') on conflict do nothing returning id`;
    if (inserted.length === 0) return NextResponse.json({ ok: true, dup: true });
  }

  let body: RzpEvent;
  try {
    body = JSON.parse(raw) as RzpEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const p = body.payload?.payment?.entity;
  try {
    if ((body.event === "payment.captured" || body.event === "order.paid") && p) {
      await markPaid({ razorpayOrderId: p.order_id, paymentId: p.id, amountPaise: p.amount, method: p.method ?? null, raw: body });
    } else if (body.event === "payment.failed" && p) {
      const [o] = await sql<{ id: string; status: string }[]>`select id, status from orders where razorpay_order_id = ${p.order_id}`;
      if (o && o.status === "pending_payment") await transition(o.id, "payment_failed", { note: "razorpay payment.failed" });
    }
  } catch (e) {
    console.error("webhook handling failed", e);
    // 200 so Razorpay doesn't hammer us; the event is logged above
  }
  return NextResponse.json({ ok: true });
}
