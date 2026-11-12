import "server-only";
import { z } from "zod";
import type { Sql } from "postgres";
import { db } from "@/lib/db";
import { checkCoupon } from "@/lib/orders/coupons";
import { isBookableSlot } from "@/lib/hours";
import { gstOn } from "@/lib/pricing";
import { rememberable } from "@/lib/stays-search";

/** Matches PRECISE_M in lib/orders/nav.ts: a pin this good can locate a hotel. */
const PIN_GOOD_ENOUGH_M = 150;

/**
 * Which Stay Directory place this order is going to, learning new ones.
 *
 *  - A hotel picked from the suggestions is used if it is still active.
 *  - A typed name that matches one we know (ignoring case) is linked to it.
 *  - A typed hotel, villa or homestay we have never seen is added as a
 *    guest-sourced stay, so the next guest finds it. "Home" never is: that
 *    is a private address, and the list is shown to other people.
 *
 * A precise guest pin fills in a place's location only when it has none —
 * it never moves a Google place.
 */
async function resolveStay(tx: Sql, input: z.infer<typeof CheckoutSchema>): Promise<{ id: string; learned: boolean } | null> {
  const pin =
    input.lat != null && input.lng != null && input.accuracy != null && input.accuracy <= PIN_GOOD_ENOUGH_M
      ? { lat: input.lat, lng: input.lng }
      : null;
  const fill = async (id: string) => {
    if (pin) await tx`update stays set lat = ${pin.lat}, lng = ${pin.lng}, updated_at = now() where id = ${id} and lat is null`;
  };

  if (input.stayId) {
    const [s] = await tx<{ id: string }[]>`select id from stays where id = ${input.stayId} and active`;
    if (s) {
      await fill(s.id);
      return { id: s.id, learned: false };
    }
  }

  const name = (input.propertyName ?? "").replace(/\s+/g, " ").trim();
  if (input.stayType === "home" || input.stayType === "other" || !rememberable(name)) return null;

  const [known] = await tx<{ id: string }[]>`
    select id from stays where active and lower(name) = lower(${name})
    order by (source is distinct from 'guest') desc, (lat is not null) desc limit 1`;
  if (known) {
    await fill(known.id);
    return { id: known.id, learned: false };
  }

  const [added] = await tx<{ id: string }[]>`
    insert into stays (name, lat, lng, source, note)
    values (${name}, ${pin?.lat ?? null}, ${pin?.lng ?? null}, 'guest', ${`Added from a guest order (${input.stayType})`})
    on conflict (lower(name), coalesce(zone, '')) where place_id is null do nothing
    returning id`;
  if (added) return { id: added.id, learned: true };
  // Someone added the same name a moment ago (or it was switched off): use that row if it is live.
  const [again] = await tx<{ id: string }[]>`select id from stays where active and lower(name) = lower(${name}) limit 1`;
  return again ? { id: again.id, learned: false } : null;
}

export const CheckoutSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "10-digit Indian mobile number"),
  altPhone: z.string().trim().regex(/^[6-9]\d{9}$/, "10-digit Indian mobile number").optional().or(z.literal("")),
  stayType: z.enum(["hotel", "villa", "homestay", "home", "other"]),
  propertyName: z.string().trim().max(120).optional().or(z.literal("")),
  roomOrLandmark: z.string().trim().max(120).optional().or(z.literal("")),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /** How accurate the phone said the pin was, in metres. */
  accuracy: z.number().min(0).max(100_000).optional(),
  /** A hotel picked from the Stay Directory suggestions. Checked against the table below. */
  stayId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  sourceRef: z.string().trim().max(60).optional(),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  /** ISO instant for a scheduled delivery; empty or absent means as soon as possible. */
  scheduledFor: z.string().trim().max(40).optional().or(z.literal("")),
  payOnDelivery: z.boolean().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.number().int().min(1).max(20),
        optionIds: z.array(z.string().uuid()).max(5).default([]),
        addonIds: z.array(z.string().uuid()).max(5).default([]),
        note: z.string().trim().max(120).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(30),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

type ItemRow = { id: string; name: string; station_id: string; cuisine: string; is_veg: boolean; price_paise: number; available: boolean; active: boolean };
type OptRow = { id: string; name: string; price_delta_paise: number; group_name: string; menu_item_id: string };
type AddonRow = { id: string; name: string; price_paise: number; menu_item_id: string };

/** Prices the cart from the database and creates customer + order (pending_payment). */
export async function createOrder(input: CheckoutInput, opts: { source?: string; createdBy?: string | null } = {}) {
  const itemIds = [...new Set(input.lines.map((l) => l.itemId))];
  const sql = db();
  const items = await sql<ItemRow[]>`select id, name, station_id, cuisine, is_veg, price_paise, available, active from menu_items where id in ${sql(itemIds)}`;
  const byId = new Map(items.map((i) => [i.id, i]));
  const optIds = [...new Set(input.lines.flatMap((l) => l.optionIds))];
  const addonIds = [...new Set(input.lines.flatMap((l) => l.addonIds))];
  const opts_ = optIds.length
    ? await sql<OptRow[]>`select o.id, o.name, o.price_delta_paise, g.name as group_name, g.menu_item_id
        from options o join option_groups g on g.id = o.option_group_id where o.id in ${sql(optIds)} and o.active`
    : [];
  const addons = addonIds.length
    ? await sql<AddonRow[]>`select a.id, a.name, a.price_paise, ma.menu_item_id
        from addons a join menu_item_addons ma on ma.addon_id = a.id where a.id in ${sql(addonIds)} and a.active`
    : [];

  type Priced = { item: ItemRow; qty: number; unit: number; options: OptRow[]; addons: AddonRow[]; note: string | null };
  const priced: Priced[] = input.lines.map((l) => {
    const item = byId.get(l.itemId);
    if (!item || !item.active) throw new Error("An item in your bag is no longer on the menu");
    if (!item.available) throw new Error(`${item.name} is sold out right now`);
    const options = l.optionIds.map((id) => {
      const o = opts_.find((x) => x.id === id && x.menu_item_id === item.id);
      if (!o) throw new Error(`Invalid choice for ${item.name}`);
      return o;
    });
    const adds = l.addonIds.map((id) => {
      const a = addons.find((x) => x.id === id && x.menu_item_id === item.id);
      if (!a) throw new Error(`Invalid add-on for ${item.name}`);
      return a;
    });
    const unit = item.price_paise + options.reduce((n, o) => n + o.price_delta_paise, 0) + adds.reduce((n, a) => n + a.price_paise, 0);
    return { item, qty: l.qty, unit, options, addons: adds, note: l.note || null };
  });

  // every required option group must have a choice
  const groups = await sql<{ menu_item_id: string; id: string; name: string }[]>`select menu_item_id, id, name from option_groups where required and menu_item_id in ${sql(itemIds)}`;
  for (const p of priced) {
    for (const g of groups.filter((g) => g.menu_item_id === p.item.id)) {
      if (!p.options.some((o) => o.group_name === g.name)) throw new Error(`Choose ${g.name.toLowerCase()} for ${p.item.name}`);
    }
  }

  const subtotal = priced.reduce((n, p) => n + p.unit * p.qty, 0);
  const [{ value: feeJson }] = await sql<{ value: number }[]>`select value from settings where key = 'delivery_fee_paise'`;
  const deliveryFee = Number(feeJson) || 0;
  const phone = "+91" + input.phone;

  // Re-checked here against the kitchen's own clock. A slot the browser
  // offered ten minutes ago may no longer have the lead time, and the value
  // itself arrives from a form, so it is never trusted as given.
  let scheduledFor: Date | null = null;
  if (input.scheduledFor) {
    const at = new Date(input.scheduledFor);
    if (!isBookableSlot(at)) throw new Error("That delivery time has passed. Pick another slot.");
    scheduledFor = at;
  }

  return sql.begin(async (tx) => {
    // The coupon is re-checked here, inside the transaction, against the price
    // the server just worked out. Whatever the browser said the discount was
    // is not consulted — it is a number from a form.
    let coupon: { id: string; code: string } | null = null;
    let discount = 0;
    if (input.couponCode) {
      // Lock the coupon row so two people spending the last redemption at the
      // same moment cannot both pass the count.
      await tx`select id from coupons where upper(code) = upper(${input.couponCode}) for update`;
      const check = await checkCoupon(input.couponCode, subtotal, phone, tx as unknown as Sql);
      if (!check.ok) throw new Error(check.reason);
      coupon = { id: check.coupon.id, code: check.coupon.code };
      discount = check.discountPaise;
    }

    // GST is charged on what the customer actually pays for the food, so the
    // discount comes off the taxable value before the 5% is worked out.
    const gst = gstOn(subtotal - discount);
    const total = subtotal - discount + gst + deliveryFee;
    const [customer] = await tx<{ id: string }[]>`insert into customers (phone, name) values (${phone}, ${input.name})
      on conflict (phone) do update set name = coalesce(excluded.name, customers.name) returning id`;
    const [property] = input.sourceRef
      ? await tx<{ id: string }[]>`select id from properties where slug = ${input.sourceRef} and active`
      : [];
    const stay = await resolveStay(tx as unknown as Sql, input);
    const [order] = await tx<{ id: string; order_code: string; order_number: number }[]>`insert into orders
      (customer_id, status, source, source_ref, property_id, stay_id, location_accuracy_m, stay_type, property_name, room_or_landmark, lat, lng, notes,
       alt_phone, scheduled_for, payment_mode, subtotal_paise, discount_paise, promo_code, gst_paise, delivery_fee_paise, total_paise, created_by)
      values (${customer.id}, 'pending_payment', ${opts.source ?? "web"}, ${input.sourceRef ?? null}, ${property?.id ?? null},
        ${stay?.id ?? null}, ${input.lat != null && input.accuracy != null ? Math.round(input.accuracy) : null},
        ${input.stayType}, ${input.propertyName || null}, ${input.roomOrLandmark || null}, ${input.lat ?? null}, ${input.lng ?? null},
        ${input.notes || null}, ${input.altPhone ? "+91" + input.altPhone : null}, ${scheduledFor}, ${input.payOnDelivery ? "on_delivery" : "online"}, ${subtotal}, ${discount}, ${coupon?.code ?? null}, ${gst}, ${deliveryFee}, ${total}, ${opts.createdBy ?? null})
      returning id, order_code, order_number`;
    if (stay?.learned) await tx`update stays set first_order_id = ${order.id} where id = ${stay.id} and first_order_id is null`;
    for (const p of priced) {
      const [oi] = await tx<{ id: string }[]>`insert into order_items
        (order_id, menu_item_id, name_snapshot, station_id, cuisine, is_veg, unit_price_paise, quantity, line_total_paise, note)
        values (${order.id}, ${p.item.id}, ${p.item.name}, ${p.item.station_id}, ${p.item.cuisine}, ${p.item.is_veg}, ${p.unit}, ${p.qty}, ${p.unit * p.qty}, ${p.note})
        returning id`;
      for (const o of p.options)
        await tx`insert into order_item_options (order_item_id, option_id, group_name_snapshot, name_snapshot, price_delta_paise) values (${oi.id}, ${o.id}, ${o.group_name}, ${o.name}, ${o.price_delta_paise})`;
      for (const a of p.addons)
        await tx`insert into order_item_addons (order_item_id, addon_id, name_snapshot, price_paise) values (${oi.id}, ${a.id}, ${a.name}, ${a.price_paise})`;
    }
    if (coupon) {
      await tx`insert into coupon_redemptions (coupon_id, order_id, customer_id, discount_paise)
        values (${coupon.id}, ${order.id}, ${customer.id}, ${discount})`;
    }
    await tx`insert into order_status_events (order_id, from_status, to_status) values (${order.id}, null, 'pending_payment')`;
    return { id: order.id, code: order.order_code, number: order.order_number, totalPaise: total, scheduledFor, discountPaise: discount, promoCode: coupon?.code ?? null, customerName: input.name, phone, customerId: customer.id };
  });
}
