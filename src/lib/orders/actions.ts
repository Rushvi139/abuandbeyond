"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_STAFF, MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashfreeConfigured, refundCashfreeOrder } from "@/lib/payments/cashfree";
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

/** Cancel + refund (full) through Cashfree when a captured payment exists. */
export async function cancelOrder(orderId: string, reason: string) {
  const staff = await assertRole(MANAGERS);
  const id = Id.parse(orderId);
  const sql = db();
  const [pay] = await sql<{ gateway_payment_id: string; gateway_order_id: string; amount_paise: number }[]>`
    select gateway_payment_id, gateway_order_id, amount_paise from payments where order_id = ${id} and status = 'captured' limit 1`;
  await transition(id, "cancelled", { actorId: staff.id, note: reason.slice(0, 200) });
  if (pay && cashfreeConfigured()) {
    // Cashfree refunds are keyed by order and need an id we invent ourselves.
    const refundId = `rf-${pay.gateway_order_id}-${Date.now().toString(36)}`.slice(0, 40);
    const r = await refundCashfreeOrder(pay.gateway_order_id, refundId, pay.amount_paise, reason.slice(0, 100));
    await sql`insert into refunds (order_id, refund_id, amount_paise, status, reason, raw, created_by)
      values (${id}, ${refundId}, ${pay.amount_paise}, ${r.refund_status ?? "PENDING"}, ${reason.slice(0, 200)}, ${JSON.stringify(r)}, ${staff.id})
      on conflict (refund_id) do nothing`;
    await sql`update payments set status = 'refunded', refunded_paise = ${pay.amount_paise},
      raw = coalesce(raw, '{}'::jsonb) || ${JSON.stringify({ refund: r })}::jsonb where gateway_payment_id = ${pay.gateway_payment_id}`;
  }
  refreshAll();
}
