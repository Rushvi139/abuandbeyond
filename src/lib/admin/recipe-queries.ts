import "server-only";
import { db } from "@/lib/db";

/**
 * Costing follows the same rule as the menu screen: ingredients at their last
 * known rate, plus a kitchen loading percentage for gas, oil, trim and the
 * small things nobody weighs, plus packaging.
 */
export async function kitchenLoading() {
  const [row] = await db()<{ value: number }[]>`select value::int as value from settings where key = 'kitchen_loading_pct'`;
  return 1 + (row?.value ?? 15) / 100;
}

export type RecipeCard = {
  id: string;
  name: string;
  category: string;
  isVeg: boolean;
  pricePaise: number;
  packagingPaise: number;
  imagePath: string | null;
  photo: string | null;
  lines: number;
  ingredientPaise: number | null;
  hasMethod: boolean;
  sold30: number;
};

export async function recipeCards(): Promise<RecipeCard[]> {
  return db()<RecipeCard[]>`
    select m.id, m.name, c.name as category, m.is_veg as "isVeg",
      m.price_paise as "pricePaise", m.packaging_cost_paise as "packagingPaise", m.image_path as "imagePath",
      (select p.file_path from recipe_photos p where p.menu_item_id = m.id order by p.sort_order, p.created_at limit 1) as photo,
      (select count(*)::int from recipe_lines r where r.menu_item_id = m.id) as lines,
      (select sum(r.quantity * i.rate_paise_per_unit)::float from recipe_lines r join ingredients i on i.id = r.ingredient_id where r.menu_item_id = m.id) as "ingredientPaise",
      coalesce((select length(coalesce(rc.method, '')) > 0 from recipes rc where rc.menu_item_id = m.id), false) as "hasMethod",
      coalesce((
        select sum(oi.quantity)::int from order_items oi join orders o on o.id = oi.order_id
        where oi.menu_item_id = m.id and not o.is_demo and o.status not in ('pending_payment','payment_failed','cancelled')
          and o.created_at > now() - interval '30 days'), 0) as "sold30"
    from menu_items m join categories c on c.id = m.category_id
    where m.active
    order by c.sort_order, m.sort_order`;
}

export type RecipeLine = {
  ingredientId: string;
  name: string;
  unit: string;
  group: string | null;
  quantity: number;
  ratePaisePerUnit: number;
  onHand: number;
};

export type RecipeDetail = {
  id: string;
  name: string;
  category: string;
  isVeg: boolean;
  description: string | null;
  pricePaise: number;
  packagingPaise: number;
  imagePath: string | null;
  method: string | null;
  chefNotes: string | null;
  prepMinutes: number | null;
  yieldNote: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  sold30: number;
};

export async function recipeDetail(id: string) {
  const sql = db();
  const [dish] = await sql<RecipeDetail[]>`
    select m.id, m.name, c.name as category, m.is_veg as "isVeg", m.description,
      m.price_paise as "pricePaise", m.packaging_cost_paise as "packagingPaise", m.image_path as "imagePath",
      r.method, r.chef_notes as "chefNotes", r.prep_minutes as "prepMinutes", r.yield_note as "yieldNote",
      r.updated_at as "updatedAt", u.full_name as "updatedBy",
      coalesce((
        select sum(oi.quantity)::int from order_items oi join orders o on o.id = oi.order_id
        where oi.menu_item_id = m.id and not o.is_demo and o.status not in ('pending_payment','payment_failed','cancelled')
          and o.created_at > now() - interval '30 days'), 0) as "sold30"
    from menu_items m
    join categories c on c.id = m.category_id
    left join recipes r on r.menu_item_id = m.id
    left join staff_users u on u.id = r.updated_by
    where m.id = ${id}`;
  if (!dish) return null;

  const lines = await sql<RecipeLine[]>`
    select i.id as "ingredientId", i.name, i.unit, i.procurement_group as "group",
      r.quantity::float as quantity, i.rate_paise_per_unit::float as "ratePaisePerUnit",
      coalesce(s.on_hand, 0)::float as "onHand"
    from recipe_lines r
    join ingredients i on i.id = r.ingredient_id
    left join stock_on_hand s on s.ingredient_id = i.id
    where r.menu_item_id = ${id}
    order by i.procurement_group nulls last, i.name`;

  const photos = await sql<{ id: string; filePath: string; caption: string | null }[]>`
    select id, file_path as "filePath", caption from recipe_photos where menu_item_id = ${id} order by sort_order, created_at`;

  const pantry = await sql<{ id: string; name: string; unit: string }[]>`
    select id, name, unit from ingredients where active order by name`;

  return { dish, lines, photos, pantry };
}

export type IndentRow = {
  ingredientId: string;
  name: string;
  unit: string;
  group: string | null;
  usedPerMonth: number;
  onHand: number;
  reorder: number;
  ratePaisePerUnit: number;
};

/**
 * What the last 30 days of real orders actually ate, by ingredient. This is the
 * bridge from the recipe book to the indent: what we sold times what each dish
 * uses, set against what is on the shelf.
 */
export async function indentFromSales(): Promise<IndentRow[]> {
  return db()<IndentRow[]>`
    with sold as (
      select oi.menu_item_id, sum(oi.quantity)::int as qty
      from order_items oi join orders o on o.id = oi.order_id
      where o.status not in ('pending_payment','payment_failed','cancelled') and not o.is_demo
        and o.created_at > now() - interval '30 days'
      group by 1
    )
    select i.id as "ingredientId", i.name, i.unit, i.procurement_group as "group",
      sum(r.quantity * sold.qty)::float as "usedPerMonth",
      coalesce(max(s.on_hand), 0)::float as "onHand",
      max(i.reorder_level)::float as reorder,
      max(i.rate_paise_per_unit)::float as "ratePaisePerUnit"
    from sold
    join recipe_lines r on r.menu_item_id = sold.menu_item_id
    join ingredients i on i.id = r.ingredient_id
    left join stock_on_hand s on s.ingredient_id = i.id
    where i.active
    group by i.id, i.name, i.unit, i.procurement_group
    order by sum(r.quantity * sold.qty) * max(i.rate_paise_per_unit) desc`;
}
