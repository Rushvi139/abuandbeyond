"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/files";

// Recording a bill or an expense is data entry, not reading the books: riders who
// also do the market run can file them, but only the owner sees the ledger.
const BOOKKEEPERS = ["owner", "manager", "rider"] as const;
const paise = (inr: number) => Math.round(inr * 100);

type Q = { <T extends readonly object[]>(s: TemplateStringsArray, ...v: unknown[]): Promise<T> };
async function vendorId(tx: Q, name: string) {
  const [v] = await tx<{ id: string }[]>`insert into vendors (name) values (${name}) on conflict do nothing returning id`;
  if (v) return v.id;
  const [e] = await tx<{ id: string }[]>`select id from vendors where lower(name) = ${name.toLowerCase()} limit 1`;
  return e.id;
}

export async function addExpense(formData: FormData) {
  const staff = await assertRole([...BOOKKEEPERS]);
  const d = z.object({
    category: z.string().min(1), spentOn: z.string().date(), description: z.string().trim().min(2).max(200),
    amountInr: z.coerce.number().min(0.01), mode: z.string().trim().max(20).optional().or(z.literal("")),
    reference: z.string().trim().max(60).optional().or(z.literal("")), vendor: z.string().trim().max(80).optional().or(z.literal("")),
  }).parse(Object.fromEntries(formData));
  const file = formData.get("attachment");
  const filePath = file instanceof File && file.size > 0 ? await saveUpload(file, "expenses", { maxBytes: 15 * 1024 * 1024 }) : null;
  const sql = db();
  const vid = d.vendor ? await vendorId(sql as unknown as Q, d.vendor) : null;
  await sql`insert into expenses (category_id, spent_on, description, amount_paise, vendor_id, mode, reference, file_path, created_by)
    values (${d.category}, ${d.spentOn}, ${d.description}, ${paise(d.amountInr)}, ${vid}, ${d.mode || null}, ${d.reference || null}, ${filePath}, ${staff.id})`;
  revalidatePath("/admin/accounts");
  if (vid) revalidatePath(`/admin/accounts/vendors/${vid}`);
}

export async function addVendorBill(formData: FormData) {
  const staff = await assertRole([...BOOKKEEPERS]);
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
    const [bill] = await tx<{ id: string }[]>`insert into vendor_bills (vendor_id, bill_number, bill_date, amount_paise, gst_paise, due_on, file_path, created_by)
      values (${vid}, ${d.billNumber || null}, ${d.billDate}, ${paise(d.amountInr)}, ${paise(d.gstInr)}, ${d.dueOn || null}, ${filePath}, ${staff.id}) returning id`;
    if (d.paidNow) {
      await tx`insert into vendor_payments (vendor_id, vendor_bill_id, paid_on, amount_paise, mode, reference) values (${vid}, ${bill.id}, ${d.billDate}, ${paise(d.amountInr)}, ${d.mode || null}, ${d.reference || null})`;
    }
  });
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/accounts/vendors");
  revalidatePath("/rider/bills");
}

/**
 * Returns its complaint rather than throwing it: Next replaces a thrown
 * server-action message with a generic one in production, and "that's ₹2,000
 * more than is due" is exactly what the person needs to read.
 */
export async function addVendorPayment(formData: FormData): Promise<{ error?: string }> {
  await assertRole([...BOOKKEEPERS]);
  const parsed = z.object({
    billId: z.string().uuid(), paidOn: z.string().date(), amountInr: z.coerce.number().min(0.01),
    mode: z.string().trim().max(20).optional().or(z.literal("")), reference: z.string().trim().max(60).optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the date and the amount." };
  const d = parsed.data;

  // Locking the bill row keeps two people paying the same bill at once from
  // both passing the overpay check and booking it twice.
  const result = await db().begin(async (tx) => {
    const [bill] = await tx<{ vendorId: string; amount: number; paid: number }[]>`
      select b.vendor_id as "vendorId", b.amount_paise::bigint as amount,
        coalesce((select sum(p.amount_paise) from vendor_payments p where p.vendor_bill_id = b.id), 0)::bigint as paid
      from vendor_bills b where b.id = ${d.billId} for update`;
    if (!bill) return { error: "That bill is gone." };
    const due = Number(bill.amount) - Number(bill.paid);
    if (due <= 0) return { error: "This bill is already settled." };
    if (paise(d.amountInr) > due) return { error: `That's more than the ₹${(due / 100).toLocaleString("en-IN")} still due on this bill.` };
    await tx`insert into vendor_payments (vendor_id, vendor_bill_id, paid_on, amount_paise, mode, reference)
      values (${bill.vendorId}, ${d.billId}, ${d.paidOn}, ${paise(d.amountInr)}, ${d.mode || null}, ${d.reference || null})`;
    return { vendorId: bill.vendorId };
  });

  if ("error" in result) return result;
  revalidatePath("/admin/accounts");
  revalidatePath(`/admin/accounts/vendors/${result.vendorId}`);
  return {};
}
