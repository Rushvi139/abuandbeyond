"use server";

import { parse } from "csv-parse/sync";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Loads the Mount Abu sweep. The CSV comes from `mount_abu_full_sweep.py`,
 * which walks Google Places over the plateau; its columns are
 *   name, place_id, lat, lng, zone, km_from_kitchen, address, phone, types
 * and anything else in the file is ignored, so the file can grow columns
 * without this breaking.
 *
 * Keyed on place_id, so re-running the sweep updates rows rather than
 * duplicating them — but a row's `note`, `property_id` and `active` flag are
 * ours, set by hand here, and an import never overwrites them.
 */

/**
 * The sweep has been exported under more than one set of column names, and a
 * mismatch is silent in the worst way: the file imports, but with no place_id
 * every later re-sweep duplicates the plateau instead of updating it. So the
 * obvious synonyms are accepted rather than demanding the file be renamed.
 */
const ALIASES: Record<string, string> = {
  google_place_id: "place_id", placeid: "place_id", place: "place_id",
  area: "address", formatted_address: "address", vicinity: "address",
  type: "types", kind: "types", kinds: "types", category: "types",
  latitude: "lat", longitude: "lng", lon: "lng", long: "lng",
  km: "km_from_kitchen", distance_km: "km_from_kitchen", km_from_kitchen_road: "km_from_kitchen",
  phone_number: "phone", contact: "phone", title: "name",
};

/** Lower-cases headers and maps the synonyms onto the names the schema knows. */
function normalise(r: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    const key = k.trim().toLowerCase().replace(/\s+/g, "_");
    const mapped = ALIASES[key] ?? key;
    // A real column always beats an alias, so a file carrying both keeps the
    // canonical one.
    if (out[mapped] === undefined || out[mapped] === "") out[mapped] = v;
  }
  return out;
}
const Row = z.object({
  name: z.string().trim().min(1).max(200),
  place_id: z.string().trim().max(200).optional().default(""),
  lat: z.coerce.number().min(-90).max(90).nullable().catch(null),
  lng: z.coerce.number().min(-180).max(180).nullable().catch(null),
  zone: z.string().trim().max(60).optional().default(""),
  km_from_kitchen: z.coerce.number().min(0).max(200).nullable().catch(null),
  address: z.string().trim().max(400).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  types: z.string().trim().max(300).optional().default(""),
});

export type ImportResult = { rowsInFile: number; inserted: number; updated: number; skipped: number; problems: string[] };

export async function importStays(csvText: string, fileName: string): Promise<ImportResult> {
  const staff = await assertRole(MANAGERS);

  let raw: Record<string, string>[];
  try {
    raw = parse(csvText.replace(/^﻿/, ""), { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  } catch {
    return { rowsInFile: 0, inserted: 0, updated: 0, skipped: 0, problems: ["That file didn't parse as CSV. Export it again from the sweep."] };
  }
  if (raw.length === 0) return { rowsInFile: 0, inserted: 0, updated: 0, skipped: 0, problems: ["The file has no rows."] };
  raw = raw.map(normalise);
  if (!("name" in raw[0])) return { rowsInFile: raw.length, inserted: 0, updated: 0, skipped: raw.length, problems: [`No "name" column — found: ${Object.keys(raw[0]).slice(0, 8).join(", ")}`] };

  const problems: string[] = [];
  const clean = raw.flatMap((r, i) => {
    const parsed = Row.safeParse(r);
    if (!parsed.success) {
      if (problems.length < 5) problems.push(`Row ${i + 2}: ${parsed.error.issues[0]?.message ?? "could not be read"}`);
      return [];
    }
    return [parsed.data];
  });

  // One statement per row, inside a transaction, so a bad row can't leave the
  // table half-loaded. A few hundred rows is nothing for Postgres.
  let inserted = 0;
  let updated = 0;
  await db().begin(async (tx) => {
    for (const r of clean) {
      const placeId = r.place_id || null;
      const [row] = placeId
        ? await tx<{ isNew: boolean }[]>`
            insert into stays (place_id, name, lat, lng, zone, km_from_kitchen, address, phone, kinds)
            values (${placeId}, ${r.name}, ${r.lat}, ${r.lng}, ${r.zone || null}, ${r.km_from_kitchen}, ${r.address || null}, ${r.phone || null}, ${r.types || null})
            on conflict (place_id) do update set
              name = excluded.name, lat = excluded.lat, lng = excluded.lng, zone = excluded.zone,
              km_from_kitchen = excluded.km_from_kitchen, address = excluded.address,
              phone = coalesce(excluded.phone, stays.phone), kinds = excluded.kinds, updated_at = now()
            returning (xmax = 0) as "isNew"`
        : await tx<{ isNew: boolean }[]>`
            insert into stays (name, lat, lng, zone, km_from_kitchen, address, phone, kinds)
            values (${r.name}, ${r.lat}, ${r.lng}, ${r.zone || null}, ${r.km_from_kitchen}, ${r.address || null}, ${r.phone || null}, ${r.types || null})
            on conflict (lower(name), coalesce(zone, '')) where place_id is null do update set
              lat = excluded.lat, lng = excluded.lng, km_from_kitchen = excluded.km_from_kitchen,
              address = excluded.address, phone = coalesce(excluded.phone, stays.phone), updated_at = now()
            returning (xmax = 0) as "isNew"`;
      if (row?.isNew) inserted += 1;
      else updated += 1;
    }
    await tx`insert into stay_imports (file_name, rows_in_file, inserted, updated, skipped, actor_id)
      values (${fileName.slice(0, 200)}, ${raw.length}, ${inserted}, ${updated}, ${raw.length - clean.length}, ${staff.id})`;
  });

  revalidatePath("/admin/stays");
  revalidatePath("/rider/stays");
  return { rowsInFile: raw.length, inserted, updated, skipped: raw.length - clean.length, problems };
}

/** Rider's note on a gate — "blue gate past the dhaba", "call from the kiosk". */
export async function setStayNote(id: string, note: string) {
  await assertRole(["owner", "manager", "rider"]);
  await db()`update stays set note = ${note.trim().slice(0, 300) || null}, updated_at = now() where id = ${z.string().uuid().parse(id)}`;
  revalidatePath("/rider/stays");
  revalidatePath("/admin/stays");
}

export async function setStayActive(id: string, active: boolean) {
  await assertRole(MANAGERS);
  await db()`update stays set active = ${active}, updated_at = now() where id = ${z.string().uuid().parse(id)}`;
  revalidatePath("/admin/stays");
  revalidatePath("/rider/stays");
}

export async function deleteStay(id: string) {
  await assertRole(["owner"]);
  await db()`delete from stays where id = ${z.string().uuid().parse(id)}`;
  revalidatePath("/admin/stays");
  revalidatePath("/rider/stays");
}
