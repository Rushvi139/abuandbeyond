import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { forgetCustomer, rememberCustomer } from "@/lib/customers/session";

export const runtime = "nodejs";

const Body = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "10-digit mobile number"),
  order: z.string().trim().min(1).max(12),
});

/**
 * Finding your orders on a new phone: the number you ordered with plus any of your
 * order numbers. Not a password, but it is two things only you and we know — and
 * it is replaced by a WhatsApp one-time code as soon as the number is live.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" }, { status: 400 });
  }
  const { phone, order } = parsed.data;
  const digits = order.replace(/\D/g, "");
  const [row] = await db()<{ id: string }[]>`
    select c.id from customers c
    join orders o on o.customer_id = c.id
    where c.phone = ${"+91" + phone}
      and (o.order_code = ${order.toUpperCase()} or (${digits} <> '' and o.order_number = ${digits ? Number(digits) : 0}))
      and o.status not in ('pending_payment','payment_failed')
    limit 1`;
  if (!row) return NextResponse.json({ ok: false, error: "We can't find an order with that number and mobile." }, { status: 404 });
  await rememberCustomer(row.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await forgetCustomer();
  return NextResponse.json({ ok: true });
}
