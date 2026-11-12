"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_STAFF, MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { newRefundToken, payuConfigured, refundPayment } from "@/lib/payments/payu";
import { transition } from "./transition";
import type { OrderStatus } from "./status";

const Id = z.string().uuid();

function refreshAll() {
  for (const p of ["/admin", "/kitchen", "/rider"]) revalidatePath(p);
}

export async function acceptOrder(orderId: string, prepMinutes: number) {
  const staff = await assertRole(["owner", "manager", "kitchen"]);
  await transition(Id.parse(orderId), "accepted", { actorId: staff.id, prepMinutes: z.number().int().min(5).max(120).parse(prepMinutes) });
  refreshAll();
}

export async function setStatus(orderId: string, to: OrderStatus) {
  const staff = await assertRole(ALL_STAFF);
  const allowed: Record<string, OrderStatus[]> = {
    kitchen: ["accepted", "preparing", "ready"],
    rider: ["out_for_delivery", "delivered"],
    manager: ["accepted", "preparing", "ready", "out_for_delivery", "delivered"],
    owner: ["accepted", "preparing", "ready", "out_for_delivery", "delivered"],
  };
  if (!allowed[staff.role]?.includes(to)) throw new Error("not allowed");
  await transition(Id.parse(orderId), to, { actorId: staff.id });
  refreshAll();
}

export async function assignRider(orderId: string, riderId: string | null) {
  await assertRole(MANAGERS);
  await db()`update orders set rider_id = ${riderId ? Id.parse(riderId) : null} where id = ${Id.parse(orderId)}`;
  refreshAll();
}

/** Cancel + refund (full) through PayU when a captured PayU payment exists. */
export async function cancelOrder(orderId: string, reason: string) {
  const staff = await assertRole(MANAGERS);
  const id = Id.parse(orderId);
  const sql = db();
  const [pay] = await sql<{ gateway: string; gateway_payment_id: string; amount_paise: number }[]>`
    select gateway, gateway_payment_id, amount_paise from payments where order_id = ${id} and status = 'captured' limit 1`;
  await transition(id, "cancelled", { actorId: staff.id, note: reason.slice(0, 200) });
  // Only PayU payments can be refunded from here. Old Cashfree rows were all
  // sandbox, and cash collected at the door goes back by hand.
  if (pay && pay.gateway === "payu" && payuConfigured()) {
    // PayU keys refunds by its own payment id (mihpayid) and a token we invent.
    const token = newRefundToken();
    const r = await refundPayment(pay.gateway_payment_id, token, Number(pay.amount_paise));
    await sql`insert into refunds (order_id, refund_id, amount_paise, status, reason, raw, created_by)
      values (${id}, ${token}, ${pay.amount_paise}, 'PENDING', ${reason.slice(0, 200)}, ${JSON.stringify(r)}, ${staff.id})
      on conflict (refund_id) do nothing`;
    await sql`update payments set status = 'refunded', refunded_paise = ${pay.amount_paise},
      raw = coalesce(raw, '{}'::jsonb) || ${JSON.stringify({ refund: r })}::jsonb where gateway_payment_id = ${pay.gateway_payment_id}`;
  }
  refreshAll();
}
