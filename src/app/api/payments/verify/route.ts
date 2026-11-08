import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fetchCashfreeOrder, fetchCashfreePayments, toPaise } from "@/lib/payments/cashfree";
import { markPaid } from "@/lib/payments/mark-paid";

export const runtime = "nodejs";

/**
 * Safety net for a webhook that hasn't landed: when the guest comes back from
 * the payment page we ask Cashfree directly what happened. Still server-side,
 * still never trusting the browser — the browser only names the order.
 */
export async function POST(req: Request) {
  const parsed = z.object({ code: z.string().trim().min(4).max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const code = parsed.data.code;

  const [order] = await db()<{ id: string; status: string }[]>`select id, status from orders where order_code = ${code}`;
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });
  if (order.status !== "pending_payment" && order.status !== "payment_failed") {
    return NextResponse.json({ ok: true, data: { status: order.status } });
  }

  try {
    const cf = await fetchCashfreeOrder(code);
    if (cf.order_status === "PAID") {
      const payments = await fetchCashfreePayments(code).catch(() => []);
      const ok = payments.find((p) => p.payment_status === "SUCCESS");
      await markPaid({
        gatewayOrderId: code,
        paymentId: String(ok?.cf_payment_id ?? cf.cf_order_id),
        amountPaise: toPaise(ok?.payment_amount ?? cf.order_amount),
        method: ok?.payment_group ?? null,
        raw: { order: cf, payment: ok },
      });
      return NextResponse.json({ ok: true, data: { status: "paid" } });
    }
    return NextResponse.json({ ok: true, data: { status: cf.order_status.toLowerCase() } });
  } catch (e) {
    console.error("verify failed", e);
    return NextResponse.json({ ok: false, error: "could not check with the bank" }, { status: 502 });
  }
}
