import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { settleOrder } from "@/lib/payments/payu-flow";

export const runtime = "nodejs";

/**
 * Safety net for a webhook that hasn't landed: the order page can ask us to
 * check with PayU directly. Still server-side, still never trusting the
 * browser — the browser only names the order.
 */
export async function POST(req: Request) {
  const parsed = z.object({ code: z.string().trim().min(4).max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const [order] = await db()<{ id: string; status: string }[]>`select id, status from orders where order_code = ${parsed.data.code}`;
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });
  if (order.status !== "pending_payment" && order.status !== "payment_failed") {
    return NextResponse.json({ ok: true, data: { status: order.status } });
  }

  try {
    const status = await settleOrder(order.id, "verify");
    return NextResponse.json({ ok: true, data: { status } });
  } catch (e) {
    console.error("verify failed", e);
    return NextResponse.json({ ok: false, error: "could not check with the bank" }, { status: 502 });
  }
}
