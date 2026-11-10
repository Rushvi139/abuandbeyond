"use client";

import { useState, useTransition } from "react";
import { markCollected } from "@/lib/orders/collect";
import { formatINR } from "@/lib/pricing";

/**
 * The rider's "I have the money" button, on a pay-on-delivery order.
 *
 * Asks cash or UPI rather than assuming, because the day's cash count only
 * balances if the two are told apart. Loud on purpose: a rider who forgets to
 * collect has given away the food.
 */
export function CollectButton({ orderId, amountPaise, collected }: { orderId: string; amountPaise: number; collected: boolean }) {
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (collected) {
    return (
      <span className="rounded-xl bg-success px-3 py-1.5 text-xs font-bold uppercase text-reversed">Collected</span>
    );
  }

  const take = (method: "cash" | "upi") =>
    start(async () => {
      setErr(null);
      const r = await markCollected(orderId, method).catch(() => ({ error: "Didn't save." }));
      if (r?.error) setErr(r.error);
      else setAsking(false);
    });

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="rounded-xl bg-acid px-3 py-2 text-sm font-bold uppercase text-ink"
      >
        Collect {formatINR(amountPaise)}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold">Took</span>
      <button type="button" disabled={pending} onClick={() => take("cash")} className="rounded-lg bg-success px-2.5 py-1.5 text-xs font-bold text-reversed disabled:opacity-50">
        Cash
      </button>
      <button type="button" disabled={pending} onClick={() => take("upi")} className="rounded-lg bg-success px-2.5 py-1.5 text-xs font-bold text-reversed disabled:opacity-50">
        UPI
      </button>
      <button type="button" onClick={() => setAsking(false)} className="px-1 text-xs text-muted">
        Cancel
      </button>
      {err && <span className="w-full text-xs font-semibold text-error">{err}</span>}
    </span>
  );
}
