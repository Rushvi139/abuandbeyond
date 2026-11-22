"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOKKEEPERS, MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMenu } from "@/lib/menu/queries";
import type { Category } from "@/lib/menu/types";
import { gstOn } from "@/lib/pricing";
import { balanceAfterEdit, editSummary, editTotals, type EditLine } from "./edit-math";

/**
 * Changing an order after it is placed: the guest calls to add a dish, drop
 * one, change a quantity or add an add-on.
 *
 *  - Owner or manager only, and only before the food leaves (paid, accepted,
 *    preparing, ready). Never on an order already on a partner statement.
 *  - Lines nobody touched keep the price they were sold at; new or changed
 *    lines are priced from today's menu, like a new order.
 *  - The KOT prints again, marked UPDATED, with what changed.
 *  - Money already taken (paid online, or cash collected) is compared with
 *    the new total: the difference is collected at the door, or owed back.
 *  - Status is untouched (that only moves through transition.ts), and stock
 *    is still taken at delivery from whatever the order holds by then.
 */

const EDITABLE = ["paid", "accepted", "preparing", "ready"];

export type EditableLine = {
  orderItemId: string;
  itemId: string;
  name: string;
  qty: number;
  unitPaise: number;
  optionIds: string[];
  optionNames: string[];
  addonIds: string[];
  addonNames: string[];
  note: string | null;
};

export type OrderForEdit = {
  id: string;
  number: number;
  totalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  complimentary: boolean;
  moneyTaken: boolean;
  heldPaise: number;
  lines: EditableLine[];
  menu: Category[];
};

type OrderRow = {
  id: string; number: number; code: string; status: string; mode: string; paid: string | null; collected: string | null;
  comp: string | null; discount: number; fee: number; total: number; statement: string | null;
};

const lockOrder = (tx: ReturnType<typeof db>, id: string) => tx<OrderRow[]>`
  select id, order_number as number, order_code as code, status, payment_mode as mode, paid_at as paid, collected_at as collected,
    comp_reason as comp, discount_paise::bigint as discount, delivery_fee_paise::bigint as fee, total_paise::bigint as total,
    statement_id as statement
  from orders where id = ${id} for update`;

function whyNot(o: OrderRow): string | null {
  if (!EDITABLE.includes(o.status)) return "Only an order that hasn't left the kitchen can be edited.";
  if (o.statement) return "This order is already on a partner statement.";
  return null;
}

const moneyTaken = (o: OrderRow) => (o.mode === "online" && o.paid !== null) || (o.mode === "on_delivery" && o.collected !== null);

async function held(tx: ReturnType<typeof db>, orderId: string) {
  const [r] = await tx<{ n: number }[]>`
    select coalesce(sum(amount_paise - refunded_paise), 0)::bigint as n from payments
    where order_id = ${orderId} and status in ('captured', 'partially_refunded')`;
  return Number(r.n);
}

async function currentLines(tx: ReturnType<typeof db>, orderId: string): Promise<EditableLine[]> {
  return tx<EditableLine[]>`
    select oi.id as "orderItemId", oi.menu_item_id as "itemId", oi.name_snapshot as name, oi.quantity as qty, oi.unit_price_paise::bigint as "unitPaise",
      coalesce((select array_agg(x.option_id::text order by x.id) from order_item_options x where x.order_item_id = oi.id), '{}') as "optionIds",
      coalesce((select array_agg(x.name_snapshot order by x.id) from order_item_options x where x.order_item_id = oi.id), '{}') as "optionNames",
      coalesce((select array_agg(x.addon_id::text order by x.id) from order_item_addons x where x.order_item_id = oi.id), '{}') as "addonIds",
      coalesce((select array_agg(x.name_snapshot order by x.id) from order_item_addons x where x.order_item_id = oi.id), '{}') as "addonNames",
      oi.note
    from order_items oi where oi.order_id = ${orderId} order by oi.id`;
}

export async function orderForEdit(orderId: string): Promise<{ error?: string; order?: OrderForEdit }> {
  await assertRole(MANAGERS);
  if (!z.string().uuid().safeParse(orderId).success) return { error: "Unknown order." };
  const sql = db();
  const [o] = await lockOrder(sql, orderId);
  if (!o) return { error: "Unknown order." };
  const no = whyNot(o);
  if (no) return { error: no };
  const [lines, heldPaise, menu] = await Promise.all([currentLines(sql, orderId), held(sql, orderId), getMenu()]);
  return {
    order: {
      id: o.id, number: o.number, totalPaise: Number(o.total), discountPaise: Number(o.discount), deliveryFeePaise: Number(o.fee),
      complimentary: o.comp !== null, moneyTaken: moneyTaken(o), heldPaise,
      lines: lines.map((l) => ({ ...l, unitPaise: Number(l.unitPaise) })), menu,
    },
  };
}

const LineSchema = z.object({
  orderItemId: z.string().uuid().nullable().optional(),
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).max(30),
  optionIds: z.array(z.string().uuid()).max(5).default([]),
  addonIds: z.array(z.string().uuid()).max(16).default([]),
  note: z.string().trim().max(120).nullable().optional(),
});
const EditSchema = z.object({ orderId: z.string().uuid(), lines: z.array(LineSchema).min(1, "An order needs at least one dish. To drop everything, cancel the order.").max(40) });

const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export async function editOrder(input: z.input<typeof EditSchema>): Promise<{ error?: string; summary?: string; totalPaise?: number; balancePaise?: number }> {
  const staff = await assertRole(MANAGERS);
  const parsed = EditSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the order." };
  const { orderId, lines } = parsed.data;

  try {
    const res = await db().begin(async (t0) => {
      // postgres.js types a transaction apart from the pool; the helpers take either.
      const tx = t0 as unknown as ReturnType<typeof db>;
      const [o] = await lockOrder(tx, orderId);
      if (!o) throw new Error("Unknown order.");
      const no = whyNot(o);
      if (no) throw new Error(no);
      const before = await currentLines(tx, orderId);
      const byItem = new Map(before.map((b) => [b.orderItemId, b]));

      // Price whatever is new or changed from today's menu.
      const itemIds = [...new Set(lines.map((l) => l.itemId))];
      const items = await tx<{ id: string; name: string; station_id: string; cuisine: string; is_veg: boolean; price: number; active: boolean }[]>`
        select id, name, station_id, cuisine, is_veg, price_paise::bigint as price, active from menu_items where id in ${tx(itemIds)}`;
      const optIds = [...new Set(lines.flatMap((l) => l.optionIds))];
      const addIds = [...new Set(lines.flatMap((l) => l.addonIds))];
      type OptRow = { id: string; name: string; delta: number; group: string; item: string; groupId: string };
      type AddRow = { id: string; name: string; price: number; item: string };
      const opts: OptRow[] = optIds.length ? await tx<OptRow[]>`
        select o.id, o.name, o.price_delta_paise::bigint as delta, g.name as group, g.menu_item_id as item, g.id as "groupId"
        from options o join option_groups g on g.id = o.option_group_id where o.id in ${tx(optIds)}` : [];
      const adds: AddRow[] = addIds.length ? await tx<AddRow[]>`
        select a.id, a.name, a.price_paise::bigint as price, ma.menu_item_id as item
        from addons a join menu_item_addons ma on ma.addon_id = a.id where a.id in ${tx(addIds)} and a.active` : [];
      const required = await tx<{ id: string; name: string; item: string }[]>`
        select id, name, menu_item_id as item from option_groups where required and menu_item_id in ${tx(itemIds)}`;

      type Planned = EditLine & { keep: boolean; item: (typeof items)[number]; options: OptRow[]; addons: AddRow[] };
      const planned: Planned[] = lines.map((l) => {
        const item = items.find((i) => i.id === l.itemId);
        if (!item) throw new Error("A dish on this order isn't on the menu any more.");
        const old = l.orderItemId ? byItem.get(l.orderItemId) : undefined;
        if (l.orderItemId && !old) throw new Error("The order changed while you were editing. Close and open it again.");
        const keep = !!old && old.itemId === l.itemId && same(old.optionIds, l.optionIds) && same(old.addonIds, l.addonIds);
        if (keep) {
          return { orderItemId: old!.orderItemId, itemId: l.itemId, name: old!.name, qty: l.qty, unitPaise: Number(old!.unitPaise), optionNames: old!.optionNames, addonNames: old!.addonNames, note: l.note ?? old!.note, keep, item, options: [], addons: [] };
        }
        if (!item.active) throw new Error(`${item.name} is off the menu, so it can't be added.`);
        const options = l.optionIds.map((id) => {
          const x = opts.find((o) => o.id === id && o.item === item.id);
          if (!x) throw new Error(`That choice doesn't belong to ${item.name}.`);
          return x;
        });
        for (const g of required.filter((g) => g.item === item.id))
          if (!options.some((o) => o.groupId === g.id)) throw new Error(`Choose ${g.name.toLowerCase()} for ${item.name}.`);
        const addons = l.addonIds.map((id) => {
          const x = adds.find((a) => a.id === id && a.item === item.id);
          if (!x) throw new Error(`That add-on isn't offered on ${item.name}.`);
          return x;
        });
        const unitPaise = Number(item.price) + options.reduce((n, o) => n + Number(o.delta), 0) + addons.reduce((n, a) => n + Number(a.price), 0);
        return { orderItemId: old?.orderItemId ?? null, itemId: item.id, name: item.name, qty: l.qty, unitPaise, optionNames: options.map((o) => o.name), addonNames: addons.map((a) => a.name), note: l.note ?? old?.note ?? null, keep, item, options, addons };
      });

      const summary = editSummary(before.map((b) => ({ ...b, unitPaise: Number(b.unitPaise) })), planned);
      if (summary === "No change") return { summary, totalPaise: Number(o.total), balancePaise: 0, unchanged: true };

      const t = editTotals(planned, { discountPaise: Number(o.discount), complimentary: o.comp !== null, deliveryFeePaise: Number(o.fee) }, gstOn);

      // Lines that went away, or whose dish/choices changed, are replaced.
      const keepIds = planned.filter((p) => p.keep).map((p) => p.orderItemId!);
      const goneIds = before.map((b) => b.orderItemId).filter((id) => !keepIds.includes(id));
      if (goneIds.length) await tx`delete from order_items where id in ${tx(goneIds)}`;
      for (const p of planned) {
        if (p.keep) {
          await tx`update order_items set quantity = ${p.qty}, line_total_paise = ${p.unitPaise * p.qty}, note = ${p.note ?? null} where id = ${p.orderItemId!}`;
          continue;
        }
        const [row] = await tx<{ id: string }[]>`insert into order_items
          (order_id, menu_item_id, name_snapshot, station_id, cuisine, is_veg, unit_price_paise, quantity, line_total_paise, note)
          values (${orderId}, ${p.item.id}, ${p.item.name}, ${p.item.station_id}, ${p.item.cuisine}, ${p.item.is_veg}, ${p.unitPaise}, ${p.qty}, ${p.unitPaise * p.qty}, ${p.note ?? null})
          returning id`;
        for (const x of p.options)
          await tx`insert into order_item_options (order_item_id, option_id, group_name_snapshot, name_snapshot, price_delta_paise) values (${row.id}, ${x.id}, ${x.group}, ${x.name}, ${x.delta})`;
        for (const x of p.addons)
          await tx`insert into order_item_addons (order_item_id, addon_id, name_snapshot, price_paise) values (${row.id}, ${x.id}, ${x.name}, ${x.price})`;
      }

      const balance = balanceAfterEdit(t.totalPaise, await held(tx, orderId), moneyTaken(o));
      await tx`update orders set subtotal_paise = ${t.subtotalPaise}, discount_paise = ${t.discountPaise}, gst_paise = ${t.gstPaise},
        total_paise = ${t.totalPaise}, balance_paise = ${balance}, edited_at = now(), edit_count = edit_count + 1,
        kot_printed_at = null, updated_at = now()
        where id = ${orderId}`;
      await tx`insert into order_edits (order_id, staff_id, before_total_paise, after_total_paise, summary)
        values (${orderId}, ${staff.id}, ${o.total}, ${t.totalPaise}, ${summary})`;
      return { summary, totalPaise: t.totalPaise, balancePaise: balance, code: o.code };
    });
    revalidateAll("code" in res ? res.code : undefined);
    return { summary: res.summary, totalPaise: res.totalPaise, balancePaise: res.balancePaise };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save the change." };
  }
}

/** The rider has the extra in hand, after an edit on an order already paid. */
export async function collectBalance(orderId: string, method: "cash" | "upi"): Promise<{ error?: string }> {
  const staff = await assertRole(BOOKKEEPERS);
  if (!z.string().uuid().safeParse(orderId).success || !["cash", "upi"].includes(method)) return { error: "Unknown order." };
  const res = await db().begin(async (tx) => {
    const [o] = await tx<{ code: string; balance: number; edits: number }[]>`
      select order_code as code, balance_paise::bigint as balance, edit_count as edits from orders where id = ${orderId} for update`;
    if (!o) return { error: "Unknown order." };
    if (Number(o.balance) <= 0) return { error: "Nothing extra to collect." };
    await tx`insert into payments (order_id, gateway, gateway_order_id, gateway_payment_id, status, amount_paise, method)
      values (${orderId}, 'on_delivery', ${o.code}, ${`bal_${orderId}_${o.edits}`}, 'captured', ${o.balance}, ${method})
      on conflict (gateway_payment_id) do nothing`;
    await tx`update orders set balance_collected_paise = balance_collected_paise + ${o.balance}, balance_paise = 0 where id = ${orderId}`;
    await tx`insert into order_edits (order_id, staff_id, before_total_paise, after_total_paise, summary)
      select ${orderId}, ${staff.id}, total_paise, total_paise, ${`Collected ₹${Number(o.balance) / 100} extra by ${method === "upi" ? "UPI" : "cash"}`} from orders where id = ${orderId}`;
    return { code: o.code };
  });
  if ("error" in res) return { error: res.error };
  revalidateAll(res.code);
  return {};
}

/**
 * The guest is owed money back after an edit made the order cheaper. The
 * refund itself is done by hand (PayU dashboard, or cash back); this records
 * that it was done, against the payment it came out of.
 */
export async function settleRefund(orderId: string): Promise<{ error?: string }> {
  const staff = await assertRole(MANAGERS);
  if (!z.string().uuid().safeParse(orderId).success) return { error: "Unknown order." };
  const res = await db().begin(async (tx) => {
    const [o] = await tx<{ code: string; balance: number }[]>`select order_code as code, balance_paise::bigint as balance from orders where id = ${orderId} for update`;
    if (!o) return { error: "Unknown order." };
    const owed = -Number(o.balance);
    if (owed <= 0) return { error: "No refund owed." };
    const [p] = await tx<{ id: string }[]>`select id from payments where order_id = ${orderId} and status in ('captured', 'partially_refunded')
      and amount_paise - refunded_paise >= ${owed} order by (gateway = 'on_delivery'), created_at desc limit 1`;
    if (!p) return { error: "Couldn't find the payment to refund from." };
    await tx`update payments set refunded_paise = refunded_paise + ${owed}, status = 'partially_refunded' where id = ${p.id}`;
    await tx`update orders set balance_paise = 0 where id = ${orderId}`;
    await tx`insert into order_edits (order_id, staff_id, before_total_paise, after_total_paise, summary)
      select ${orderId}, ${staff.id}, total_paise, total_paise, ${`Refunded ₹${owed / 100} to the guest`} from orders where id = ${orderId}`;
    return { code: o.code };
  });
  if ("error" in res) return { error: res.error };
  revalidateAll(res.code);
  return {};
}

function revalidateAll(code?: string) {
  for (const p of ["/admin", "/admin/orders", "/kitchen", "/rider", "/admin/accounts", "/admin/day-close"]) revalidatePath(p);
  if (code) revalidatePath(`/o/${code}`);
}
