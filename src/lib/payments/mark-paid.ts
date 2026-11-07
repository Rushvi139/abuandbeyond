import "server-only";
import { db } from "@/lib/db";
import { transition } from "@/lib/orders/transition";

/**
 * Records a captured Razorpay payment and moves the order to `paid`. Callers MUST have verified
 * the Razorpay signature first (webhook or checkout handler). Idempotent on payment id.
 */
export async function markPaid(args: { razorpayOrderId: string; paymentId: string; amountPaise: number; method?: string | null; raw?: unknown }) {
  const sql = db();
  const [order] = await sql<{ id: string; total_paise: number; status: string }[]>`select id, total_paise, status from orders where razorpay_order_id = ${args.razorpayOrderId}`;
  if (!order) throw new Error("unknown razorpay order");
  if (args.amountPaise !== order.total_paise) throw new Error("amount mismatch");

  await sql`insert into payments (order_id, razorpay_order_id, razorpay_payment_id, status, amount_paise, method, raw)
    values (${order.id}, ${args.razorpayOrderId}, ${args.paymentId}, 'captured', ${args.amountPaise}, ${args.method ?? null}, ${JSON.stringify(args.raw ?? null)})
    on conflict (razorpay_payment_id) do update set status = 'captured', method = excluded.method`;
  if (order.status === "pending_payment" || order.status === "payment_failed") await transition(order.id, "paid");
  return order.id;
}
