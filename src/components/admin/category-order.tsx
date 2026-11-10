"use client";

import { useTransition } from "react";
import { moveCategory } from "@/lib/admin/menu-actions";

/**
 * The order of the sections on the guest menu, top to bottom. Arrows move a
 * category one place; the guest menu follows straight away.
 */
export function CategoryOrder({ categories }: { categories: { id: string; name: string; count: number }[] }) {
  const [pending, start] = useTransition();
  const move = (id: string, d: "up" | "down") => start(async () => { await moveCategory(id, d); });
  return (
    <ol className={`overflow-hidden rounded-2xl bg-surface ${pending ? "opacity-60" : ""}`}>
      {categories.map((c, i) => (
        <li key={c.id} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-0">
          <span className="w-5 text-sm font-bold text-muted">{i + 1}</span>
          <span className="flex-1 text-sm font-semibold">{c.name}</span>
          <span className="text-xs text-muted">{c.count} dish{c.count === 1 ? "" : "es"}</span>
          <button type="button" disabled={pending || i === 0} onClick={() => move(c.id, "up")} aria-label={`Move ${c.name} up`}
            className="h-9 w-9 rounded-lg bg-paper text-base font-bold disabled:opacity-30">↑</button>
          <button type="button" disabled={pending || i === categories.length - 1} onClick={() => move(c.id, "down")} aria-label={`Move ${c.name} down`}
            className="h-9 w-9 rounded-lg bg-paper text-base font-bold disabled:opacity-30">↓</button>
        </li>
      ))}
    </ol>
  );
}
