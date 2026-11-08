"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOKKEEPERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type CellResult = { error?: string };

const money = z.coerce.number().min(0).max(100_000_000);
const paise = (inr: number) => Math.round(inr * 100);
const date = z.string().date();
const text = (max: number) => z.string().trim().max(max);

/**
 * One cell at a time, the way a spreadsheet saves. The column is picked from a
 * fixed map rather than taken from the caller — `field` arrives from the
 * browser, and a column name cannot be a bound parameter, so letting it reach
 * the SQL would hand over the whole row.
 */
const EXPENSE_FIELDS = {
  spent_on: date,
  description: text(200).min(1, "An expense needs a description."),
  category_id: text(40).min(1),
  amount_paise: money,
  mode: text(20),
  reference: text(60),
  vendor: text(80),
} as const;

const BILL_FIELDS = {
  bill_number: text(40),
  bill_date: date,
  due_on: text(10),
  amount_paise: money,
  gst_paise: money,
} as const;

export async function updateExpenseCell(id: string, field: string, raw: string): Promise<CellResult> {
  const staff = await assertRole(BOOKKEEPERS);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown row." };
  if (!(field in EXPENSE_FIELDS)) return { error: "That column can't be edited." };
  const parsed = EXPENSE_FIELDS[field as keyof typeof EXPENSE_FIELDS].safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That value doesn't fit." };
  const v = String(parsed.data);
  const sql = db();

  if (field === "category_id") {
    const [cat] = await sql<{ id: string }[]>`select id from expense_categories where id = ${v}`;
    if (!cat) return { error: "No such category." };
    await sql`update expenses set category_id = ${cat.id}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else if (field === "vendor") {
    // Blank clears the link; a name not yet on file is created, the same as the
    // add form does, so a new supplier can be typed straight into the row.
    let vendorId: string | null = null;
    if (v) {
      const [found] = await sql<{ id: string }[]>`select id from vendors where lower(name) = lower(${v})`;
      if (found) vendorId = found.id;
      else {
        const [made] = await sql<{ id: string }[]>`insert into vendors (name) values (${v}) returning id`;
        vendorId = made.id;
      }
    }
    await sql`update expenses set vendor_id = ${vendorId}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else if (field === "amount_paise") {
    if (Number(v) <= 0) return { error: "An expense needs an amount." };
    await sql`update expenses set amount_paise = ${paise(Number(v))}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else if (field === "spent_on") {
    await sql`update expenses set spent_on = ${v}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else if (field === "description") {
    await sql`update expenses set description = ${v}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else if (field === "mode") {
    await sql`update expenses set mode = ${v || null}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else {
    await sql`update expenses set reference = ${v || null}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  }

  revalidatePath("/admin/accounts/expenses");
  revalidatePath("/admin/accounts");
  return {};
}

export async function updateBillCell(id: string, field: string, raw: string): Promise<CellResult> {
  const staff = await assertRole(BOOKKEEPERS);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown row." };
  if (!(field in BILL_FIELDS)) return { error: "That column can't be edited." };
  const parsed = BILL_FIELDS[field as keyof typeof BILL_FIELDS].safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That value doesn't fit." };
  const v = String(parsed.data);
  const sql = db();

  if (field === "amount_paise") {
    // A bill cannot drop below what has already gone out against it, or the
    // vendor ledger starts reporting a negative balance.
    const [b] = await sql<{ paid: number }[]>`
      select coalesce((select sum(p.amount_paise) from vendor_payments p where p.vendor_bill_id = ${id}), 0)::bigint as paid`;
    if (paise(Number(v)) < Number(b.paid)) {
      return { error: `₹${(Number(b.paid) / 100).toLocaleString("en-IN")} is already paid against this bill.` };
    }
    await sql`update vendor_bills set amount_paise = ${paise(Number(v))}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else if (field === "gst_paise") {
    await sql`update vendor_bills set gst_paise = ${paise(Number(v))}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else if (field === "bill_date") {
    await sql`update vendor_bills set bill_date = ${v}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else if (field === "due_on") {
    if (v && !date.safeParse(v).success) return { error: "Use a real date, or clear it." };
    await sql`update vendor_bills set due_on = ${v || null}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else {
    await sql`update vendor_bills set bill_number = ${v || null}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  }

  revalidatePath("/admin/accounts/vendors");
  revalidatePath("/admin/accounts");
  return {};
}

/** Owner only — an edited row keeps a trail, a deleted one leaves nothing. */
export async function deleteExpense(id: string): Promise<CellResult> {
  await assertRole(["owner"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown row." };
  const [gone] = await db()<{ id: string }[]>`delete from expenses where id = ${id} returning id`;
  if (!gone) return { error: "That row is already gone." };
  revalidatePath("/admin/accounts/expenses");
  revalidatePath("/admin/accounts");
  return {};
}

export async function deleteBill(id: string): Promise<CellResult> {
  await assertRole(["owner"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown row." };
  const sql = db();
  const [p] = await sql<{ n: number }[]>`select count(*)::int as n from vendor_payments where vendor_bill_id = ${id}`;
  if (p.n > 0) return { error: "Payments are booked against this bill. Reverse those first." };
  const [gone] = await sql<{ id: string }[]>`delete from vendor_bills where id = ${id} returning id`;
  if (!gone) return { error: "That bill is already gone." };
  revalidatePath("/admin/accounts/vendors");
  revalidatePath("/admin/accounts");
  return {};
}
