import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CheckoutSchema, createOrder } from "@/lib/orders/create";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/payments/razorpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = CheckoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ ok: false, error: { code: "invalid", message: first?.message ?? "Check the form" } }, { status: 400 });
  }
  try {
    const order = await createOrder(parsed.data);
    if (!razorpayConfigured()) {
      return NextResponse.json({ ok: false, error: { code: "payments_off", message: "Online payment isn't switched on yet." } }, { status: 503 });
    }
    const rp = await createRazorpayOrder(order.totalPaise, order.code, { order_number: String(order.number) });
    await db()`update orders set razorpay_order_id = ${rp.id} where id = ${order.id}`;
    return NextResponse.json({
      ok: true,
      data: { code: order.code, number: order.number, amountPaise: order.totalPaise, razorpayOrderId: rp.id, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, name: order.customerName, phone: order.phone },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong";
    return NextResponse.json({ ok: false, error: { code: "order_failed", message } }, { status: 400 });
  }
}
