// Loads the live menu and costing data from db/seed/*.csv. Safe to re-run: upserts by natural key.
// Usage: npm run db:seed   (needs DATABASE_URL; run db:migrate first)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { max: 1, onnotice: () => {} });

type Row = Record<string, string>;
const read = (f: string): Row[] =>
  parse(readFileSync(join(process.cwd(), "db", "seed", f)), { columns: true, skip_empty_lines: true, trim: true });
const paise = (inr: string) => Math.round(Number(inr) * 100);
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const menu = read("menu_items.csv");
  const kits = read("pack_kits.csv");
  const addons = read("addons.csv");
  const rates = read("ingredient_rates.csv");
  const groups = read("ingredient_groups.csv");
  const recipes = read("recipe_lines.csv");

  await sql.begin(async (tx) => {
    for (const k of kits) {
      await tx`insert into pack_kits (id, name, cost_paise, components)
        values (${k.id}, ${k.name}, ${paise(k.cost_inr)}, ${k.components})
        on conflict (id) do update set name = excluded.name, cost_paise = excluded.cost_paise, components = excluded.components`;
    }

    const categoryOrder = [...new Set(menu.map((m) => m.category))];
    const categoryId = new Map<string, string>();
    for (const [i, name] of categoryOrder.entries()) {
      const [row] = await tx<{ id: string }[]>`insert into categories (name, slug, sort_order)
        values (${name}, ${slugify(name)}, ${i + 1})
        on conflict (name) do update set slug = excluded.slug, sort_order = excluded.sort_order
        returning id`;
      categoryId.set(name, row.id);
    }

    const itemId = new Map<string, string>();
    for (const [i, m] of menu.entries()) {
      const [row] = await tx<{ id: string }[]>`insert into menu_items
        (sku, slug, name, category_id, station_id, cuisine, is_veg, price_paise, packaging_cost_paise,
         pack_kit_id, price_status, costing_ref, sort_order)
        values (${m.sku}, ${m.slug}, ${m.name}, ${categoryId.get(m.category)!}, ${m.station}, ${m.cuisine_sticker},
          ${m.is_veg === "True"}, ${paise(m.price_inr)}, ${paise(m.packaging_cost_inr)},
          ${m.pack_kit || null}, ${m.price_status}, ${m.costing_ref || null}, ${i + 1})
        on conflict (sku) do update set slug = excluded.slug, name = excluded.name, category_id = excluded.category_id,
          station_id = excluded.station_id, cuisine = excluded.cuisine, is_veg = excluded.is_veg,
          price_paise = excluded.price_paise, packaging_cost_paise = excluded.packaging_cost_paise,
          pack_kit_id = excluded.pack_kit_id, price_status = excluded.price_status,
          costing_ref = excluded.costing_ref, sort_order = excluded.sort_order
        returning id`;
      itemId.set(m.sku, row.id);

      // options column: "Group:choice a|choice b"
      //
      // Matched by name and updated in place rather than deleted and rebuilt.
      // Past order lines point at option ids, so wiping them makes the seed
      // un-runnable the moment the kitchen has taken an order — which is
      // exactly when someone reaches for it to change a price.
      const groupNames = m.options ? [m.options.split(":")[0]] : [];
      if (m.options) {
        const [groupName, choices] = m.options.split(":");
        const [found] = await tx<{ id: string }[]>`
          select id from option_groups where menu_item_id = ${row.id} and name = ${groupName}`;
        const g = found ?? (await tx<{ id: string }[]>`
          insert into option_groups (menu_item_id, name, required, max_choices)
          values (${row.id}, ${groupName}, true, 1) returning id`)[0];

        const wanted = choices.split("|");
        for (const [j, choice] of wanted.entries()) {
          const [opt] = await tx<{ id: string }[]>`
            select id from options where option_group_id = ${g.id} and name = ${choice}`;
          if (opt) await tx`update options set sort_order = ${j + 1} where id = ${opt.id}`;
          else await tx`insert into options (option_group_id, name, sort_order) values (${g.id}, ${choice}, ${j + 1})`;
        }
        // Choices dropped from the CSV go, unless an order already used one.
        await tx`delete from options o
          where o.option_group_id = ${g.id} and o.name <> all(${wanted})
            and not exists (select 1 from order_item_options x where x.option_id = o.id)`;
      }
      // Likewise for whole groups this dish no longer has.
      await tx`delete from option_groups og
        where og.menu_item_id = ${row.id} and og.name <> all(${groupNames})
          and not exists (
            select 1 from options o join order_item_options x on x.option_id = o.id
            where o.option_group_id = og.id)`;
    }

    for (const a of addons) {
      const [row] = await tx<{ id: string }[]>`insert into addons (name, price_paise, is_veg)
        values (${a.name}, ${paise(a.price_inr)}, ${a.is_veg === "true"})
        on conflict (name) do update set price_paise = excluded.price_paise, is_veg = excluded.is_veg
        returning id`;
      const cats = new Set(a.applies_to.split(";"));
      for (const m of menu.filter((x) => cats.has(x.category))) {
        await tx`insert into menu_item_addons (menu_item_id, addon_id) values (${itemId.get(m.sku)!}, ${row.id})
          on conflict do nothing`;
      }
    }

    // ingredients: rate per base unit (per g / ml / pc)
    const group = new Map(groups.map((g) => [g.ingredient, g.procurement_group]));
    const ingredient = new Map<string, { id: string; rate: number }>();
    for (const r of rates) {
      if (!r.ingredient || !["g", "ml", "pc"].includes(r.unit)) continue;
      const perUnitInr = r.rate_basis.includes("PIECE") ? Number(r.market_rate_inr) : Number(r.market_rate_inr) / 1000;
      const ratePaise = perUnitInr * 100;
      const [row] = await tx<{ id: string }[]>`insert into ingredients (name, procurement_group, unit, rate_paise_per_unit)
        values (${r.ingredient}, ${group.get(r.ingredient) ?? null}, ${r.unit}, ${ratePaise.toFixed(4)})
        on conflict (name) do update set procurement_group = excluded.procurement_group, unit = excluded.unit,
          rate_paise_per_unit = excluded.rate_paise_per_unit
        returning id`;
      ingredient.set(r.ingredient, { id: row.id, rate: ratePaise });
    }

    // recipe lines for each live item, from its costing_ref dish; quantity = line cost / rate
    let lines = 0;
    for (const m of menu) {
      if (!m.costing_ref) continue;
      const id = itemId.get(m.sku)!;
      await tx`delete from recipe_lines where menu_item_id = ${id}`;
      for (const r of recipes.filter((x) => x.menu_item === m.costing_ref)) {
        const ing = ingredient.get(r.ingredient);
        if (!ing || ing.rate <= 0) continue;
        const qty = (Number(r.cost_per_use_inr) * 100) / ing.rate;
        if (!(qty > 0)) continue;
        await tx`insert into recipe_lines (menu_item_id, ingredient_id, quantity)
          values (${id}, ${ing.id}, ${qty.toFixed(3)})
          on conflict (menu_item_id, ingredient_id) do update set quantity = recipe_lines.quantity + excluded.quantity`;
        lines++;
      }
    }

    console.log(`seeded ${categoryOrder.length} categories, ${menu.length} items, ${addons.length} add-ons, ${ingredient.size} ingredients, ${lines} recipe lines`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
