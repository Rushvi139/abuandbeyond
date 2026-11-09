"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOKKEEPERS, MANAGERS, assertRole } from "@/lib/auth";
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
  note: text(300),
  vendor: text(80),
} as const;

const BILL_FIELDS = {
  bill_number: text(40),
  note: text(300),
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
  } else if (field === "note") {
    await sql`update expenses set note = ${v || null}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
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
  } else if (field === "note") {
    await sql`update vendor_bills set note = ${v || null}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else {
    await sql`update vendor_bills set bill_number = ${v || null}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  }

  revalidatePath("/admin/accounts/vendors");
  revalidatePath("/admin/accounts");
  return {};
}

const VENDOR_FIELDS = {
  name: text(80).min(2, "A vendor needs a name."),
  category: text(60),
  contact_person: text(80),
  phone: text(20),
  email: text(120),
  gstin: text(20),
  payment_terms_days: text(4),
  notes: text(400),
} as const;

export async function updateVendorCell(id: string, field: string, raw: string): Promise<CellResult> {
  await assertRole(BOOKKEEPERS);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown vendor." };
  if (!(field in VENDOR_FIELDS)) return { error: "That column can't be edited." };
  const parsed = VENDOR_FIELDS[field as keyof typeof VENDOR_FIELDS].safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That value doesn't fit." };
  const v = String(parsed.data);
  const sql = db();

  if (field === "name") {
    // Two vendors with the same name make the ledger unreadable, and the
    // expense register matches vendors by name when you type one in.
    const [clash] = await sql<{ id: string }[]>`select id from vendors where lower(name) = lower(${v}) and id <> ${id}`;
    if (clash) return { error: "Another vendor already has that name." };
    await sql`update vendors set name = ${v} where id = ${id}`;
  } else if (field === "payment_terms_days") {
    const n = v === "" ? null : Number(v);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 365)) return { error: "Terms are a whole number of days, 0–365." };
    await sql`update vendors set payment_terms_days = ${n} where id = ${id}`;
  } else if (field === "category") {
    await sql`update vendors set category = ${v || null} where id = ${id}`;
  } else if (field === "contact_person") {
    await sql`update vendors set contact_person = ${v || null} where id = ${id}`;
  } else if (field === "phone") {
    await sql`update vendors set phone = ${v || null} where id = ${id}`;
  } else if (field === "email") {
    await sql`update vendors set email = ${v || null} where id = ${id}`;
  } else if (field === "gstin") {
    await sql`update vendors set gstin = ${v || null} where id = ${id}`;
  } else {
    await sql`update vendors set notes = ${v || null} where id = ${id}`;
  }

  revalidatePath(`/admin/accounts/vendors/${id}`);
  revalidatePath("/admin/accounts/vendors");
  revalidatePath("/admin/accounts");
  return {};
}

const INGREDIENT_FIELDS = {
  name: text(80).min(2, "An ingredient needs a name."),
  procurement_group: text(60),
  rate: money,
  reorder_level: money,
} as const;

/**
 * Rates are typed the way they are bought — per kilo, per litre, per piece —
 * and stored per gram, millilitre or piece. The conversion lives here and in
 * `saveIngredient`, and the two must agree or the recipe costing moves by
 * three orders of magnitude.
 */
export async function updateIngredientCell(id: string, field: string, raw: string): Promise<CellResult> {
  await assertRole(MANAGERS);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown ingredient." };
  if (!(field in INGREDIENT_FIELDS)) return { error: "That column can't be edited." };
  const parsed = INGREDIENT_FIELDS[field as keyof typeof INGREDIENT_FIELDS].safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That value doesn't fit." };
  const v = String(parsed.data);
  const sql = db();

  if (field === "name") {
    const [clash] = await sql<{ id: string }[]>`select id from ingredients where lower(name) = lower(${v}) and id <> ${id}`;
    if (clash) return { error: "Another ingredient already has that name." };
    await sql`update ingredients set name = ${v} where id = ${id}`;
  } else if (field === "procurement_group") {
    await sql`update ingredients set procurement_group = ${v || null} where id = ${id}`;
  } else if (field === "rate") {
    const [ing] = await sql<{ unit: string }[]>`select unit from ingredients where id = ${id}`;
    if (!ing) return { error: "Unknown ingredient." };
    const perUnit = ing.unit === "pc" ? Number(v) * 100 : (Number(v) * 100) / 1000;
    await sql`update ingredients set rate_paise_per_unit = ${perUnit.toFixed(4)} where id = ${id}`;
  } else {
    // Base units (g / ml / pc), the same as the add form takes, so the two
    // ways of setting a reorder level cannot disagree.
    await sql`update ingredients set reorder_level = ${Number(v)} where id = ${id}`;
  }

  revalidatePath("/admin/stock");
  revalidatePath("/admin/recipes");
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
