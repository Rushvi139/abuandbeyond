import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CheckoutSchema, createOrder } from "@/lib/orders/create";
import { cashfreeConfigured, cashfreeMode, createCashfreeOrder } from "@/lib/payments/cashfree";
import { rememberCustomer } from "@/lib/customers/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = CheckoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ ok: false, error: { code: "invalid", message: first?.message ?? "Check the form" } }, { status: 400 });
  }
  try {
    const order = await createOrder(parsed.data);
    await rememberCustomer(order.customerId); // so this device finds its own order history later
    if (!cashfreeConfigured()) {
      return NextResponse.json({ ok: false, error: { code: "payments_off", message: "Online payment isn't switched on yet." } }, { status: 503 });
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
    const cf = await createCashfreeOrder({
      orderId: order.code,
      amountPaise: order.totalPaise,
      customerId: order.customerId,
      phone: order.phone,
      name: order.customerName,
      returnUrl: `${site}/o/${order.code}`,
      notifyUrl: `${site}/api/cashfree/webhook`,
    });
    if (!cf.payment_session_id) throw new Error("Cashfree did not return a payment session");
    await db()`update orders set gateway_order_id = ${cf.order_id} where id = ${order.id}`;
    return NextResponse.json({
      ok: true,
      data: {
        code: order.code,
        number: order.number,
        amountPaise: order.totalPaise,
        paymentSessionId: cf.payment_session_id,
        mode: cashfreeMode(),
      },
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Something went wrong";
    // A dead gateway is our problem, not the guest's — don't show them "fetch failed".
    const unreachable = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(raw);
    if (unreachable) console.error("cashfree unreachable:", raw);
    return NextResponse.json(
      {
        ok: false,
        error: unreachable
          ? { code: "gateway_down", message: "We can't reach the payment page right now. Please try again in a moment." }
          : { code: "order_failed", message: raw },
      },
      { status: unreachable ? 503 : 400 },
    );
  }
}
