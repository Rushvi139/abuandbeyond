"use client";

import { useState, useTransition } from "react";
import { setItemAvailability, setItemPrice } from "@/lib/crm/actions";
import { formatINR } from "@/lib/pricing";
import { VegMark } from "@/components/store/veg-mark";

type Item = { id: string; name: string; isVeg: boolean; pricePaise: number; available: boolean; priceStatus: string; foodCostPaise: number | null };

export function MenuRow({ item, canPrice }: { item: Item; canPrice: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(item.pricePaise / 100));
  const margin = item.foodCostPaise ? Math.round(((item.pricePaise - Number(item.foodCostPaise)) / item.pricePaise) * 100) : null;

  return (
    <div className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 ${pending ? "opacity-60" : ""}`}>
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
      <button type="button" role="switch" aria-checked={item.available} onClick={() => start(() => setItemAvailability(item.id, !item.available))} className={`relative h-7 w-12 flex-none rounded-full transition-colors ${item.available ? "bg-success" : "bg-line"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${item.available ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
