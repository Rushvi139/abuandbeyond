"use client";

import { useState, useTransition } from "react";
import { setItemAvailability, setItemPrice } from "@/lib/crm/actions";
import { restoreMenuItem, retireMenuItem } from "@/lib/admin/menu-actions";
import { formatINR } from "@/lib/pricing";
import { VegMark } from "@/components/store/veg-mark";

type Item = { id: string; name: string; isVeg: boolean; pricePaise: number; available: boolean; active?: boolean; priceStatus: string; foodCostPaise: number | null; imagePath?: string | null };

export function MenuRow({ item, canPrice, edit }: { item: Item; canPrice: boolean; edit?: React.ReactNode }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(item.pricePaise / 100));
  const margin = item.foodCostPaise ? Math.round(((item.pricePaise - Number(item.foodCostPaise)) / item.pricePaise) * 100) : null;

  return (
    <div className={`px-4 py-2.5 ${pending ? "opacity-60" : ""}`}>
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.imagePath ? <img src={item.imagePath} alt="" className="h-9 w-9 flex-none rounded-lg object-cover" /> : <span className="h-9 w-9 flex-none rounded-lg bg-paper" />}
      <VegMark veg={item.isVeg} />
      <span className={`flex-1 text-sm font-semibold ${item.available ? "" : "text-muted line-through"}`}>{item.name}</span>
      {item.priceStatus !== "costed" && <span className="rounded-full bg-acid px-2 py-0.5 text-[10px] font-bold uppercase">{item.priceStatus === "new" ? "price provisional" : "recipe matched"}</span>}
      {margin !== null && <span className={`text-xs ${margin < 60 ? "font-bold text-error" : "text-muted"}`}>{margin}% GM</span>}
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); start(async () => { await setItemPrice(item.id, Math.round(Number(price) * 100)); setEditing(false); }); }} className="flex items-center gap-1">
          <span className="text-sm">₹</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="h-8 w-20 rounded-lg border border-line bg-paper px-2 text-sm" autoFocus />
          <button className="h-8 rounded-lg bg-ink px-2 text-xs font-semibold text-reversed">Save</button>
        </form>
      ) : (
        <button type="button" onClick={() => canPrice && setEditing(true)} className="w-16 text-right text-sm font-bold">{formatINR(item.pricePaise)}</button>
      )}
      {/* Two different "off" switches, which is why both are spelled out.
          In stock / Sold out is today's kitchen: it hides the dish from the
          live menu and is flipped back the next morning. Remove takes it off
          the menu for the season but keeps the dish, its recipe and its
          history, so it can be put back. */}
      <span className={`hidden w-14 flex-none text-right text-[11px] font-semibold sm:block ${item.available ? "text-success" : "text-muted"}`}>
        {item.available ? "In stock" : "Sold out"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={item.available}
        aria-label={`${item.name} — ${item.available ? "in stock, tap to mark sold out" : "sold out, tap to put back in stock"}`}
        title={item.available ? "In stock. Tap to mark sold out." : "Sold out. Tap to put back in stock."}
        onClick={() => start(() => setItemAvailability(item.id, !item.available))}
        className={`relative h-7 w-12 flex-none rounded-full transition-colors ${item.available ? "bg-success" : "bg-line"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${item.available ? "left-6" : "left-1"}`} />
      </button>
      {edit}
      <button
        type="button"
        title="Take off the live menu. The dish, its recipe and its history are kept."
        onClick={() => {
          if (confirm(`Take ${item.name} off the live menu?\n\nIt keeps its recipe and past orders, and you can put it back any time from "Off the menu" at the bottom of this page.`))
            start(() => retireMenuItem(item.id));
        }}
        className="h-8 flex-none rounded-lg px-2 text-xs font-semibold text-muted hover:text-error"
      >
        Remove
      </button>
    </div>
    </div>
  );
}

/** A dish that is off the live menu but still ours. */
export function RetiredRow({ item }: { item: Item }) {
  const [pending, start] = useTransition();
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${pending ? "opacity-60" : ""}`}>
      <VegMark veg={item.isVeg} />
      <span className="flex-1 text-sm font-semibold text-muted">{item.name}</span>
      <span className="text-sm text-muted">{formatINR(item.pricePaise)}</span>
      <button
        type="button"
        onClick={() => start(() => restoreMenuItem(item.id))}
        className="h-8 flex-none rounded-lg bg-ink px-3 text-xs font-semibold text-reversed"
      >
        {pending ? "…" : "Put back"}
      </button>
    </div>
  );
}
