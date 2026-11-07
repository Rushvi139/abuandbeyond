"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/files";

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
  const photo = formData.get("photo");
  const sql = db();
  const imagePath = photo instanceof File && photo.size > 0 ? "/files/" + (await saveUpload(photo, "menu")) : null;

  await sql.begin(async (tx) => {
    const [cat] = await tx<{ id: string }[]>`insert into categories (name, slug, sort_order)
      values (${d.category}, ${slugify(d.category)}, (select coalesce(max(sort_order), 0) + 1 from categories))
      on conflict (name) do update set active = true returning id`;
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
    await tx`delete from menu_item_addons where menu_item_id = ${id}`;
    for (const n of (d.addonNames ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const [a] = await tx<{ id: string }[]>`select id from addons where lower(name) = ${n.toLowerCase()}`;
      if (a) await tx`insert into menu_item_addons (menu_item_id, addon_id) values (${id}, ${a.id}) on conflict do nothing`;
    }
  });
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

export async function retireMenuItem(id: string) {
  await assertRole(MANAGERS);
  await db()`update menu_items set active = false, available = false where id = ${z.string().uuid().parse(id)}`;
  revalidatePath("/admin/menu");
  revalidatePath("/");
}
