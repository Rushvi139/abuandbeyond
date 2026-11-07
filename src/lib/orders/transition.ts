import "server-only";
import { db } from "@/lib/db";
import { canTransition, type OrderStatus } from "./status";

/**
 * The only code allowed to change orders.status. Enforces the state machine, writes the
 * status event, stamps paid_at / delivered_at, and on delivery deducts recipe stock.
 */
export async function transition(orderId: string, to: OrderStatus, opts: { actorId?: string | null; note?: string | null; prepMinutes?: number | null } = {}) {
  return db().begin(async (tx) => {
    const [cur] = await tx<{ status: OrderStatus }[]>`select status from orders where id = ${orderId} for update`;
    if (!cur) throw new Error("order not found");
    if (cur.status === to) return cur.status; // idempotent
    if (!canTransition(cur.status, to)) throw new Error(`cannot go from ${cur.status} to ${to}`);

    await tx`update orders set
        status = ${to},
        paid_at = case when ${to} = 'paid' then now() else paid_at end,
        delivered_at = case when ${to} = 'delivered' then now() else delivered_at end,
        prep_minutes = coalesce(${opts.prepMinutes ?? null}, prep_minutes),
        cancelled_reason = case when ${to} = 'cancelled' then ${opts.note ?? null} else cancelled_reason end
      where id = ${orderId}`;
    await tx`insert into order_status_events (order_id, from_status, to_status, actor_id, note)
      values (${orderId}, ${cur.status}, ${to}, ${opts.actorId ?? null}, ${opts.note ?? null})`;

    if (to === "delivered") {
      // consumption: each recipe line × quantity ordered, at the ingredient's current rate
      await tx`insert into stock_movements (ingredient_id, kind, quantity, unit_cost_paise, order_id, actor_id)
        select r.ingredient_id, 'consumption', -(r.quantity * oi.quantity), i.rate_paise_per_unit, ${orderId}, ${opts.actorId ?? null}
        from order_items oi
        join recipe_lines r on r.menu_item_id = oi.menu_item_id
        join ingredients i on i.id = r.ingredient_id
        where oi.order_id = ${orderId}`;
    }
    return to;
  });
}
