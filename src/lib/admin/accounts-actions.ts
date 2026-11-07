"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/files";

const OWNER = ["owner"] as const;
const paise = (inr: number) => Math.round(inr * 100);

type Q = { <T extends readonly object[]>(s: TemplateStringsArray, ...v: unknown[]): Promise<T> };
async function vendorId(tx: Q, name: string) {
  const [v] = await tx<{ id: string }[]>`insert into vendors (name) values (${name}) on conflict do nothing returning id`;
  if (v) return v.id;
  const [e] = await tx<{ id: string }[]>`select id from vendors where lower(name) = ${name.toLowerCase()} limit 1`;
  return e.id;
}

export async function addExpense(formData: FormData) {
  const staff = await assertRole([...OWNER, "manager"]);
  const d = z.object({
    category: z.string().min(1), spentOn: z.string().date(), description: z.string().trim().min(2).max(200),
    amountInr: z.coerce.number().min(0.01), mode: z.string().trim().max(20).optional().or(z.literal("")),
    reference: z.string().trim().max(60).optional().or(z.literal("")), vendor: z.string().trim().max(80).optional().or(z.literal("")),
  }).parse(Object.fromEntries(formData));
  const sql = db();
  const vid = d.vendor ? await vendorId(sql as unknown as Q, d.vendor) : null;
  await sql`insert into expenses (category_id, spent_on, description, amount_paise, vendor_id, mode, reference, created_by)
    values (${d.category}, ${d.spentOn}, ${d.description}, ${paise(d.amountInr)}, ${vid}, ${d.mode || null}, ${d.reference || null}, ${staff.id})`;
  revalidatePath("/admin/accounts");
}

export async function addVendorBill(formData: FormData) {
  await assertRole([...OWNER, "manager"]);
  const d = z.object({
    vendor: z.string().trim().min(2).max(80), billNumber: z.string().trim().max(60).optional().or(z.literal("")),
    billDate: z.string().date(), amountInr: z.coerce.number().min(0.01), gstInr: z.coerce.number().min(0).default(0), dueOn: z.string().optional().or(z.literal("")),
    paidNow: z.string().optional(), mode: z.string().trim().max(20).optional().or(z.literal("")), reference: z.string().trim().max(60).optional().or(z.literal("")),
  }).parse(Object.fromEntries(formData));
  const file = formData.get("attachment");
  const filePath = file instanceof File && file.size > 0 ? await saveUpload(file, "bills", { maxBytes: 15 * 1024 * 1024 }) : null;
  const sql = db();
  await sql.begin(async (tx) => {
    const vid = await vendorId(tx as unknown as Q, d.vendor);
    const [bill] = await tx<{ id: string }[]>`insert into vendor_bills (vendor_id, bill_number, bill_date, amount_paise, gst_paise, due_on, file_path)
      values (${vid}, ${d.billNumber || null}, ${d.billDate}, ${paise(d.amountInr)}, ${paise(d.gstInr)}, ${d.dueOn || null}, ${filePath}) returning id`;
    if (d.paidNow) {
      await tx`insert into vendor_payments (vendor_id, vendor_bill_id, paid_on, amount_paise, mode, reference) values (${vid}, ${bill.id}, ${d.billDate}, ${paise(d.amountInr)}, ${d.mode || null}, ${d.reference || null})`;
    }
  });
  revalidatePath("/admin/accounts");
}

export async function addVendorPayment(formData: FormData) {
  await assertRole([...OWNER, "manager"]);
  const d = z.object({
    billId: z.string().uuid(), paidOn: z.string().date(), amountInr: z.coerce.number().min(0.01),
    mode: z.string().trim().max(20).optional().or(z.literal("")), reference: z.string().trim().max(60).optional().or(z.literal("")),
  }).parse(Object.fromEntries(formData));
  const sql = db();
  const [bill] = await sql<{ vendor_id: string }[]>`select vendor_id from vendor_bills where id = ${d.billId}`;
  await sql`insert into vendor_payments (vendor_id, vendor_bill_id, paid_on, amount_paise, mode, reference) values (${bill.vendor_id}, ${d.billId}, ${d.paidOn}, ${paise(d.amountInr)}, ${d.mode || null}, ${d.reference || null})`;
  revalidatePath("/admin/accounts");
}
