"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/files";
import { titleCase } from "@/lib/text";

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const ItemSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  category: z.string().trim().min(2).max(60),
  station: z.enum(["pizza_oven", "wok_momos", "grill_rolls", "fryer", "cold_drinks"]),
  cuisine: z.enum(["abu", "italy", "mexico", "china", "lebanon"]),
  isVeg: z.enum(["veg", "nonveg"]),
  priceInr: z.coerce.number().min(1).max(5000),
  packagingInr: z.coerce.number().min(0).max(500).default(0),
  options: z.string().trim().max(200).optional().or(z.literal("")), // "Base: Fried rice | Noodles"
  addonNames: z.string().trim().max(200).optional().or(z.literal("")), // "Extra cheese, Add egg"
});

export async function saveMenuItem(formData: FormData) {
  await assertRole(MANAGERS);
  const d = ItemSchema.parse(Object.fromEntries(formData));
  d.category = titleCase(d.category);
  const photo = formData.get("photo");
  const sql = db();
  const imagePath = photo instanceof File && photo.size > 0 ? "/files/" + (await saveUpload(photo, "menu")) : null;

  await sql.begin(async (tx) => {
    // Look up by name first (case-insensitive), then by slug, then insert.
    // The double-lookup avoids a unique-constraint crash when the same category
    // was created with slightly different casing or the slug already exists.
    let [cat] = await tx<{ id: string }[]>`
      select id from categories where lower(name) = lower(${d.category}) limit 1`;
    if (!cat) [cat] = await tx<{ id: string }[]>`
      select id from categories where slug = ${slugify(d.category)} limit 1`;
    if (!cat) {
      [cat] = await tx<{ id: string }[]>`
        insert into categories (name, slug, sort_order)
        values (${d.category}, ${slugify(d.category)},
          (select coalesce(max(sort_order), 0) + 1 from categories))
        on conflict (slug) do update set active = true returning id`;
    } else {
      await tx`update categories set active = true where id = ${cat.id}`;
    }
    let id = d.id || null;
    if (id) {
      await tx`update menu_items set name = ${d.name}, description = ${d.description || null}, category_id = ${cat.id}, station_id = ${d.station},
        cuisine = ${d.cuisine}, is_veg = ${d.isVeg === "veg"}, price_paise = ${Math.round(d.priceInr * 100)}, packaging_cost_paise = ${Math.round(d.packagingInr * 100)},
        image_path = coalesce(${imagePath}, image_path) where id = ${id}`;
    } else {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from menu_items`;
      const sku = `AB${String(n + 1).padStart(3, "0")}-${Date.now().toString(36).slice(-3)}`;
      let slug = slugify(d.name);
      const [clash] = await tx<{ n: number }[]>`select count(*)::int as n from menu_items where slug = ${slug}`;
      if (clash.n) slug += "-" + Math.random().toString(36).slice(2, 5);
      const [row] = await tx<{ id: string }[]>`insert into menu_items
        (sku, slug, name, description, category_id, station_id, cuisine, is_veg, price_paise, packaging_cost_paise, price_status, image_path, sort_order)
        values (${sku}, ${slug}, ${d.name}, ${d.description || null}, ${cat.id}, ${d.station}, ${d.cuisine}, ${d.isVeg === "veg"},
          ${Math.round(d.priceInr * 100)}, ${Math.round(d.packagingInr * 100)}, 'new', ${imagePath},
          (select coalesce(max(sort_order), 0) + 1 from menu_items where category_id = ${cat.id}))
        returning id`;
      id = row.id;
    }
    // options "Group: a | b"
    if (d.options !== undefined) {
      await tx`delete from option_groups where menu_item_id = ${id}`;
      if (d.options) {
        const [g, rest] = d.options.split(":");
        if (rest) {
          const [grp] = await tx<{ id: string }[]>`insert into option_groups (menu_item_id, name) values (${id}, ${g.trim()}) returning id`;
          for (const [i, c] of rest.split("|").map((s) => s.trim()).filter(Boolean).entries())
            await tx`insert into options (option_group_id, name, sort_order) values (${grp.id}, ${c}, ${i + 1})`;
        }
      }
    }
    // Only rewrite the add-on links when the form actually carried the field.
    // A partial save that omitted it was silently unlinking every add-on.
    if (d.addonNames !== undefined) {
      await tx`delete from menu_item_addons where menu_item_id = ${id}`;
      for (const n of (d.addonNames ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
        const [a] = await tx<{ id: string }[]>`select id from addons where lower(name) = ${n.toLowerCase()}`;
        if (a) await tx`insert into menu_item_addons (menu_item_id, addon_id) values (${id}, ${a.id}) on conflict do nothing`;
      }
    }
  });
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

/**
 * Takes a dish off the live menu without losing it. The row stays — with its
 * recipe, its costing and every past order line pointing at it — so the dish
 * can come back in a season, and last winter's numbers still add up.
 *
 * Deleting the row is deliberately not offered: order_items reference it.
 */
export async function retireMenuItem(id: string) {
  await assertRole(MANAGERS);
  await db()`update menu_items set active = false, available = false where id = ${z.string().uuid().parse(id)}`;
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

/** Puts a retired dish back on the live menu, in stock. */
export async function restoreMenuItem(id: string) {
  await assertRole(MANAGERS);
  await db()`update menu_items set active = true, available = true where id = ${z.string().uuid().parse(id)}`;
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

const AddonSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(60),
  priceInr: z.coerce.number().min(0).max(1000),
  isVeg: z.enum(["veg", "nonveg"]).default("veg"),
});

/** Add-ons are shared across dishes; a dish picks them up by name on its own form. */
export async function saveAddon(formData: FormData) {
  await assertRole(MANAGERS);
  const d = AddonSchema.parse(Object.fromEntries(formData));
  const paise = Math.round(d.priceInr * 100);
  const sql = db();
  if (d.id) {
    await sql`update addons set name = ${d.name}, price_paise = ${paise}, is_veg = ${d.isVeg === "veg"} where id = ${d.id}`;
  } else {
    await sql`insert into addons (name, price_paise, is_veg) values (${d.name}, ${paise}, ${d.isVeg === "veg"})
      on conflict (name) do update set price_paise = excluded.price_paise, is_veg = excluded.is_veg, active = true`;
  }
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

export async function retireAddon(id: string) {
  await assertRole(MANAGERS);
  await db()`update addons set active = false where id = ${id}`;
  revalidatePath("/admin/menu");
  revalidatePath("/");
}


/**
 * Moves a category one place up or down the guest menu.
 *
 * Positions are renumbered 1..n first, so a gap or a tie left by older data
 * can never make a move do nothing, then the two neighbours swap.
 */
export async function moveCategory(id: string, direction: "up" | "down") {
  await assertRole(MANAGERS);
  const sql = db();
  await sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`select id from categories where active order by sort_order, name for update`;
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (const [n, cid] of ids.entries()) await tx`update categories set sort_order = ${n + 1} where id = ${cid}`;
  });
  revalidatePath("/admin/menu");
  revalidatePath("/");
}
