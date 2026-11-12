import "server-only";
import { db } from "@/lib/db";
import { transition } from "@/lib/orders/transition";
import { markPaid } from "@/lib/payments/mark-paid";
import {
  buildPaymentForm,
  isFinalFailure,
  newTxnId,
  payuConfigured,
  payuEnvLabel,
  successfulAttempt,
  toPaise,
  verifyPayment,
  type PayuFields,
} from "@/lib/payments/payu";

/**
 * The two halves of a PayU payment that the routes share:
 * starting an attempt, and finding out — from PayU, server-side — how it went.
 */

export const site = (req?: Request) => process.env.NEXT_PUBLIC_SITE_URL ?? (req ? new URL(req.url).origin : "");

/**
 * PayU insists on an email and we don't ask guests for one. This is the
 * address their payment receipt goes to; set PAYU_GUEST_EMAIL to change it.
 */
const guestEmail = () => process.env.PAYU_GUEST_EMAIL || "orders@abuandbeyond.in";

export type StartResult = { action: string; fields: PayuFields } | { error: string; status: number };

/**
 * Opens a new payment attempt on an order that still needs paying. Safe to
 * call again for the same order: each call gets its own txnid, and whichever
 * attempt succeeds pays the order.
 */
export async function startPayuAttempt(orderCode: string, origin: string): Promise<StartResult> {
  if (!payuConfigured()) return { error: "Online payment isn't switched on yet.", status: 503 };
  const sql = db();
  const [o] = await sql<{ id: string; code: string; number: number; status: string; mode: string; total: number; name: string | null; phone: string }[]>`
    select o.id, o.order_code as code, o.order_number as number, o.status, o.payment_mode as mode,
      o.total_paise::bigint as total, c.name, c.phone
    from orders o join customers c on c.id = o.customer_id
    where o.order_code = ${orderCode}`;
  if (!o) return { error: "We can't find that order.", status: 404 };
  if (o.mode !== "online") return { error: "This order is paid at the door.", status: 409 };
  if (o.status !== "pending_payment" && o.status !== "payment_failed") return { error: "This order is already paid.", status: 409 };

  const txnid = newTxnId(o.code);
  const env = payuEnvLabel();
  await sql.begin(async (tx) => {
    await tx`insert into payment_attempts (txnid, order_id, amount_paise, env) values (${txnid}, ${o.id}, ${Number(o.total)}, ${env})`;
    // The latest attempt is also kept on the order, so the admin screens that
    // already read gateway_order_id / gateway_env keep working unchanged.
    await tx`update orders set gateway_order_id = ${txnid}, gateway_env = ${env} where id = ${o.id}`;
  });

  const ret = `${origin}/api/payu/return`;
  return buildPaymentForm({
    txnid,
    amountPaise: Number(o.total),
    productinfo: `Abu and Beyond order ${o.number}`,
    firstname: o.name ?? "Guest",
    email: guestEmail(),
    phone: o.phone,
    surl: ret,
    furl: ret,
    orderCode: o.code,
  });
}

export type Settled = "paid" | "pending" | "failed" | "unknown";

/**
 * Asks PayU about every attempt on an order and settles it. This is the only
 * path to `markPaid` for PayU: the return post, the webhook and the
 * reconcile sweep all come through here, so none of them can mark an order
 * paid on PayU's word as relayed by a browser.
 */
export async function settleOrder(orderId: string, via: string): Promise<Settled> {
  const sql = db();
  const [o] = await sql<{ status: string }[]>`select status from orders where id = ${orderId}`;
  if (!o) return "unknown";
  if (o.status !== "pending_payment" && o.status !== "payment_failed") return o.status === "cancelled" ? "failed" : "paid";

  const attempts = await sql<{ txnid: string; createdAt: Date }[]>`
    select txnid, created_at as "createdAt" from payment_attempts where order_id = ${orderId} order by created_at desc limit 10`;
  if (attempts.length === 0) return "unknown";

  const details = await verifyPayment(attempts.map((a) => a.txnid));
  const win = successfulAttempt(details);
  if (win) {
    await markPaid({
      gatewayOrderId: win.txnid,
      paymentId: String(win.txn.mihpayid),
      amountPaise: toPaise(win.txn.transaction_amount ?? win.txn.amt ?? "0"),
      method: win.txn.mode ?? null,
      gateway: "payu",
      raw: { ...win.txn, via },
    });
    return "paid";
  }

  // Only call it failed when every attempt has a final answer. A guest can
  // still be on PayU's page, or a UPI request can still be waiting on a phone.
  const everyFinal = attempts.every((a) => {
    const t = details[a.txnid];
    return t ? isFinalFailure(t) : false;
  });
  if (everyFinal) {
    if (o.status === "pending_payment") await transition(orderId, "payment_failed", { note: `payu (${via})` });
    return "failed";
  }
  return "pending";
}

export async function orderIdForTxn(txnid: string): Promise<string | null> {
  const [r] = await db()<{ orderId: string }[]>`select order_id as "orderId" from payment_attempts where txnid = ${txnid}`;
  return r?.orderId ?? null;
}
