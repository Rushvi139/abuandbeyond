"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAID_FROM } from "@/lib/admin/paid-from";

const MANAGERS = ["owner", "manager"] as const;
const Id = z.string().uuid();
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function refresh(propertyId?: string) {
  revalidatePath("/admin/partners");
  if (propertyId) revalidatePath(`/admin/partners/${propertyId}`);
  revalidatePath("/admin/accounts/money");
}

/** How a partner's orders are paid, and how long they have to pay. */
export async function setPartnerBilling(input: { id: string; billing: string; creditDays: number }): Promise<{ error?: string }> {
  await assertRole([...MANAGERS]);
  const p = z.object({ id: Id, billing: z.enum(["guest", "credit"]), creditDays: z.number().int().min(1).max(90) }).safeParse(input);
  if (!p.success) return { error: "Credit days must be between 1 and 90." };
  await db()`update properties set billing = ${p.data.billing}, credit_days = ${p.data.creditDays} where id = ${p.data.id}`;
  refresh(p.data.id);
  return {};
}

/**
 * A statement for everything on the partner's account up to a date that isn't
 * on a statement yet. Locked while it runs, so two clicks can't bill an order
 * twice.
 */
export async function createStatement(input: { propertyId: string; upTo: string; note?: string }): Promise<{ error?: string; id?: string }> {
  const staff = await assertRole([...MANAGERS]);
  const p = z.object({ propertyId: Id, upTo: z.string().date(), note: z.string().trim().max(200).optional() }).safeParse(input);
  if (!p.success) return { error: "Pick the last date the statement covers." };
  const { propertyId, upTo, note } = p.data;
  if (upTo > today()) return { error: "A statement can't cover days that haven't happened yet." };

  return db().begin(async (tx) => {
    const [prop] = await tx<{ creditDays: number }[]>`select credit_days as "creditDays" from properties where id = ${propertyId} for update`;
    if (!prop) return { error: "That partner is gone." };
    const orders = await tx<{ id: string; day: string; total: number }[]>`
      select id, ((created_at at time zone 'Asia/Kolkata')::date)::text as day, total_paise::bigint as total from orders
      where property_id = ${propertyId} and payment_mode = 'credit' and statement_id is null
        and status not in ('pending_payment', 'payment_failed', 'cancelled')
        and (created_at at time zone 'Asia/Kolkata')::date <= ${upTo}::date
      for update`;
    if (!orders.length) return { error: "Nothing unbilled up to that date." };
    const amount = orders.reduce((n, o) => n + Number(o.total), 0);
    const from = orders.map((o) => o.day).sort()[0];
    const [st] = await tx<{ id: string }[]>`
      insert into partner_statements (property_id, number, period_from, period_to, order_count, amount_paise, issued_on, due_on, note, created_by)
      values (${propertyId}, ${"ST-"} || lpad(nextval('partner_statement_seq')::text, 4, '0'), ${from}::date, ${upTo}::date, ${orders.length}, ${amount},
        ${today()}::date, ${today()}::date + ${prop.creditDays}::int, ${note || null}, ${staff.id})
      returning id`;
    await tx`update orders set statement_id = ${st.id} where id in ${tx(orders.map((o) => o.id))}`;
    refresh(propertyId);
    return { id: st.id };
  });
}

/** The partner paid: when, into which account, and the bank or UPI reference. */
export async function markStatementPaid(input: { id: string; paidOn: string; paidFrom: string; reference?: string }): Promise<{ error?: string }> {
  await assertRole([...MANAGERS]);
  const p = z
    .object({ id: Id, paidOn: z.string().date(), paidFrom: z.enum(PAID_FROM), reference: z.string().trim().max(80).optional() })
    .safeParse(input);
  if (!p.success) return { error: "Say when it was paid and into which account." };
  const [row] = await db()<{ propertyId: string }[]>`
    update partner_statements set paid_on = ${p.data.paidOn}, paid_from = ${p.data.paidFrom}, reference = ${p.data.reference || null}
    where id = ${p.data.id} and paid_on is null returning property_id as "propertyId"`;
  if (!row) return { error: "That statement is already marked paid." };
  refresh(row.propertyId);
  return {};
}

/** A paid statement marked by mistake goes back to outstanding. */
export async function unmarkStatementPaid(id: string): Promise<{ error?: string }> {
  await assertRole(["owner"]);
  const [row] = await db()<{ propertyId: string }[]>`
    update partner_statements set paid_on = null, paid_from = null, reference = null where id = ${Id.parse(id)} returning property_id as "propertyId"`;
  if (row) refresh(row.propertyId);
  return {};
}

/** A new private link for the partner; the old one stops working. */
export async function rotatePartnerLink(propertyId: string): Promise<{ error?: string }> {
  await assertRole([...MANAGERS]);
  await db()`update properties set view_token = replace(gen_random_uuid()::text, '-', '') where id = ${Id.parse(propertyId)}`;
  refresh(propertyId);
  return {};
}
