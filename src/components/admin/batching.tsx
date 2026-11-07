"use client";

import { useEffect, useState } from "react";
import type { OrderView } from "@/lib/orders/queries";

const KEY = "ab_kitchen_batching";
const STATIONS: Record<string, string> = { pizza_oven: "Pizza & Oven", wok_momos: "Wok & Momos", grill_rolls: "Grill & Rolls", fryer: "Fryer", cold_drinks: "Cold & Drinks" };

/**
 * Cook-together suggestions: looks across every live ticket and groups identical dishes
 * (same item + same choices), so the cook fires one batch instead of repeating a dish per ticket.
 * Deterministic rules, no external AI call: same dish across ≥2 tickets, or ≥3 of one dish anywhere.
 */
export function Batching({ orders }: { orders: OrderView[] }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) !== "0"); } catch { setOn(true); }
  }, []);
  const toggle = () => {
    const v = !on;
    setOn(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {}
  };

  type Group = { key: string; name: string; variant: string; station: string; qty: number; tickets: { number: number; qty: number; status: string }[] };
  const groups = new Map<string, Group>();
  for (const o of orders) {
    if (!["paid", "accepted", "preparing"].includes(o.status)) continue;
    for (const l of o.lines) {
      const variant = l.options.join(", ");
      const key = `${l.name}|${variant}`;
      const g = groups.get(key) ?? { key, name: l.name, variant, station: l.stationId, qty: 0, tickets: [] };
      g.qty += l.qty;
      const t = g.tickets.find((x) => x.number === o.number);
      if (t) t.qty += l.qty; else g.tickets.push({ number: o.number, qty: l.qty, status: o.status });
      groups.set(key, g);
    }
  }
  const suggestions = [...groups.values()].filter((g) => g.tickets.length >= 2 || g.qty >= 3).sort((a, b) => b.qty - a.qty || b.tickets.length - a.tickets.length);
  const byStation = new Map<string, Group[]>();
  for (const s of suggestions) byStation.set(s.station, [...(byStation.get(s.station) ?? []), s]);

  return (
    <div className="mb-4">
      <button type="button" role="switch" aria-checked={on} onClick={toggle} className={`flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold ${on ? "bg-acid text-ink" : "bg-paper/15 text-reversed"}`}>
        <span className={`relative h-5 w-9 rounded-full ${on ? "bg-ink" : "bg-paper/40"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-all ${on ? "left-4" : "left-0.5"}`} /></span>
        AI batching {on ? "on" : "off"}
      </button>
      {on && (
        <div className="mt-3 rounded-2xl border border-acid/40 bg-paper/5 p-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-kraft">No batching right now. Suggestions appear when the same dish is on two or more tickets.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {[...byStation.entries()].map(([station, list]) => (
                <div key={station} className="rounded-xl bg-ink/60 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-kraft">{STATIONS[station] ?? station}</div>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {list.map((g) => (
                      <li key={g.key} className="text-sm">
                        <span className="font-display text-[20px] text-acid">{g.qty}×</span> <span className="font-semibold">{g.name}</span>{g.variant && <span className="text-kraft"> · {g.variant}</span>}
                        <div className="text-xs text-kraft">
                          {g.tickets.map((t) => `#${t.number} ×${t.qty}${t.status === "paid" ? " (new)" : ""}`).join(" + ")} → cook {g.qty} together
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
