"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CartLine } from "@/hooks/use-cart";

type PastItem = { itemId: string | null; name: string; qty: number; optionIds: string[]; addonIds: string[]; note: string | null };

/** Fills the cart with a past order, re-priced at today's menu, and goes to checkout. */
export function Reorder({ items }: { items: PastItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setMsg(null);
    const lines = items
      .filter((i) => i.itemId)
      .map((i) => ({ itemId: i.itemId, qty: i.qty, optionIds: (i.optionIds ?? []).filter(Boolean), addonIds: (i.addonIds ?? []).filter(Boolean), note: i.note }));
    const res = await fetch("/api/cart/price", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!res?.ok || !res.data.lines.length) return setMsg("Those dishes aren't on today's menu.");
    try {
      const existing: CartLine[] = JSON.parse(localStorage.getItem("ab_cart_v1") ?? "[]");
      const merged = [...existing];
      for (const l of res.data.lines as CartLine[]) {
        const at = merged.findIndex((m) => m.key === l.key);
        if (at >= 0) merged[at] = { ...merged[at], qty: merged[at].qty + l.qty };
        else merged.push(l);
      }
      localStorage.setItem("ab_cart_v1", JSON.stringify(merged));
    } catch {
      return setMsg("Your browser is blocking storage, so the cart can't be filled.");
    }
    router.push("/checkout");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={go} disabled={busy} className="h-10 rounded-full border-[1.5px] border-ink px-4 text-[13px] font-bold tracking-wide disabled:opacity-50">
        {busy ? "ADDING…" : "ORDER AGAIN"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
