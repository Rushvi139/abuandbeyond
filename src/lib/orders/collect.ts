"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOKKEEPERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * The rider has the money in hand.
 *
 * Separate from the order's status on purpose: a pay-on-delivery order is
 * cooked and delivered long before the cash exists, so recording the one as
 * the other would put money in the books that nobody is holding.
 *
 * A `payments` row is written too, so a collected order reconciles the same
 * way an online one does.
 */
export async function markCollected(orderId: string, method: "cash" | "upi"): Promise<{ error?: string }> {
  const staff = await assertRole(BOOKKEEPERS);
  if (!z.string().uuid().safeParse(orderId).success) return { error: "Unknown order." };

  const result = await db().begin(async (tx) => {
    const [o] = await tx<{ id: string; code: string; total: number; mode: string; collected: string | null }[]>`
      select id, order_code as code, total_paise::bigint as total, payment_mode as mode, collected_at as collected
      from orders where id = ${orderId} for update`;
    if (!o) return { error: "Unknown order." };
    if (o.mode !== "on_delivery") return { error: "This one was paid online." };
    if (o.collected) return { error: "Already marked collected." };

    await tx`update orders set collected_at = now(), collected_by = ${staff.id} where id = ${orderId}`;
    // gateway_order_id is not null, and for cash there is no gateway order —
    // our own order code is the closest true thing.
    await tx`insert into payments (order_id, gateway, gateway_order_id, gateway_payment_id, status, amount_paise, method)
      values (${orderId}, 'on_delivery', ${o.code}, ${"cod_" + orderId}, 'captured', ${o.total}, ${method})
      on conflict (gateway_payment_id) do nothing`;
    return {};
  });

  revalidatePath("/rider");
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  return result;
}
