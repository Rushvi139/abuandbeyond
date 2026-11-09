"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Claims the right to print one ticket. The update only matches while
 * kot_printed_at is still null, so of two kitchen tablets watching the same
 * order, exactly one gets a row back and exactly one sheet comes out.
 */
export async function claimKot(orderId: string): Promise<{ mine: boolean }> {
  await assertRole(["owner", "manager", "kitchen"]);
  if (!z.string().uuid().safeParse(orderId).success) return { mine: false };
  const rows = await db()<{ id: string }[]>`
    update orders set kot_printed_at = now()
    where id = ${orderId} and kot_printed_at is null
    returning id`;
  return { mine: rows.length > 0 };
}
