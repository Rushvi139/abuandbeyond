"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

const paise = (inr: number) => Math.round(inr * 100);

const Form = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "A code needs at least 3 characters.")
      .max(24)
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes — nothing a phone keyboard hides."),
    description: z.string().trim().max(120).optional().or(z.literal("")),
    kind: z.enum(["percent", "flat"]),
    percent: z.coerce.number().int().min(1).max(100).optional(),
    valueInr: z.coerce.number().min(1).optional(),
    maxDiscountInr: z.coerce.number().min(0).optional(),
    minOrderInr: z.coerce.number().min(0).default(0),
    startsOn: z.string().optional().or(z.literal("")),
    endsOn: z.string().optional().or(z.literal("")),
    maxRedemptions: z.coerce.number().int().min(1).optional(),
    perCustomerLimit: z.coerce.number().int().min(1).max(50).default(1),
    firstOrderOnly: z.coerce.boolean().default(false),
  })
  .refine((d) => d.kind !== "percent" || d.percent != null, { message: "Set the percentage.", path: ["percent"] })
  .refine((d) => d.kind !== "flat" || d.valueInr != null, { message: "Set the amount off.", path: ["valueInr"] })
  .refine((d) => !d.startsOn || !d.endsOn || d.endsOn >= d.startsOn, { message: "The end date is before the start.", path: ["endsOn"] });

export async function saveCoupon(formData: FormData): Promise<{ error?: string }> {
  const staff = await assertRole(MANAGERS);
  const raw = Object.fromEntries(formData);
  const parsed = Form.safeParse({ ...raw, firstOrderOnly: raw.firstOrderOnly === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  // A percentage with no ceiling is the one that can cost more than the order
  // earns, so it is refused rather than warned about.
  if (d.kind === "percent" && !d.maxDiscountInr) {
    return { error: "A percentage coupon needs a maximum discount, or one large order gives away the kitchen." };
  }

  const id = typeof raw.id === "string" && z.string().uuid().safeParse(raw.id).success ? raw.id : null;
  const sql = db();
  const [clash] = await sql<{ id: string }[]>`
    select id from coupons where upper(code) = upper(${d.code}) and (${id}::uuid is null or id <> ${id}::uuid)`;
  if (clash) return { error: "That code already exists." };

  const fields = {
    code: d.code.toUpperCase(),
    description: d.description || null,
    kind: d.kind,
    percent: d.kind === "percent" ? d.percent! : null,
    value_paise: d.kind === "flat" ? paise(d.valueInr!) : null,
    max_discount_paise: d.maxDiscountInr ? paise(d.maxDiscountInr) : null,
    min_order_paise: paise(d.minOrderInr),
    starts_on: d.startsOn || null,
    ends_on: d.endsOn || null,
    max_redemptions: d.maxRedemptions ?? null,
    per_customer_limit: d.perCustomerLimit,
    first_order_only: d.firstOrderOnly,
  };

  if (id) {
    await sql`update coupons set ${sql(fields)}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  } else {
    await sql`insert into coupons ${sql({ ...fields, created_by: staff.id })}`;
  }
  revalidatePath("/admin/coupons");
  return {};
}

export async function setCouponActive(id: string, active: boolean): Promise<{ error?: string }> {
  const staff = await assertRole(MANAGERS);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown coupon." };
  await db()`update coupons set active = ${active}, updated_at = now(), updated_by = ${staff.id} where id = ${id}`;
  revalidatePath("/admin/coupons");
  return {};
}

/**
 * Only ever deletes a coupon nobody has used. One that has been redeemed is
 * part of the books — switch it off instead.
 */
export async function deleteCoupon(id: string): Promise<{ error?: string }> {
  await assertRole(["owner"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown coupon." };
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from coupon_redemptions where coupon_id = ${id}`;
  if (n > 0) return { error: "This code has been used on real orders. Switch it off instead." };
  await sql`delete from coupons where id = ${id}`;
  revalidatePath("/admin/coupons");
  return {};
}
