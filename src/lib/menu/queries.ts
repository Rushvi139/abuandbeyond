import { db } from "@/lib/db";
import type { Category, MenuItem } from "./types";

type Row = {
  id: string;
  name: string;
  slug: string;
  items: MenuItem[] | null;
};

/** The live menu: active categories with their active items, options and add-ons. */
export async function getMenu(): Promise<Category[]> {
  const rows = await db()<Row[]>`
    select c.id, c.name, c.slug,
      (
        select json_agg(json_build_object(
          'id', m.id, 'sku', m.sku, 'slug', m.slug, 'name', m.name, 'description', m.description,
          'isVeg', m.is_veg, 'pricePaise', m.price_paise, 'cuisine', m.cuisine, 'available', m.available,
          'imagePath', m.image_path,
          'optionGroups', coalesce((
            select json_agg(json_build_object(
              'id', g.id, 'name', g.name, 'required', g.required,
              'choices', coalesce((
                select json_agg(json_build_object('id', o.id, 'name', o.name, 'priceDeltaPaise', o.price_delta_paise) order by o.sort_order)
                from options o where o.option_group_id = g.id and o.active
              ), '[]'::json)
            ) order by g.sort_order)
            from option_groups g where g.menu_item_id = m.id
          ), '[]'::json),
          'addons', coalesce((
            select json_agg(json_build_object('id', a.id, 'name', a.name, 'pricePaise', a.price_paise, 'isVeg', a.is_veg) order by a.name)
            from menu_item_addons ma join addons a on a.id = ma.addon_id
            where ma.menu_item_id = m.id and a.active
          ), '[]'::json)
        ) order by m.sort_order)
        from menu_items m where m.category_id = c.id and m.active
      ) as items
    from categories c
    where c.active
    order by c.sort_order`;

  return rows
    .map((r) => ({ id: r.id, name: r.name, slug: r.slug, items: r.items ?? [] }))
    .filter((c) => c.items.length > 0);
}

export type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  linkUrl: string | null;
  imagePath: string | null;
  tone: "clay" | "acid" | "hill" | "ink" | "kraft";
  placement: "card" | "ribbon";
  motif: "none" | "lights" | "paws";
  ctaLabel: string | null;
};

/** Live banners for the top of the menu: active, and inside their date window if they have one. */
export async function getBanners(): Promise<BannerRow[]> {
  return db()<BannerRow[]>`
    select id, title, subtitle, link_url as "linkUrl", image_path as "imagePath", tone,
      placement, motif, cta_label as "ctaLabel"
    from banners
    where active
      and (starts_on is null or starts_on <= (now() at time zone 'Asia/Kolkata')::date)
      and (ends_on is null or ends_on >= (now() at time zone 'Asia/Kolkata')::date)
    order by sort_order, created_at desc
    limit 8`;
}

/** Splits what is live into the top ribbon and the cards under the header. */
export const splitBanners = (rows: BannerRow[]) => ({
  ribbons: rows.filter((b) => b.placement === "ribbon"),
  cards: rows.filter((b) => b.placement !== "ribbon"),
});
