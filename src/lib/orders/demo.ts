"use server";

import { revalidatePath } from "next/cache";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

const PROPERTIES = [
  { stay: "hotel", name: "Hotel Hillock", room: "Room 204", lat: 24.5925, lng: 72.7083 },
  { stay: "hotel", name: "Cama Rajputana Club", room: "Room 11", lat: 24.5938, lng: 72.7121 },
  { stay: "homestay", name: "Nakki Lake Homestay", room: "Blue gate, near the boat club", lat: 24.5924, lng: 72.7005 },
  { stay: "villa", name: "Sunset Point Villa", room: "Gate 2", lat: 24.5869, lng: 72.6948 },
];
const NAMES = ["Test — Meera", "Test — Arjun", "Test — Kabir", "Test — Sana"];
const NOTES = ["Less spicy please", "Extra napkins", "Call when you reach the gate", null];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/**
 * Creates a demo order that is already paid and walks the normal pipeline:
 * Kitchen Display → rider → delivered. It is flagged `is_demo`, which keeps it
 * out of every money view, out of the exports, and out of stock deduction.
 *
 * This is the one path that marks an order paid without a gateway, which is
 * why it is staff-only and why the flag is set in the same statement.
 */
export async function createDemoOrder() {
  const staff = await assertRole(MANAGERS);
  const sql = db();
  const where = pick(PROPERTIES);
  const name = pick(NAMES);
  const phone = "+9199" + String(Math.floor(10000000 + Math.random() * 89999999));

  const items = await sql<{ id: string; name: string; price_paise: number; station_id: string | null; cuisine: string | null; is_veg: boolean }[]>`
    select id, name, price_paise, station_id, cuisine, is_veg
    from menu_items where active and available order by random() limit ${1 + Math.floor(Math.random() * 3)}`;
  if (items.length === 0) throw new Error("No dishes on the menu to demo with");

  const lines = items.map((i) => ({ item: i, qty: 1 + Math.floor(Math.random() * 2) }));
  const subtotal = lines.reduce((n, l) => n + l.item.price_paise * l.qty, 0);
  const gst = Math.round(subtotal * 0.05);

  const orderId = await sql.begin(async (tx) => {
    const [customer] = await tx<{ id: string }[]>`
      insert into customers (phone, name) values (${phone}, ${name})
      on conflict (phone) do update set name = excluded.name returning id`;
    const [order] = await tx<{ id: string; order_code: string; order_number: number }[]>`
      insert into orders (customer_id, status, source, stay_type, property_name, room_or_landmark,
        lat, lng, notes, subtotal_paise, gst_paise, delivery_fee_paise, total_paise, paid_at, is_demo)
      values (${customer.id}, 'paid', 'demo', ${where.stay}, ${where.name}, ${where.room},
        ${where.lat}, ${where.lng}, ${pick(NOTES)}, ${subtotal}, ${gst}, 0, ${subtotal + gst}, now(), true)
      returning id, order_code, order_number`;
    for (const l of lines) {
      await tx`insert into order_items (order_id, menu_item_id, name_snapshot, station_id, cuisine, is_veg,
          unit_price_paise, quantity, line_total_paise)
        values (${order.id}, ${l.item.id}, ${l.item.name}, ${l.item.station_id}, ${l.item.cuisine}, ${l.item.is_veg},
          ${l.item.price_paise}, ${l.qty}, ${l.item.price_paise * l.qty})`;
    }
    await tx`insert into order_status_events (order_id, from_status, to_status, actor_id, note)
      values (${order.id}, 'pending_payment', 'paid', ${staff.id}, 'demo order')`;
    return order.id;
  });

  revalidatePath("/admin");
  revalidatePath("/kitchen");
  revalidatePath("/rider");
  return orderId;
}

/** Clears every demo order and the test customers they created. */
export async function clearDemoOrders() {
  await assertRole(MANAGERS);
  const sql = db();
  await sql.begin(async (tx) => {
    const ids = await tx<{ id: string; customer_id: string }[]>`select id, customer_id from orders where is_demo`;
    if (ids.length === 0) return;
    const orderIds = ids.map((o) => o.id);
    await tx`delete from order_item_addons where order_item_id in (select id from order_items where order_id in ${tx(orderIds)})`;
    await tx`delete from order_item_options where order_item_id in (select id from order_items where order_id in ${tx(orderIds)})`;
    await tx`delete from stock_movements where order_id in ${tx(orderIds)}`;
    await tx`delete from order_status_events where order_id in ${tx(orderIds)}`;
    await tx`delete from order_items where order_id in ${tx(orderIds)}`;
    await tx`delete from payments where order_id in ${tx(orderIds)}`;
    await tx`delete from orders where id in ${tx(orderIds)}`;
    // customers created only by demos (their phones all start +9199 and have no real orders left)
    await tx`delete from customers c where c.id in ${tx([...new Set(ids.map((o) => o.customer_id))])}
      and not exists (select 1 from orders o where o.customer_id = c.id)`;
  });
  revalidatePath("/admin");
  revalidatePath("/kitchen");
  revalidatePath("/rider");
}
