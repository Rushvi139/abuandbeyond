"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

const Id = z.string().uuid();
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export async function updateCustomer(id: string, data: { name?: string; tags?: string[]; notes?: string; whatsappOptIn?: boolean }) {
  await assertRole(MANAGERS);
  const d = z.object({ name: z.string().trim().max(80).optional(), tags: z.array(z.string().trim().min(1).max(20)).max(10).optional(), notes: z.string().max(1000).optional(), whatsappOptIn: z.boolean().optional() }).parse(data);
  await db()`update customers set
      name = coalesce(${d.name ?? null}, name),
      tags = coalesce(${d.tags ?? null}, tags),
      notes = coalesce(${d.notes ?? null}, notes),
      whatsapp_opt_in = coalesce(${d.whatsappOptIn ?? null}, whatsapp_opt_in)
    where id = ${Id.parse(id)}`;
  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/admin/customers");
}

const PropertySchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["hotel", "villa", "homestay", "home", "other"]),
  contactPerson: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function saveProperty(formData: FormData) {
  await assertRole(MANAGERS);
  const id = formData.get("id") ? Id.parse(formData.get("id")) : null;
  const d = PropertySchema.parse(Object.fromEntries(formData));
  if (id) {
    await db()`update properties set name = ${d.name}, kind = ${d.kind}, contact_person = ${d.contactPerson || null}, phone = ${d.phone || null}, address = ${d.address || null}, notes = ${d.notes || null} where id = ${id}`;
  } else {
    let slug = slugify(d.name) || "property";
    const [clash] = await db()<{ n: number }[]>`select count(*)::int as n from properties where slug = ${slug}`;
    if (clash.n) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    await db()`insert into properties (slug, name, kind, contact_person, phone, address, notes) values (${slug}, ${d.name}, ${d.kind}, ${d.contactPerson || null}, ${d.phone || null}, ${d.address || null}, ${d.notes || null})`;
  }
  revalidatePath("/admin/properties");
}

export async function toggleProperty(id: string, active: boolean) {
  await assertRole(MANAGERS);
  await db()`update properties set active = ${active} where id = ${Id.parse(id)}`;
  revalidatePath("/admin/properties");
}

export async function deleteProperty(id: string) {
  await assertRole(["owner"]);
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from orders where property_id = ${Id.parse(id)}`;
  if (n > 0) throw new Error(`Cannot delete — this property has ${n} order${n === 1 ? "" : "s"} linked to it. Deactivate it instead.`);
  await sql`delete from properties where id = ${Id.parse(id)}`;
  revalidatePath("/admin/properties");
}

export async function setItemAvailability(itemId: string, available: boolean) {
  await assertRole(["owner", "manager", "kitchen"]);
  await db()`update menu_items set available = ${available} where id = ${Id.parse(itemId)}`;
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

export async function setItemPrice(itemId: string, pricePaise: number) {
  await assertRole(MANAGERS);
  await db()`update menu_items set price_paise = ${z.number().int().min(100).max(500000).parse(pricePaise)} where id = ${Id.parse(itemId)}`;
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

export async function saveSocialLinks(formData: FormData) {
  await assertRole(["owner"]);
  const d = z.object({
    instagram: z.string().trim().max(200),
    google_review: z.string().trim().max(300),
    whatsapp: z.string().trim().max(20),
    email: z.string().trim().max(120).optional().or(z.literal("")),
  }).parse(Object.fromEntries(formData));
  await db()`insert into settings (key, value) values ('social_links', ${JSON.stringify({
    instagram: d.instagram || null,
    google_review: d.google_review || null,
    whatsapp: d.whatsapp || null,
    email: d.email || null,
  })}::jsonb)
    on conflict (key) do update set value = excluded.value`;
  revalidatePath("/admin/menu");
  revalidatePath("/wall");
  revalidatePath("/support");
}
