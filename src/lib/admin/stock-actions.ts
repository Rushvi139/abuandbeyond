"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

const Id = z.string().uuid();

export async function saveIngredient(formData: FormData) {
  await assertRole(MANAGERS);
  const d = z.object({
    id: z.string().uuid().optional().or(z.literal("")),
    name: z.string().trim().min(2).max(80),
    unit: z.enum(["g", "ml", "pc"]),
    group: z.string().trim().max(60).optional().or(z.literal("")),
    rateInr: z.coerce.number().min(0), // per kg / litre / piece
    reorder: z.coerce.number().min(0),  // in base units
  }).parse(Object.fromEntries(formData));
  const perUnit = d.unit === "pc" ? d.rateInr * 100 : (d.rateInr * 100) / 1000; // paise per g/ml/pc
  if (d.id) {
    await db()`update ingredients set name = ${d.name}, unit = ${d.unit}, procurement_group = ${d.group || null}, rate_paise_per_unit = ${perUnit.toFixed(4)}, reorder_level = ${d.reorder} where id = ${d.id}`;
  } else {
    await db()`insert into ingredients (name, unit, procurement_group, rate_paise_per_unit, reorder_level) values (${d.name}, ${d.unit}, ${d.group || null}, ${perUnit.toFixed(4)}, ${d.reorder})
      on conflict (name) do update set unit = excluded.unit, procurement_group = excluded.procurement_group, rate_paise_per_unit = excluded.rate_paise_per_unit, reorder_level = excluded.reorder_level, active = true`;
  }
  // A rate change re-costs every dish that uses the ingredient, so the pages
  // showing those costs have to be refreshed as well — otherwise the new rate
  // is saved but the margin on /admin/recipes still shows yesterday's number,
  // which reads exactly like the edit not having saved.
  revalidatePath("/admin/stock");
  revalidatePath("/admin/recipes");
  revalidatePath("/admin/menu");
}

export async function deleteIngredient(id: string) {
  await assertRole(["owner"]);
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from recipe_lines where ingredient_id = ${id}`;
  if (n > 0) throw new Error(`Cannot delete — this ingredient is used in ${n} recipe${n === 1 ? "" : "s"}. Remove it from those recipes first.`);
  await sql`update ingredients set active = false where id = ${id}`;
  revalidatePath("/admin/stock");
  revalidatePath("/admin/recipes");
}

/** purchase (+), wastage (−), opening (+) or adjustment (sets the count). Quantities in base units. */
export async function recordMovement(formData: FormData) {
  const staff = await assertRole(["owner", "manager", "kitchen"]);
  const d = z.object({
    ingredientId: Id,
    kind: z.enum(["purchase", "wastage", "adjustment", "opening"]),
    quantity: z.coerce.number().min(0),
    unitCostInr: z.coerce.number().min(0).optional(),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  }).parse(Object.fromEntries(formData));
  const sql = db();
  let qty = d.quantity;
  if (d.kind === "wastage") qty = -qty;
  if (d.kind === "adjustment") {
    const [{ on_hand }] = await sql<{ on_hand: number }[]>`select coalesce(sum(quantity), 0)::numeric as on_hand from stock_movements where ingredient_id = ${d.ingredientId}`;
    qty = d.quantity - Number(on_hand);
  }
  const [ing] = await sql<{ unit: string; rate: number }[]>`select unit, rate_paise_per_unit as rate from ingredients where id = ${d.ingredientId}`;
  // unit cost entered per kg / litre / piece
  const unitCost = d.unitCostInr != null && d.unitCostInr > 0 ? (ing.unit === "pc" ? d.unitCostInr * 100 : (d.unitCostInr * 100) / 1000) : null;
  await sql`insert into stock_movements (ingredient_id, kind, quantity, unit_cost_paise, note, actor_id)
    values (${d.ingredientId}, ${d.kind}, ${qty.toFixed(3)}, ${unitCost?.toFixed(4) ?? null}, ${d.note || null}, ${staff.id})`;
  if (d.kind === "purchase" && unitCost) await sql`update ingredients set rate_paise_per_unit = ${unitCost.toFixed(4)} where id = ${d.ingredientId}`;
  revalidatePath("/admin/stock");
}
