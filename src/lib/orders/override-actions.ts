"use server";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextOpening } from "@/lib/hours";
import { revalidatePath } from "next/cache";

/**
 * "Kitchen forced open" lets guests order outside the regular hours.
 *
 * It ends by itself: at the start of the next regular shift (when it is no
 * longer needed), and never more than six hours after it was switched on —
 * so a toggle someone forgot at 3 AM does not keep taking orders nobody is
 * awake to cook. Stored as `{ "until": "<iso>" }`.
 */
const MAX_HOURS = 6;

export async function setKitchenOverride(on: boolean): Promise<void> {
  await requireRole(["owner", "manager"], "/admin");
  const now = new Date();
  const cap = new Date(now.getTime() + MAX_HOURS * 3600_000);
  const until = on ? new Date(Math.min(nextOpening(now).getTime(), cap.getTime())).toISOString() : null;
  const value = on ? { until } : false;
  await db()`
    insert into settings (key, value)
    values ('kitchen_override', ${JSON.stringify(value)}::jsonb)
    on conflict (key) do update set value = excluded.value
  `;
  revalidatePath("/kitchen");
  revalidatePath("/admin");
  revalidatePath("/checkout");
  revalidatePath("/");
}

/** When the override ends, or null if it is off (or has run out). */
export async function getKitchenOverrideUntil(): Promise<Date | null> {
  const [row] = await db()<{ value: unknown }[]>`select value from settings where key = 'kitchen_override'`;
  const v = row?.value as { until?: string } | boolean | undefined;
  if (v && typeof v === "object" && v.until) {
    const until = new Date(v.until);
    return until.getTime() > Date.now() ? until : null;
  }
  // A plain `true` was written before overrides expired. Treat it as off:
  // nobody can tell how long ago it was switched on.
  return null;
}

export async function getKitchenOverride(): Promise<boolean> {
  return (await getKitchenOverrideUntil()) !== null;
}

export async function setUpiId(upiId: string): Promise<void> {
  await requireRole(["owner", "manager"], "/admin");
  await db()`
    insert into settings (key, value)
    values ('upi_id', ${JSON.stringify(upiId)})
    on conflict (key) do update set value = excluded.value
  `;
  revalidatePath("/");
}

export async function getUpiId(): Promise<string> {
  const [row] = await db()<{ value: string }[]>`
    select value #>> '{}' as value from settings where key = 'upi_id'
  `;
  return row?.value ?? "";
}
