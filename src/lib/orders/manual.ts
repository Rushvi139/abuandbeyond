"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOrder } from "@/lib/orders/create";
import { transition } from "@/lib/orders/transition";

/**
 * An order taken by hand: a phone call, a walk-in, a WhatsApp message.
 *
 * It goes through the same `createOrder` as the website — same prices from
 * the database, same GST, same KOT, same stock deduction on delivery — so the
 * books cannot tell the two apart except by `source = 'manual'`. Only the
 * money differs: it is taken at the counter (cash or UPI, recorded straight
 * into the cash book) or collected by the rider at the door.
 *
 * Kitchen staff can place these too, since they are the ones answering the
 * phone during service.
 */
const STAFF = ["owner", "manager", "kitchen"] as const;

const Line = z.object({
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  optionIds: z.array(z.string().uuid()).max(5).default([]),
  addonIds: z.array(z.string().uuid()).max(16).default([]),
  note: z.string().trim().max(120).optional().default(""),
});

const Manual = z
  .object({
    lines: z.array(Line).min(1, "Add at least one item").max(40),
    name: z.string().trim().max(80).optional().default(""),
    phone: z.string().trim().regex(/^([6-9]\d{9})?$/, "10-digit mobile number, or leave it empty").optional().default(""),
    kind: z.enum(["delivery", "pickup"]),
    stayType: z.enum(["hotel", "villa", "homestay", "home"]).optional().default("hotel"),
    propertyName: z.string().trim().max(120).optional().default(""),
    stayId: z.string().uuid().optional().or(z.literal("")),
    roomOrLandmark: z.string().trim().max(120).optional().default(""),
    payment: z.enum(["cash", "upi", "collect", "complimentary"]),
    /** Why it's free. Required for a complimentary order. */
    compReason: z.string().trim().max(200).optional().default(""),
    kitchenNote: z.string().trim().max(200).optional().default(""),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "delivery" && !d.phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "A delivery needs the guest's number, for the rider." });
    if (d.kind === "delivery" && !d.propertyName && !d.roomOrLandmark) ctx.addIssue({ code: "custom", path: ["propertyName"], message: "Where is it going? Add the hotel or a landmark." });
    if (d.payment === "complimentary" && d.compReason.length < 3) ctx.addIssue({ code: "custom", path: ["compReason"], message: "Say who it's for and why it's complimentary." });
    if (d.kind === "pickup" && d.payment === "collect") ctx.addIssue({ code: "custom", path: ["payment"], message: "A pickup is paid at the counter: cash or UPI." });
  });

export type ManualOrderInput = z.input<typeof Manual>;

/** Walk-ins with no number share one customer record, so the CRM isn't flooded with blanks. */
const WALK_IN_PHONE = "0000000000";

export async function createManualOrder(raw: ManualOrderInput): Promise<{ error?: string; id?: string; number?: number; code?: string }> {
  const staff = await assertRole([...STAFF]);
  const parsed = Manual.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the order." };
  const d = parsed.data;
  // Giving food away is the owner's or manager's call, not the pass's.
  if (d.payment === "complimentary" && !["owner", "manager"].includes(staff.role)) return { error: "Only the owner or a manager can make an order complimentary." };

  try {
    const order = await createOrder(
      {
        name: d.phone ? d.name || "Guest" : "Walk-in",
        phone: d.phone || WALK_IN_PHONE,
        altPhone: "",
        stayType: d.kind === "pickup" ? "other" : d.stayType,
        propertyName: d.kind === "pickup" ? "Pickup at kitchen" : d.propertyName,
        stayId: d.kind === "pickup" ? "" : d.stayId ?? "",
        roomOrLandmark: d.kind === "pickup" ? "" : d.roomOrLandmark,
        // A walk-in with no number still has a name worth calling out at the pass.
        notes: !d.phone && d.name ? `Walk-in: ${d.name}` : "",
        couponCode: "",
        scheduledFor: "",
        payOnDelivery: true, // no gateway: money is taken by hand
        lines: d.lines.map((l) => ({ ...l, note: l.note ?? "" })),
      } as Parameters<typeof createOrder>[0],
      { source: "manual", createdBy: staff.id, noDeliveryFee: d.kind === "pickup" },
    );

    const sql = db();
    await transition(order.id, "paid", { actorId: staff.id, note: `manual order (${d.kind}, ${d.payment})` });
    if (d.kitchenNote) await sql`update orders set kitchen_note = ${d.kitchenNote} where id = ${order.id}`;

    // Complimentary: nothing to pay or collect. The menu value stays as the
    // subtotal and the whole of it is the discount, so sales count zero and
    // Day Close can show what was given away.
    if (d.payment === "complimentary") {
      await sql`update orders set discount_paise = subtotal_paise, gst_paise = 0, delivery_fee_paise = 0, total_paise = 0,
        promo_code = 'COMPLIMENTARY', comp_reason = ${d.compReason}, comp_by = ${staff.id},
        collected_at = now(), collected_by = ${staff.id}
        where id = ${order.id}`;
    }

    // Paid at the counter: it is in hand now, so it goes straight into the
    // cash book the same way a rider's collection does.
    if (d.payment === "cash" || d.payment === "upi") {
      await sql.begin(async (tx) => {
        await tx`update orders set collected_at = now(), collected_by = ${staff.id} where id = ${order.id}`;
        await tx`insert into payments (order_id, gateway, gateway_order_id, gateway_payment_id, status, amount_paise, method)
          values (${order.id}, 'on_delivery', ${order.code}, ${"cod_" + order.id}, 'captured', ${order.totalPaise}, ${d.payment})
          on conflict (gateway_payment_id) do nothing`;
      });
    }

    for (const p of ["/admin", "/admin/orders", "/kitchen", "/rider", "/admin/accounts/cash"]) revalidatePath(p);
    return { id: order.id, number: order.number, code: order.code };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't place the order." };
  }
}
