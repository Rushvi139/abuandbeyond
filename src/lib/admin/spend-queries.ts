import "server-only";
import { db } from "@/lib/db";
import type { RecentList, SpendCategory, SpendIngredient } from "@/components/admin/spend-form";

/** Everything the one spend form needs, for every page that shows it. */
export async function spendFormData() {
  const sql = db();
  const [categories, vendors, ingredients, staff, recentRows] = await Promise.all([
    sql<SpendCategory[]>`select id, name, has_items as "hasItems" from expense_categories where active order by sort_order, name`,
    sql<{ name: string }[]>`select name from vendors where active order by name`,
    sql<SpendIngredient[]>`select id, name, unit::text as unit, rate_paise_per_unit::float as "ratePaisePerUnit" from ingredients where active order by name`,
    sql<{ name: string }[]>`select full_name as name from staff_users where active order by full_name`,
    // The last few itemised purchases, so a daily market run can be repeated
    // and only the quantities and prices changed.
    sql<{ grp: string; paidTo: string | null; on: string; ingredientId: string | null; name: string; qty: number; unit: string | null; amount: number }[]>`
      with recent as (
        select coalesce(l.expense_id, l.vendor_bill_id)::text as grp, max(l.created_at) as at
        from spend_lines l group by 1 order by 2 desc limit 8
      )
      select r.grp, v.name as "paidTo", coalesce(e.spent_on, b.bill_date)::text as on,
        l.ingredient_id as "ingredientId", l.item_name as name, l.quantity::float as qty, i.unit::text as unit, l.amount_paise::bigint as amount
      from recent r
      join spend_lines l on coalesce(l.expense_id, l.vendor_bill_id)::text = r.grp
      left join expenses e on e.id = l.expense_id
      left join vendor_bills b on b.id = l.vendor_bill_id
      left join vendors v on v.id = coalesce(e.vendor_id, b.vendor_id)
      left join ingredients i on i.id = l.ingredient_id
      order by r.at desc, l.created_at`,
  ]);

  const recent: RecentList[] = [];
  for (const r of recentRows) {
    let g = recent.find((x) => (x as RecentList & { grp?: string }).grp === r.grp) as (RecentList & { grp?: string }) | undefined;
    if (!g) {
      g = { grp: r.grp, paidTo: r.paidTo ?? "", on: r.on, lines: [] };
      recent.push(g);
    }
    const shown = r.unit === "g" || r.unit === "ml" ? r.qty / 1000 : r.qty;
    g.lines.push({ ingredientId: r.ingredientId, name: r.name, qty: Math.round(shown * 1000) / 1000, amountInr: Number(r.amount) / 100 });
  }

  return { categories, vendors: vendors.map((v) => v.name), ingredients, staffNames: staff.map((s) => s.name), recent };
}
