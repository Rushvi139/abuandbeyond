import "server-only";
import { db } from "@/lib/db";
import { kitchenLoading } from "@/lib/admin/recipe-queries";

/**
 * The owner's end-of-night numbers for one business day.
 *
 * A business day runs 5 AM to 5 AM IST, not midnight to midnight: the
 * evening shift cooks until 2 AM, and a 1 AM order belongs to the night it
 * was cooked in, not to the next morning's lunch.
 *
 * Food cost here is what the recipes say the dishes sold should have used,
 * at today's ingredient rates, plus the kitchen loading % and packaging —
 * the same arithmetic as the recipe book. It is a target to hold the
 * kitchen to, not what was spent at the market; vendor bills show that.
 */
export const BUSINESS_DAY_STARTS_AT_HOUR = 5;

const SOLD = ["pending_payment", "payment_failed", "cancelled"];

export type DayClose = {
  orders: number;
  netPaise: number; // food after discount, before GST
  discountPaise: number;
  gstPaise: number;
  deliveryPaise: number;
  grossPaise: number; // what guests paid in total
  onlinePaise: number;
  cashPaise: number;
  cashUncollectedPaise: number;
  cancelled: { count: number; paise: number };
  abandoned: number;
  foodPaise: number;
  packagingPaise: number;
  uncostedQty: number; // dishes sold that have no recipe, so cost nothing here
  itemsSold: number;
  topDishes: { name: string; qty: number; netPaise: number }[];
  lowStock: { name: string; unit: string; onHand: number; reorder: number }[];
  spentPaise: { expenses: number; bills: number };
};

export async function dayClose(day: string): Promise<DayClose> {
  const sql = db();
  const loading = await kitchenLoading();
  const h = `${BUSINESS_DAY_STARTS_AT_HOUR} hours`;
  // Same expression everywhere below, so every number is for the same night.
  const inDay = (col: string) => sql`(((${sql(col)} at time zone 'Asia/Kolkata') - ${h}::interval)::date = ${day}::date)`;

  const [sales] = await sql<
    { orders: number; net: number; discount: number; gst: number; delivery: number; gross: number; online: number; cash: number; uncollected: number }[]
  >`
    select count(*)::int as orders,
      coalesce(sum(subtotal_paise - discount_paise), 0)::bigint as net,
      coalesce(sum(discount_paise), 0)::bigint as discount,
      coalesce(sum(gst_paise), 0)::bigint as gst,
      coalesce(sum(delivery_fee_paise), 0)::bigint as delivery,
      coalesce(sum(total_paise), 0)::bigint as gross,
      coalesce(sum(total_paise) filter (where payment_mode = 'online'), 0)::bigint as online,
      coalesce(sum(total_paise) filter (where payment_mode = 'on_delivery'), 0)::bigint as cash,
      coalesce(sum(total_paise) filter (where payment_mode = 'on_delivery' and collected_at is null), 0)::bigint as uncollected
    from orders
    where status <> all(${SOLD}) and not is_demo and ${inDay("paid_at")}`;

  const [cancelled] = await sql<{ count: number; paise: number }[]>`
    select count(*)::int as count, coalesce(sum(total_paise), 0)::bigint as paise
    from orders where status = 'cancelled' and not is_demo and paid_at is not null and ${inDay("paid_at")}`;

  const [abandoned] = await sql<{ n: number }[]>`
    select count(*)::int as n from orders
    where status in ('pending_payment', 'payment_failed') and not is_demo and ${inDay("created_at")}`;

  const [cost] = await sql<{ food: number; packaging: number; uncosted: number; items: number }[]>`
    with sold as (
      select oi.menu_item_id, sum(oi.quantity)::int as qty
      from order_items oi join orders o on o.id = oi.order_id
      where o.status <> all(${SOLD}) and not o.is_demo and ${inDay("o.paid_at")}
      group by 1
    ), dish as (
      select m.id, m.packaging_cost_paise as packaging,
        (select sum(r.quantity * i.rate_paise_per_unit) from recipe_lines r join ingredients i on i.id = r.ingredient_id where r.menu_item_id = m.id) as ingredients
      from menu_items m
    )
    select coalesce(sum(sold.qty * coalesce(dish.ingredients, 0)), 0)::float as food,
      coalesce(sum(sold.qty * dish.packaging), 0)::float as packaging,
      coalesce(sum(sold.qty) filter (where dish.ingredients is null), 0)::int as uncosted,
      coalesce(sum(sold.qty), 0)::int as items
    from sold join dish on dish.id = sold.menu_item_id`;

  const topDishes = await sql<{ name: string; qty: number; netPaise: number }[]>`
    select oi.name_snapshot as name, sum(oi.quantity)::int as qty, sum(oi.line_total_paise)::bigint as "netPaise"
    from order_items oi join orders o on o.id = oi.order_id
    where o.status <> all(${SOLD}) and not o.is_demo and ${inDay("o.paid_at")}
    group by 1 order by 2 desc, 3 desc limit 8`;

  const lowStock = await sql<{ name: string; unit: string; onHand: number; reorder: number }[]>`
    select name, unit::text as unit, on_hand::float as "onHand", reorder_level::float as reorder
    from stock_on_hand where is_low order by name limit 30`;

  // Money that went out the same calendar day. Bills and expenses carry a
  // date, not a time, so the 5 AM rule can't apply to them.
  const [spent] = await sql<{ expenses: number; bills: number }[]>`
    select (select coalesce(sum(amount_paise), 0) from expenses where spent_on = ${day}::date)::bigint as expenses,
           (select coalesce(sum(amount_paise), 0) from vendor_bills where bill_date = ${day}::date)::bigint as bills`;

  return {
    orders: sales.orders,
    netPaise: Number(sales.net),
    discountPaise: Number(sales.discount),
    gstPaise: Number(sales.gst),
    deliveryPaise: Number(sales.delivery),
    grossPaise: Number(sales.gross),
    onlinePaise: Number(sales.online),
    cashPaise: Number(sales.cash),
    cashUncollectedPaise: Number(sales.uncollected),
    cancelled: { count: cancelled.count, paise: Number(cancelled.paise) },
    abandoned: abandoned.n,
    foodPaise: Math.round(cost.food * loading),
    packagingPaise: Math.round(cost.packaging),
    uncostedQty: cost.uncosted,
    itemsSold: cost.items,
    topDishes: topDishes.map((t) => ({ ...t, netPaise: Number(t.netPaise) })),
    lowStock,
    spentPaise: { expenses: Number(spent.expenses), bills: Number(spent.bills) },
  };
}

/** Today's business day in IST, by the 5 AM rule. */
export function currentBusinessDay(now = new Date()): string {
  const shifted = new Date(now.getTime() - BUSINESS_DAY_STARTS_AT_HOUR * 3600_000);
  return shifted.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
