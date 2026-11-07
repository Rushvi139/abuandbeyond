"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type CartLine = {
  key: string; // itemId + chosen options + addons
  itemId: string;
  name: string;
  isVeg: boolean;
  unitPaise: number; // base price + option deltas + addons, before GST
  qty: number;
  options: { group: string; name: string; deltaPaise: number; optionId: string }[];
  addons: { name: string; pricePaise: number; addonId: string }[];
  note?: string;
};

const KEY = "ab_cart_v1";

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function save(lines: CartLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode etc. — cart just lives in memory */
  }
}

export function lineKey(itemId: string, optionIds: string[], addonIds: string[], note?: string) {
  return [itemId, ...optionIds.sort(), "+", ...addonIds.sort(), note ? "#" + note : ""].join("|");
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(load());
    setReady(true);
  }, []);

  const update = useCallback((fn: (prev: CartLine[]) => CartLine[]) => {
    setLines((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const add = useCallback(
    (line: Omit<CartLine, "qty">, qty = 1) =>
      update((prev) => {
        const i = prev.findIndex((l) => l.key === line.key);
        if (i >= 0) return prev.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
        return [...prev, { ...line, qty }];
      }),
    [update],
  );

  const setQty = useCallback(
    (key: string, qty: number) =>
      update((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l)))),
    [update],
  );

  const clear = useCallback(() => update(() => []), [update]);

  const totals = useMemo(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotalPaise = lines.reduce((n, l) => n + l.unitPaise * l.qty, 0);
    return { count, subtotalPaise };
  }, [lines]);

  const qtyOfItem = useCallback((itemId: string) => lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0), [lines]);

  return { lines, ready, add, setQty, clear, qtyOfItem, ...totals };
}
