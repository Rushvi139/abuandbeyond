"use server";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function setKitchenOverride(on: boolean): Promise<void> {
  await requireRole(["owner", "manager"], "/admin");
  await db()`
    insert into settings (key, value)
    values ('kitchen_override', ${JSON.stringify(on)})
    on conflict (key) do update set value = excluded.value
  `;
  revalidatePath("/kitchen");
  revalidatePath("/admin");
}

export async function getKitchenOverride(): Promise<boolean> {
  const [row] = await db()<{ value: boolean }[]>`
    select value::boolean as value from settings where key = 'kitchen_override'
  `;
  return row?.value === true;
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
