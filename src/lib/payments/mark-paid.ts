import "server-only";
import { db } from "@/lib/db";
import { transition } from "@/lib/orders/transition";

/**
 * Records a captured payment and moves the order to `paid`.
 *
 * Callers MUST have confirmed the payment with the gateway first — for PayU,
 * a server-side `verify_payment` call. Nothing the browser says reaches this
 * function. Idempotent on the gateway payment id.
 *
 * `gatewayOrderId` is the PayU txnid of the attempt that succeeded. It is
 * looked up in `payment_attempts`, and falls back to `orders.gateway_order_id`
 * for orders taken before the switch from Cashfree.
 */
export async function markPaid(args: {
  gatewayOrderId: string;
  paymentId: string;
  amountPaise: number;
  method?: string | null;
  gateway?: string;
  raw?: unknown;
}) {
  const sql = db();
  const [order] = await sql<{ id: string; total_paise: number; status: string }[]>`
    select o.id, o.total_paise, o.status from payment_attempts a join orders o on o.id = a.order_id where a.txnid = ${args.gatewayOrderId}
    union all
    select id, total_paise, status from orders where gateway_order_id = ${args.gatewayOrderId}
    limit 1`;
  if (!order) throw new Error("unknown gateway order");
  if (args.amountPaise !== Number(order.total_paise)) throw new Error("amount mismatch");

  await sql`insert into payments (order_id, gateway, gateway_order_id, gateway_payment_id, status, amount_paise, method, raw)
    values (${order.id}, ${args.gateway ?? "payu"}, ${args.gatewayOrderId}, ${args.paymentId}, 'captured', ${args.amountPaise}, ${args.method ?? null}, ${JSON.stringify(args.raw ?? null)})
    on conflict (gateway_payment_id) do update set status = 'captured', method = excluded.method`;
  if (order.status === "pending_payment" || order.status === "payment_failed") await transition(order.id, "paid");
  return order.id;
}
