"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAID_FROM, PAID_FROM_MODE } from "@/lib/admin/paid-from";

/**
 * Says which account an old entry was paid from. Only the books are touched:
 * the amount, date and stock stay as they were.
 */
export async function tagPaidFrom(input: { kind: "expense" | "payment"; id: string; from: string }): Promise<{ error?: string }> {
  await assertRole(["owner", "manager"]);
  const p = z.object({ kind: z.enum(["expense", "payment"]), id: z.string().uuid(), from: z.enum(PAID_FROM) }).safeParse(input);
  if (!p.success) return { error: "Pick HDFC, Saraspur or Cash." };
  const { kind, id, from } = p.data;
  const sql = db();
  const rows =
    kind === "expense"
      ? await sql`update expenses set paid_from = ${from}, mode = ${PAID_FROM_MODE[from]} where id = ${id} returning id`
      : await sql`update vendor_payments set paid_from = ${from}, mode = ${PAID_FROM_MODE[from]} where id = ${id} returning id`;
  if (!rows.length) return { error: "That entry is gone." };
  revalidatePath("/admin/accounts/money");
  revalidatePath("/admin/accounts/expenses");
  return {};
}
