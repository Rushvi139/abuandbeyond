"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_STAFF, MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { refundPayment, razorpayConfigured } from "@/lib/payments/razorpay";
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

/** Cancel + refund (full) through Razorpay when a captured payment exists. */
export async function cancelOrder(orderId: string, reason: string) {
  const staff = await assertRole(MANAGERS);
  const id = Id.parse(orderId);
  const sql = db();
  const [pay] = await sql<{ razorpay_payment_id: string; amount_paise: number }[]>`select razorpay_payment_id, amount_paise from payments where order_id = ${id} and status = 'captured' limit 1`;
  await transition(id, "cancelled", { actorId: staff.id, note: reason.slice(0, 200) });
  if (pay && razorpayConfigured()) {
    const r = await refundPayment(pay.razorpay_payment_id, pay.amount_paise);
    await sql`update payments set status = 'refunded', refunded_paise = ${pay.amount_paise}, raw = coalesce(raw, '{}'::jsonb) || ${JSON.stringify({ refund: r })}::jsonb where razorpay_payment_id = ${pay.razorpay_payment_id}`;
  }
  refreshAll();
}
