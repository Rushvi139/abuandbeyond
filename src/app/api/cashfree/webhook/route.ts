import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPaid } from "@/lib/payments/mark-paid";
import { toPaise, verifyCashfreeWebhook, webhookTimestampFresh } from "@/lib/payments/cashfree";
import { transition } from "@/lib/orders/transition";

export const runtime = "nodejs";

type CfEvent = {
  type?: string;
  data?: {
    order?: { order_id?: string; order_amount?: number };
    payment?: {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
      payment_group?: string;
      payment_method?: unknown;
    };
  };
};

const methodName = (p: CfEvent["data"] extends infer D ? (D extends { payment?: infer P } ? P : never) : never) => {
  const m = (p as { payment_method?: unknown; payment_group?: string } | undefined);
  if (!m) return null;
  if (m.payment_group) return m.payment_group;
  if (m.payment_method && typeof m.payment_method === "object") return Object.keys(m.payment_method as object)[0] ?? null;
  return null;
};

/**
 * The only thing that marks an order paid. Signature is
 * base64(HMAC-SHA256(timestamp + raw body, API secret)) — the raw body, never
 * the re-serialised JSON.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-webhook-signature") ?? "";
  const ts = req.headers.get("x-webhook-timestamp") ?? "";
  if (!webhookTimestampFresh(ts) || !verifyCashfreeWebhook(raw, sig, ts)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sql = db();
  // Cashfree's idempotency key, or the signature itself, keeps retries harmless.
  const eventId = (req.headers.get("x-idempotency-key") ?? sig).slice(0, 200);
  const inserted = await sql`insert into webhook_events (id, provider) values (${eventId}, 'cashfree') on conflict do nothing returning id`;
  if (inserted.length === 0) return NextResponse.json({ ok: true, dup: true });

  let body: CfEvent;
  try {
    body = JSON.parse(raw) as CfEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const orderId = body.data?.order?.order_id;
  const payment = body.data?.payment;
  try {
    if (body.type === "PAYMENT_SUCCESS_WEBHOOK" && orderId && payment?.cf_payment_id) {
      await markPaid({
        gatewayOrderId: orderId,
        paymentId: String(payment.cf_payment_id),
        amountPaise: toPaise(payment.payment_amount ?? body.data?.order?.order_amount ?? 0),
        method: methodName(payment),
        raw: body,
      });
    } else if ((body.type === "PAYMENT_FAILED_WEBHOOK" || body.type === "PAYMENT_USER_DROPPED_WEBHOOK") && orderId) {
      const [o] = await sql<{ id: string; status: string }[]>`select id, status from orders where gateway_order_id = ${orderId}`;
      if (o && o.status === "pending_payment") {
        await transition(o.id, "payment_failed", { note: `cashfree ${body.type}` });
      }
    }
  } catch (e) {
    // The idempotency row was written before the work, so leaving it in place
    // would make Cashfree's retry look like a duplicate and the payment would
    // be lost for good. Give the key back and ask them to try again; markPaid
    // is idempotent, so a retry that succeeds twice is harmless.
    console.error("cashfree webhook handling failed, releasing for retry", e);
    await sql`delete from webhook_events where id = ${eventId}`.catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
