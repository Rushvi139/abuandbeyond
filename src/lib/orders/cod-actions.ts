"use server";

import { revalidatePath } from "next/cache";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Turn "pay the rider at the door" on or off for the storefront.
 *
 * Only has an effect once the gateway works: with no gateway, cash is the
 * only way to order, so `codAllowed` keeps it on whatever this says.
 */
export async function setCodEnabled(on: boolean): Promise<void> {
  await assertRole(MANAGERS);
  await db()`
    insert into settings (key, value) values ('cod_enabled', ${on}::text::jsonb)
    on conflict (key) do update set value = excluded.value`;
  revalidatePath("/checkout");
  revalidatePath("/admin");
}
