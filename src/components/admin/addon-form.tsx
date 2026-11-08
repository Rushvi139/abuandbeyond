"use client";

import { useState } from "react";
import { retireAddon, saveAddon } from "@/lib/admin/menu-actions";
import { formatINR } from "@/lib/pricing";

export type Addon = { id: string; name: string; pricePaise: number; isVeg: boolean; usedBy: number };

const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";

export function AddonForm({ addon }: { addon?: Addon }) {
  const [open, setOpen] = useState(!addon);
  if (addon && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-xl border border-ink px-3 text-xs font-semibold">
        Edit
      </button>
    );
  }
  return (
    <form action={saveAddon} className="grid gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-[1fr_7rem_7rem_auto]">
      {addon && <input type="hidden" name="id" value={addon.id} />}
      <input name="name" defaultValue={addon?.name} required placeholder="Add-on name, e.g. Extra cheese" className={inp} />
      <input name="priceInr" type="number" step="1" min="0" defaultValue={addon ? addon.pricePaise / 100 : ""} required placeholder="₹" className={inp} />
      <select name="isVeg" defaultValue={addon?.isVeg === false ? "nonveg" : "veg"} className={inp}>
        <option value="veg">Veg</option>
        <option value="nonveg">Non-veg</option>
      </select>
      <div className="flex gap-2">
        <button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Save</button>
        {addon && (
          <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-sm text-muted">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function AddonRow({ addon }: { addon: Addon }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <span className={`h-2.5 w-2.5 flex-none rounded-full ${addon.isVeg ? "bg-veg" : "bg-error"}`} aria-hidden="true" />
      <span className="font-semibold">{addon.name}</span>
      <span className="text-muted">{formatINR(addon.pricePaise)}</span>
      <span className="text-xs text-muted">{addon.usedBy} dish{addon.usedBy === 1 ? "" : "es"}</span>
      <span className="ml-auto flex items-center gap-2">
        <AddonForm addon={addon} />
        <form action={retireAddon.bind(null, addon.id)}>
          <button className="h-9 rounded-xl px-3 text-xs font-semibold text-error">Remove</button>
        </form>
      </span>
    </div>
  );
}
