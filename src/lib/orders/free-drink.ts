import { db } from "@/lib/db";
import type { FreeDrink } from "./free-drink-rule";

export { earnsFreeDrink, type FreeDrink } from "./free-drink-rule";

/**
 * "Free iced tea on orders above ₹699." The threshold lives in settings
 * (`free_drink_min_paise`); 0 or missing means the offer is off. The drinks
 * offered are whatever is live in the Iced Tea category, so the guest picks a
 * real dish and it reaches the kitchen like any other line, at ₹0.
 */
export async function getFreeDrink(): Promise<FreeDrink> {
  try {
    const sql = db();
    const [row] = await sql<{ value: unknown }[]>`select value from settings where key = 'free_drink_min_paise'`;
    const minPaise = Number(row?.value) || 0;
    if (!minPaise) return { minPaise: 0, choices: [] };
    const choices = await sql<{ id: string; name: string }[]>`
      select m.id, m.name from menu_items m join categories c on c.id = m.category_id
      where c.slug = 'iced-tea' and c.active and m.active and m.available
      order by m.sort_order, m.name`;
    return { minPaise: choices.length ? minPaise : 0, choices };
  } catch {
    return { minPaise: 0, choices: [] };
  }
}

