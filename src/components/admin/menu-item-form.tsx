"use client";

import { useState, useTransition } from "react";
import { retireMenuItem, saveMenuItem } from "@/lib/admin/menu-actions";

export type EditableItem = {
  id: string; name: string; description: string | null; category: string; station: string; cuisine: string; isVeg: boolean;
  pricePaise: number; packagingPaise: number; options: string; addons: string; imagePath: string | null;
};

const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";

export function MenuItemForm({ item, categories }: { item?: EditableItem; categories: string[] }) {
  const [open, setOpen] = useState(!item);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (item && !open) return <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-lg bg-paper px-3 text-xs font-semibold">Edit</button>;

  return (
    <form
      action={async (fd) => { setErr(null); start(async () => { try { await saveMenuItem(fd); if (item) setOpen(false); else (document.getElementById("mform") as HTMLFormElement | null)?.reset(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save"); } }); }}
      id={item ? undefined : "mform"}
      className={`grid w-full gap-2 rounded-2xl bg-surface p-4 sm:grid-cols-2 ${item ? "mt-2 border border-line" : ""}`}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <input name="name" required defaultValue={item?.name} placeholder="Dish name" className={`${inp} sm:col-span-2`} />
      <input name="description" defaultValue={item?.description ?? ""} placeholder="One line about it (shows on the menu)" className={`${inp} sm:col-span-2`} />
      <input name="category" required list="cats" defaultValue={item?.category} placeholder="Category (pick or type a new one)" className={inp} />
      <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <select name="isVeg" defaultValue={item ? (item.isVeg ? "veg" : "nonveg") : "veg"} className={inp}><option value="veg">Veg</option><option value="nonveg">Non-veg</option></select>
      <label className="flex items-center gap-2 text-sm">₹ <input name="priceInr" type="number" step="1" min="1" required defaultValue={item ? item.pricePaise / 100 : ""} placeholder="Price on the menu" className={`${inp} flex-1`} /></label>
      <label className="flex items-center gap-2 text-sm">Pack ₹ <input name="packagingInr" type="number" step="0.1" min="0" defaultValue={item ? item.packagingPaise / 100 : 12} className={`${inp} flex-1`} /></label>
      <select name="station" defaultValue={item?.station ?? "wok_momos"} className={inp}>
        <option value="pizza_oven">Pizza & Oven</option><option value="wok_momos">Wok & Momos</option><option value="grill_rolls">Grill & Rolls</option><option value="fryer">Fryer</option><option value="cold_drinks">Cold & Drinks</option>
      </select>
      <select name="cuisine" defaultValue={item?.cuisine ?? "abu"} className={inp}>
        <option value="abu">ABU</option><option value="italy">ABU & ITALY</option><option value="mexico">ABU & MEXICO</option><option value="china">ABU & CHINA</option><option value="lebanon">ABU & LEBANON</option>
      </select>
      <input name="options" defaultValue={item?.options ?? ""} placeholder="Choice at order, e.g. Base: Fried rice | Noodles" className={`${inp} sm:col-span-2`} />
      <input name="addonNames" defaultValue={item?.addons ?? ""} placeholder="Add-ons, comma-separated: Extra cheese, Add egg" className={`${inp} sm:col-span-2`} />
      <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
        Photo (square, JPG/PNG/WebP, up to 8 MB)
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="text-xs" />
        {item?.imagePath && <span className="text-success">has photo</span>}
      </label>
      {err && <p className="text-xs font-semibold text-error sm:col-span-2">{err}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="h-10 flex-1 rounded-xl bg-ink text-sm font-semibold text-reversed disabled:opacity-50">{pending ? "Saving…" : item ? "Save changes" : "Add to menu"}</button>
        {item && <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted">Cancel</button>}
        {item && <button type="button" onClick={() => { if (confirm(`Remove ${item.name} from the menu?`)) start(() => retireMenuItem(item.id)); }} className="h-10 rounded-xl px-3 text-sm font-semibold text-error">Remove</button>}
      </div>
    </form>
  );
}
