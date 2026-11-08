"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/files";

const Id = z.string().uuid();

function refresh(menuItemId: string) {
  revalidatePath("/admin/recipes");
  revalidatePath(`/admin/recipes/${menuItemId}`);
  revalidatePath("/admin/menu");
}

/** The written half of a recipe: method, notes, timing, yield. */
export async function saveRecipe(formData: FormData) {
  const staff = await assertRole(MANAGERS);
  const d = z
    .object({
      menuItemId: Id,
      method: z.string().trim().max(6000).optional().or(z.literal("")),
      chefNotes: z.string().trim().max(2000).optional().or(z.literal("")),
      prepMinutes: z.coerce.number().int().min(0).max(600).optional().or(z.literal("")),
      yieldNote: z.string().trim().max(120).optional().or(z.literal("")),
    })
    .parse(Object.fromEntries(formData));

  const prep = typeof d.prepMinutes === "number" ? d.prepMinutes : null;
  await db()`
    insert into recipes (menu_item_id, method, chef_notes, prep_minutes, yield_note, updated_by, updated_at)
    values (${d.menuItemId}, ${d.method || null}, ${d.chefNotes || null}, ${prep}, ${d.yieldNote || null}, ${staff.id}, now())
    on conflict (menu_item_id) do update set
      method = excluded.method, chef_notes = excluded.chef_notes, prep_minutes = excluded.prep_minutes,
      yield_note = excluded.yield_note, updated_by = excluded.updated_by, updated_at = now()`;
  refresh(d.menuItemId);
}

/** Adds or updates one ingredient line. A quantity of zero takes it off the recipe. */
export async function setRecipeLine(formData: FormData) {
  await assertRole(MANAGERS);
  const d = z
    .object({
      menuItemId: Id,
      ingredientId: Id,
      quantity: z.coerce.number().min(0).max(100000),
    })
    .parse(Object.fromEntries(formData));

  const sql = db();
  if (d.quantity === 0) {
    await sql`delete from recipe_lines where menu_item_id = ${d.menuItemId} and ingredient_id = ${d.ingredientId}`;
  } else {
    await sql`insert into recipe_lines (menu_item_id, ingredient_id, quantity)
      values (${d.menuItemId}, ${d.ingredientId}, ${d.quantity})
      on conflict (menu_item_id, ingredient_id) do update set quantity = excluded.quantity`;
  }
  refresh(d.menuItemId);
}

export async function removeRecipeLine(menuItemId: string, ingredientId: string) {
  await assertRole(MANAGERS);
  await db()`delete from recipe_lines where menu_item_id = ${Id.parse(menuItemId)} and ingredient_id = ${Id.parse(ingredientId)}`;
  refresh(menuItemId);
}

export async function addRecipePhoto(formData: FormData) {
  await assertRole(MANAGERS);
  const menuItemId = Id.parse(formData.get("menuItemId"));
  const caption = z.string().trim().max(120).optional().parse(formData.get("caption") || undefined);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;
  const path = "/files/" + (await saveUpload(file, "menu"));
  await db()`insert into recipe_photos (menu_item_id, file_path, caption) values (${menuItemId}, ${path}, ${caption ?? null})`;
  refresh(menuItemId);
}

export async function removeRecipePhoto(id: string, menuItemId: string) {
  await assertRole(MANAGERS);
  await db()`delete from recipe_photos where id = ${Id.parse(id)}`;
  refresh(menuItemId);
}
