"use client";

import { useState, useTransition } from "react";
import { retireMenuItem, saveMenuItem } from "@/lib/admin/menu-actions";

export type EditableItem = {
  id: string; name: string; description: string | null; category: string; station: string; cuisine: string; isVeg: boolean;
  pricePaise: number; packagingPaise: number; options: string; addonIds: string[]; imagePath: string | null;
};

export type AddonChoice = { id: string; name: string; pricePaise: number; isVeg: boolean };

const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";

export function MenuItemForm({ item, categories, addons = [] }: { item?: EditableItem; categories: string[]; addons?: AddonChoice[] }) {
  const [open, setOpen] = useState(!item);
  const [picked, setPicked] = useState<string[]>(item?.addonIds ?? []);
  const [veg, setVeg] = useState(item ? item.isVeg : true);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (item && !open) return <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-lg bg-paper px-3 text-xs font-semibold">Edit</button>;

  return (
    <form
      action={async (fd) => { setErr(null); start(async () => { try { const r = await saveMenuItem(fd); if (r.error) { setErr(r.error); return; } if (item) setOpen(false); else (document.getElementById("mform") as HTMLFormElement | null)?.reset(); } catch { setErr("Couldn't save. Check your connection and try again."); } }); }}
      id={item ? undefined : "mform"}
      className={`grid w-full gap-2 rounded-2xl bg-surface p-4 sm:grid-cols-2 ${item ? "mt-2 border border-line" : ""}`}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <input name="name" required defaultValue={item?.name} placeholder="Dish name" className={`${inp} sm:col-span-2`} />
      <input name="description" defaultValue={item?.description ?? ""} placeholder="One line about it (shows on the menu)" className={`${inp} sm:col-span-2`} />
      <input name="category" required list="cats" defaultValue={item?.category} placeholder="Category (pick or type a new one)" className={inp} />
      <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <select name="isVeg" value={veg ? "veg" : "nonveg"} onChange={(e) => setVeg(e.target.value === "veg")} className={inp}><option value="veg">Veg</option><option value="nonveg">Non-veg</option></select>
      <label className="flex items-center gap-2 text-sm">₹ <input name="priceInr" type="number" step="1" min="1" required defaultValue={item ? item.pricePaise / 100 : ""} placeholder="Price on the menu" className={`${inp} flex-1`} /></label>
      <label className="flex items-center gap-2 text-sm">Pack ₹ <input name="packagingInr" type="number" step="0.1" min="0" defaultValue={item ? item.packagingPaise / 100 : 12} className={`${inp} flex-1`} /></label>
      <select name="station" defaultValue={item?.station ?? "wok_momos"} className={inp}>
        <option value="pizza_oven">Pizza & Oven</option><option value="wok_momos">Wok & Momos</option><option value="grill_rolls">Grill & Rolls</option><option value="fryer">Fryer</option><option value="cold_drinks">Cold & Drinks</option>
      </select>
      <select name="cuisine" defaultValue={item?.cuisine ?? "abu"} className={inp}>
        <option value="abu">ABU</option><option value="italy">ABU & ITALY</option><option value="mexico">ABU & MEXICO</option><option value="china">ABU & CHINA</option><option value="lebanon">ABU & LEBANON</option>
      </select>
      <input name="options" defaultValue={item?.options ?? ""} placeholder="Choice at order, e.g. Base: Fried rice | Noodles" className={`${inp} sm:col-span-2`} />
      {/* Sent back untouched so the server only rewrites choices you actually changed:
          a pizza's half & half choices carry prices this one-line box can't show. */}
      <input type="hidden" name="optionsOriginal" value={item?.options ?? ""} />
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-xs font-semibold text-muted">
          Add-ons guests can tick on this dish {picked.length > 0 && <span className="text-ink">· {picked.length} picked</span>}
        </legend>
        <input type="hidden" name="addonsSent" value="1" />
        {addons.length === 0 ? (
          <p className="text-xs text-muted">No add-ons yet. Make them in the Add-ons tab (+ Add-on at the top).</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {addons.map((a) => {
              const on = picked.includes(a.id);
              const clash = veg && !a.isVeg;
              return (
                <label key={a.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-ink bg-ink text-reversed" : "border-line bg-paper"} ${clash && !on ? "opacity-40" : ""}`}>
                  <input type="checkbox" name="addonIds" value={a.id} checked={on} onChange={() => toggle(a.id)} className="sr-only" />
                  <span className={`h-2 w-2 rounded-full ${a.isVeg ? "bg-veg" : "bg-error"}`} aria-hidden="true" />
                  {a.name} <span className={on ? "text-kraft" : "text-muted"}>+₹{a.pricePaise / 100}</span>
                </label>
              );
            })}
          </div>
        )}
        {veg && addons.some((a) => !a.isVeg && picked.includes(a.id)) && (
          <p className="mt-1 text-xs text-muted">A non-veg add-on is ticked: a guest who picks it gets a non-veg dish.</p>
        )}
      </fieldset>
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
