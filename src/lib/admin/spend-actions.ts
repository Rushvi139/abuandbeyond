"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOKKEEPERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { UploadError, saveUpload } from "@/lib/files";

/**
 * The one form for money going out.
 *
 * Two questions decide everything, and the form asks them in this order:
 *   1. What was it for? — a category (Kitchen, Staff, Marketing, …).
 *   2. Was it paid now, or is it owed? — cash/UPI now, or on credit.
 *
 * Paid now is stored as an expense; on credit as a vendor bill that stays
 * "owed" until paid. The team never has to choose between "expense" and
 * "vendor bill" — the answer to question 2 does it.
 *
 * Item lines (Kitchen, Disposables) raise stock through `stock_movements`, as
 * the architecture requires, and update each ingredient's rate to what was
 * just paid, so recipe costing follows the market.
 */

const paise = (inr: number) => Math.round(inr * 100);

const Line = z.object({
  ingredientId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(80),
  /** In the unit the person typed: kg, L or pc. Converted to g/ml/pc below. */
  qty: z.number().positive().max(100_000),
  amountInr: z.number().min(0).max(10_000_000),
});

const Spend = z
  .object({
    spentOn: z.string().date(),
    category: z.string().min(1).max(40),
    staffName: z.string().trim().max(80).optional().default(""),
    paidTo: z.string().trim().max(80).optional().default(""),
    description: z.string().trim().max(200).optional().default(""),
    amountInr: z.number().min(0).max(10_000_000).optional(),
    lines: z.array(Line).max(60).default([]),
    pay: z.enum(["cash", "upi", "credit"]),
    billNumber: z.string().trim().max(60).optional().default(""),
    dueOn: z.string().date().optional().or(z.literal("")),
    reference: z.string().trim().max(60).optional().default(""),
    note: z.string().trim().max(300).optional().default(""),
  })
  .superRefine((d, ctx) => {
    const total = d.lines.length ? d.lines.reduce((n, l) => n + l.amountInr, 0) : (d.amountInr ?? 0);
    if (total <= 0) ctx.addIssue({ code: "custom", path: ["amountInr"], message: "Enter the amount paid." });
    if (d.pay === "credit" && !d.paidTo) ctx.addIssue({ code: "custom", path: ["paidTo"], message: "On credit needs the vendor's name — that's who we owe." });
    if (!d.lines.length && !d.description && !d.staffName) ctx.addIssue({ code: "custom", path: ["description"], message: "Say what it was for." });
  });

export type SpendInput = z.input<typeof Spend>;

type Q = { <T extends readonly object[]>(s: TemplateStringsArray, ...v: unknown[]): Promise<T> };

async function vendorId(tx: Q, name: string) {
  const [v] = await tx<{ id: string }[]>`insert into vendors (name) values (${name}) on conflict do nothing returning id`;
  if (v) return v.id;
  const [e] = await tx<{ id: string }[]>`select id from vendors where lower(name) = ${name.toLowerCase()} limit 1`;
  return e.id;
}

const UNIT_FACTOR: Record<string, number> = { g: 1000, ml: 1000, pc: 1 }; // typed kg / L / pc → base

/** Returns its complaint as data: production Next hides thrown messages. */
export async function addSpend(formData: FormData): Promise<{ error?: string; saved?: "expense" | "bill" }> {
  const staff = await assertRole(BOOKKEEPERS);
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "The form didn't send properly. Try again." };
  }
  const parsed = Spend.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  const file = formData.get("attachment");
  let filePath: string | null = null;
  try {
    if (file instanceof File && file.size > 0) filePath = await saveUpload(file, d.pay === "credit" ? "bills" : "expenses", { maxBytes: 15 * 1024 * 1024 });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }

  const sql = db();
  const [cat] = await sql<{ id: string; name: string }[]>`select id, name from expense_categories where id = ${d.category}`;
  if (!cat) return { error: "Pick a category." };

  const ids = [...new Set(d.lines.map((l) => l.ingredientId).filter(Boolean))] as string[];
  const ings = ids.length ? await sql<{ id: string; unit: string }[]>`select id, unit::text from ingredients where id in ${sql(ids)}` : [];
  const unitOf = new Map(ings.map((i) => [i.id, i.unit]));

  const lines = d.lines.map((l) => {
    const unit = l.ingredientId ? unitOf.get(l.ingredientId) : undefined;
    const base = unit ? l.qty * (UNIT_FACTOR[unit] ?? 1) : l.qty;
    return { ...l, ingredientId: unit ? l.ingredientId! : null, baseQty: Math.round(base * 1000) / 1000, amountPaise: paise(l.amountInr) };
  });
  const totalPaise = lines.length ? lines.reduce((n, l) => n + l.amountPaise, 0) : paise(d.amountInr ?? 0);
  const summary =
    d.description ||
    (lines.length ? lines.map((l) => l.name).slice(0, 4).join(", ") + (lines.length > 4 ? ` +${lines.length - 4} more` : "") : "") ||
    `${cat.name}${d.staffName ? ` — ${d.staffName}` : ""}`;

  await sql.begin(async (tx0) => {
    const tx = tx0 as unknown as Q;
    const vid = d.paidTo ? await vendorId(tx, d.paidTo) : null;
    let expenseId: string | null = null;
    let billId: string | null = null;

    if (d.pay === "credit") {
      const [b] = await tx<{ id: string }[]>`
        insert into vendor_bills (vendor_id, bill_number, bill_date, amount_paise, gst_paise, due_on, file_path, created_by, category_id, description, note)
        values (${vid}, ${d.billNumber || null}, ${d.spentOn}, ${totalPaise}, 0, ${d.dueOn || null}, ${filePath}, ${staff.id}, ${cat.id}, ${summary}, ${d.note || null})
        returning id`;
      billId = b.id;
    } else {
      const [e] = await tx<{ id: string }[]>`
        insert into expenses (category_id, spent_on, description, amount_paise, vendor_id, mode, reference, file_path, created_by, staff_name, note)
        values (${cat.id}, ${d.spentOn}, ${summary}, ${totalPaise}, ${vid}, ${d.pay === "upi" ? "UPI" : "Cash"}, ${d.reference || null}, ${filePath}, ${staff.id}, ${d.staffName || null}, ${d.note || null})
        returning id`;
      expenseId = e.id;
    }

    for (const l of lines) {
      await tx`insert into spend_lines (expense_id, vendor_bill_id, ingredient_id, item_name, quantity, amount_paise)
        values (${expenseId}, ${billId}, ${l.ingredientId}, ${l.name}, ${l.baseQty}, ${l.amountPaise})`;
      if (l.ingredientId && l.baseQty > 0) {
        const perUnit = (l.amountPaise / l.baseQty).toFixed(4);
        // The only way stock changes: a movement row.
        await tx`insert into stock_movements (ingredient_id, kind, quantity, unit_cost_paise, note, actor_id)
          values (${l.ingredientId}, 'purchase', ${l.baseQty}, ${perUnit}, ${`${cat.name}: ${d.paidTo || "purchase"}`.slice(0, 120)}, ${staff.id})`;
        if (l.amountPaise > 0) await tx`update ingredients set rate_paise_per_unit = ${perUnit} where id = ${l.ingredientId}`;
      }
    }
  });

  for (const p of ["/admin", "/admin/accounts", "/admin/accounts/expenses", "/admin/accounts/vendors", "/admin/accounts/vendor-list", "/admin/stock", "/rider/bills"]) revalidatePath(p);
  return { saved: d.pay === "credit" ? "bill" : "expense" };
}
