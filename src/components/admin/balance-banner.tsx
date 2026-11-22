"use client";

import { useState, useTransition } from "react";
import { collectBalance, settleRefund } from "@/lib/orders/edit";
import { formatINR } from "@/lib/pricing";

/**
 * After an edit on an order whose money was already taken: what is owed, and
 * the one tap that settles it. Extra is collected by whoever handles money at
 * the door; a refund is recorded by the owner or manager once it is sent.
 */
export function BalanceBanner({ orderId, balancePaise, role, dark = false }: { orderId: string; balancePaise: number; role: string; dark?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (!balancePaise) return null;
  const run = (f: () => Promise<{ error?: string }>) => start(async () => { setErr(null); const r = await f(); if (r.error) setErr(r.error); });
  const btn = `h-9 rounded-lg px-3 text-xs font-bold ${dark ? "bg-ink text-reversed" : "bg-ink text-reversed"}`;

  if (balancePaise > 0) {
    return (
      <div className={`flex flex-wrap items-center gap-2 rounded-xl bg-acid px-3 py-2 text-ink ${pending ? "opacity-60" : ""}`}>
        <p className="flex-1 text-[13px] font-bold uppercase tracking-wide">Order edited · collect {formatINR(balancePaise)} extra</p>
        {["owner", "manager", "rider"].includes(role) && (
          <>
            <button type="button" onClick={() => run(() => collectBalance(orderId, "cash"))} className={btn}>Got cash</button>
            <button type="button" onClick={() => run(() => collectBalance(orderId, "upi"))} className={btn}>Got UPI</button>
          </>
        )}
        {err && <p role="alert" className="w-full text-xs font-semibold text-error">{err}</p>}
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl bg-error px-3 py-2 text-reversed ${pending ? "opacity-60" : ""}`}>
      <p className="flex-1 text-[13px] font-bold uppercase tracking-wide">Order edited · refund {formatINR(-balancePaise)} to the guest</p>
      {["owner", "manager"].includes(role) && (
        <button type="button" onClick={() => run(() => settleRefund(orderId))} className="h-9 rounded-lg bg-surface px-3 text-xs font-bold text-ink">Refund done</button>
      )}
      {err && <p role="alert" className="w-full text-xs font-semibold">{err}</p>}
    </div>
  );
}
