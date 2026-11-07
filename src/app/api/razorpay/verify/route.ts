import { NextResponse } from "next/server";
import { z } from "zod";
import { markPaid } from "@/lib/payments/mark-paid";
import { verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() });

/** Called by the Razorpay Checkout success handler. Signature-verified; the webhook also covers it. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "invalid" } }, { status: 400 });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
  if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ ok: false, error: { code: "bad_signature" } }, { status: 400 });
  }
  const [o] = await db()<{ total_paise: number; order_code: string }[]>`select total_paise, order_code from orders where razorpay_order_id = ${razorpay_order_id}`;
  if (!o) return NextResponse.json({ ok: false, error: { code: "unknown_order" } }, { status: 404 });
  await markPaid({ razorpayOrderId: razorpay_order_id, paymentId: razorpay_payment_id, amountPaise: o.total_paise, method: "checkout" });
  return NextResponse.json({ ok: true, data: { code: o.order_code } });
}
