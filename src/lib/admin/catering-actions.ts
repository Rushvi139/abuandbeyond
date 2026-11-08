"use server";

import { revalidatePath } from "next/cache";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

const STATUSES = ["new", "quoted", "confirmed", "closed"] as const;

export async function setCateringStatus(id: string, status: string) {
  await assertRole(MANAGERS);
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) throw new Error("bad status");
  await db()`update catering_enquiries set status = ${status} where id = ${id}`;
  revalidatePath("/admin/catering");
}
