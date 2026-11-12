import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyResponseHash, type PayuResponse } from "@/lib/payments/payu";
import { orderIdForTxn, settleOrder } from "@/lib/payments/payu-flow";

export const runtime = "nodejs";

/**
 * PayU's payment webhook (success and failure), form-encoded and signed
 * with the same reverse hash as the return post.
 *
 * A bad hash is refused outright. A good one is still not taken as proof of
 * payment: `settleOrder` asks PayU's verify_payment from here before
 * anything is marked paid. That keeps one rule for every path in.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const r = Object.fromEntries(new URLSearchParams(raw)) as PayuResponse;
  if (!verifyResponseHash(r)) return NextResponse.json({ ok: false }, { status: 400 });

  const txnid = r.txnid ?? "";
  const orderId = await orderIdForTxn(txnid);
  if (!orderId) return NextResponse.json({ ok: true, ignored: "unknown txnid" });

  const sql = db();
  const eventId = `payu:${r.mihpayid ?? txnid}:${r.status ?? ""}`.slice(0, 200);
  const inserted = await sql`insert into webhook_events (id, provider) values (${eventId}, 'payu') on conflict do nothing returning id`;
  if (inserted.length === 0) return NextResponse.json({ ok: true, dup: true });

  try {
    const result = await settleOrder(orderId, "webhook");
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    // The idempotency row was written before the work. Leaving it would make
    // PayU's retry look like a duplicate and the payment would be lost, so
    // give it back and ask for another go; markPaid is idempotent.
    console.error("[payu webhook] handling failed, releasing for retry", e);
    await sql`delete from webhook_events where id = ${eventId}`.catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
