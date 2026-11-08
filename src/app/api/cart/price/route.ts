import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.number().int().min(1).max(20),
        optionIds: z.array(z.string().uuid()).max(5).default([]),
        addonIds: z.array(z.string().uuid()).max(5).default([]),
        note: z.string().trim().max(120).nullish(),
      }),
    )
    .min(1)
    .max(30),
});

/** Re-prices a past order at today's menu so "order it again" can fill the cart. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  const sql = db();
  const itemIds = [...new Set(parsed.data.lines.map((l) => l.itemId))];
  const items = await sql<{ id: string; name: string; is_veg: boolean; price_paise: number }[]>`
    select id, name, is_veg, price_paise from menu_items where id in ${sql(itemIds)} and active and available`;
  const byId = new Map(items.map((i) => [i.id, i]));

  const optIds = [...new Set(parsed.data.lines.flatMap((l) => l.optionIds))];
  const opts = optIds.length
    ? await sql<{ id: string; name: string; price_delta_paise: number; group_name: string }[]>`
        select o.id, o.name, o.price_delta_paise, g.name as group_name
        from options o join option_groups g on g.id = o.option_group_id where o.id in ${sql(optIds)} and o.active`
    : [];
  const addIds = [...new Set(parsed.data.lines.flatMap((l) => l.addonIds))];
  const adds = addIds.length
    ? await sql<{ id: string; name: string; price_paise: number }[]>`select id, name, price_paise from addons where id in ${sql(addIds)} and active`
    : [];

  const lines = [];
  const dropped: string[] = [];
  for (const l of parsed.data.lines) {
    const item = byId.get(l.itemId);
    if (!item) continue; // off the menu today
    const options = l.optionIds.map((id) => opts.find((o) => o.id === id)).filter(Boolean) as typeof opts;
    const addons = l.addonIds.map((id) => adds.find((a) => a.id === id)).filter(Boolean) as typeof adds;
    if (options.length !== l.optionIds.length || addons.length !== l.addonIds.length) dropped.push(item.name);
    const unitPaise =
      item.price_paise + options.reduce((n, o) => n + o.price_delta_paise, 0) + addons.reduce((n, a) => n + a.price_paise, 0);
    lines.push({
      key: [l.itemId, ...options.map((o) => o.id).sort(), "+", ...addons.map((a) => a.id).sort(), l.note ? "#" + l.note : ""].join("|"),
      itemId: item.id,
      name: item.name,
      isVeg: item.is_veg,
      unitPaise,
      qty: l.qty,
      options: options.map((o) => ({ group: o.group_name, name: o.name, deltaPaise: o.price_delta_paise, optionId: o.id })),
      addons: addons.map((a) => ({ name: a.name, pricePaise: a.price_paise, addonId: a.id })),
      ...(l.note ? { note: l.note } : {}),
    });
  }
  const missing = parsed.data.lines.length - lines.length;
  return NextResponse.json({ ok: true, data: { lines, missing, dropped } });
}
