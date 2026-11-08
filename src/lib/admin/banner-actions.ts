"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/files";

const BannerSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2).max(60),
  subtitle: z.string().trim().max(120).optional().or(z.literal("")),
  linkUrl: z.string().trim().max(200).optional().or(z.literal("")),
  tone: z.enum(["clay", "acid", "hill", "ink", "kraft"]).default("clay"),
  placement: z.enum(["card", "ribbon"]).default("card"),
  motif: z.enum(["none", "lights", "paws"]).default("none"),
  ctaLabel: z.string().trim().max(20).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(100),
  startsOn: z.string().trim().optional().or(z.literal("")),
  endsOn: z.string().trim().optional().or(z.literal("")),
});

/** Banners run across the top of the menu: an offer, a new dish, a festival special. */
export async function saveBanner(formData: FormData) {
  await assertRole(MANAGERS);
  const d = BannerSchema.parse(Object.fromEntries(formData));
  const photo = formData.get("image");
  const imagePath = photo instanceof File && photo.size > 0 ? "/files/" + (await saveUpload(photo, "menu")) : null;
  const sql = db();
  const starts = d.startsOn || null;
  const ends = d.endsOn || null;
  if (d.id) {
    await sql`update banners set title = ${d.title}, subtitle = ${d.subtitle || null}, link_url = ${d.linkUrl || null},
      tone = ${d.tone}, placement = ${d.placement}, motif = ${d.motif}, cta_label = ${d.ctaLabel || null},
      sort_order = ${d.sortOrder}, starts_on = ${starts}, ends_on = ${ends},
      image_path = coalesce(${imagePath}, image_path) where id = ${d.id}`;
  } else {
    await sql`insert into banners (title, subtitle, link_url, tone, placement, motif, cta_label, sort_order, starts_on, ends_on, image_path)
      values (${d.title}, ${d.subtitle || null}, ${d.linkUrl || null}, ${d.tone}, ${d.placement}, ${d.motif}, ${d.ctaLabel || null}, ${d.sortOrder}, ${starts}, ${ends}, ${imagePath})`;
  }
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

export async function retireBanner(id: string) {
  await assertRole(MANAGERS);
  await db()`update banners set active = false where id = ${id}`;
  revalidatePath("/admin/menu");
  revalidatePath("/");
}
