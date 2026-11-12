"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

const STATUSES = ["new", "quoted", "confirmed", "closed"] as const;

export async function setCateringStatus(id: string, status: string) {
  await assertRole(MANAGERS);
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) throw new Error("bad status");
  await db()`update catering_enquiries set status = ${status} where id = ${id}`;
  revalidatePath("/admin/catering");
}

export async function updateCateringEnquiry(id: string, formData: FormData) {
  await assertRole(MANAGERS);
  const d = z.object({
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(20).optional().or(z.literal("")),
    occasion: z.string().trim().max(100).optional().or(z.literal("")),
    guests: z.coerce.number().int().min(1).max(5000).optional().or(z.literal("")),
    eventOn: z.string().optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  }).parse(Object.fromEntries(formData));
  await db()`
    update catering_enquiries set
      name = ${d.name},
      phone = ${d.phone || null},
      occasion = ${d.occasion || null},
      guests = ${d.guests ? Number(d.guests) : null},
      event_on = ${d.eventOn || null},
      notes = ${d.notes || null}
    where id = ${id}`;
  revalidatePath("/admin/catering");
}
