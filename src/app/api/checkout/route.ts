import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/auth";
import { transition } from "@/lib/orders/transition";
import { REFUSE_ORDERS_WHEN_CLOSED, hoursLine, serviceState } from "@/lib/hours";
import { db } from "@/lib/db";
import { CheckoutSchema, createOrder } from "@/lib/orders/create";
import { cashfreeConfigured, cashfreeMode, createCashfreeOrder } from "@/lib/payments/cashfree";
import { codAllowed } from "@/lib/orders/cod";
import { rememberCustomer } from "@/lib/customers/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ ok: false, error: { code: "invalid", message: first?.message ?? "Check the form" } }, { status: 400 });
  }

  // A staff member can push a real cart through without paying, to walk the
  // whole path — menu, checkout, kitchen ticket, rider — before the gateway is
  // live. Gated on a staff session, not on a flag in the request, and the order
  // is marked is_demo so it never reaches sales, costing or the indent.
  const wantsDemo = (body as { demo?: unknown } | null)?.demo === true;
  const staff = wantsDemo ? await currentStaff() : null;

  // The real guard is here, not on the button. Taking money for food nobody
  // is in the kitchen to cook means a refund and a guest who waited. Staff
  // demos are exempt, so the flow can be tested at any hour.
  // A scheduled order is explicitly for a slot we are open, so being shut
  // right now is no reason to turn it away — it is the reason to offer it.
  if (REFUSE_ORDERS_WHEN_CLOSED && !wantsDemo && !parsed.data.scheduledFor) {
    const state = serviceState();
    if (!state.open) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "closed",
            message: `The kitchen is closed — we open at ${state.opensAt}. Pick a delivery time to order ahead. We cook ${hoursLine()}.`,
          },
        },
        { status: 409 },
      );
    }
  }
  if (wantsDemo && !staff) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Sign in as staff to place a demo order." } }, { status: 403 });
  }
  // Checked before the order exists, not after. Refusing a created order
  // would leave a row that says it will be paid at the door and never is.
  if (parsed.data.payOnDelivery && !(await codAllowed())) {
    return NextResponse.json({ ok: false, error: { code: "cod_off", message: "Pay on delivery isn't available right now." } }, { status: 503 });
  }

  try {
    const order = await createOrder(parsed.data, wantsDemo ? { source: "demo" } : {});
    await rememberCustomer(order.customerId); // so this device finds its own order history later

    if (wantsDemo && staff) {
      const sql = db();
      await sql.begin(async (tx) => {
        await tx`update orders set status = 'paid', paid_at = now(), is_demo = true where id = ${order.id}`;
        await tx`insert into order_status_events (order_id, from_status, to_status, actor_id, note)
          values (${order.id}, 'pending_payment', 'paid', ${staff.id}, 'demo order from checkout')`;
      });
      revalidatePath("/admin");
      revalidatePath("/kitchen");
      revalidatePath("/rider");
      return NextResponse.json({
        ok: true,
        data: { code: order.code, number: order.number, amountPaise: order.totalPaise, demo: true },
      });
    }

    // Pay on delivery: no gateway at all. The order is confirmed and goes to
    // the kitchen straight away; the money is a separate fact, recorded when
    // the rider actually collects it. `payment_mode` carries that distinction
    // so the books never show cash we haven't got.
    if (parsed.data.payOnDelivery) {
      await transition(order.id, "paid", { note: "pay on delivery" });
      revalidatePath("/admin");
      revalidatePath("/kitchen");
      revalidatePath("/rider");
      return NextResponse.json({
        ok: true,
        data: { code: order.code, number: order.number, amountPaise: order.totalPaise, payOnDelivery: true },
      });
    }

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
    // The session is kept so a guest who closes the tab can be handed the
    // payment back, and the env so a later switch to live keys does not leave
    // us holding order ids we can no longer look up.
    await db()`update orders set
        gateway_order_id = ${cf.order_id},
        payment_session_id = ${cf.payment_session_id},
        gateway_env = ${cashfreeMode()}
      where id = ${order.id}`;
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
