"use client";

import { useEffect, useState } from "react";
import { REFUSE_ORDERS_WHEN_CLOSED, hoursLine, serviceState } from "@/lib/hours";

/**
 * Whether the kitchen is open, re-checked each minute.
 *
 * `null` until the client has checked. Callers treat null as open, because a
 * page that renders a Pay button greyed out for a moment on every load is
 * worse than one that briefly offers it — and the server refuses a closed
 * order regardless, which is the guard that actually counts.
 */
export function useServiceOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => setOpen(serviceState().open);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return open;
}

export function ClosedNotice() {
  const [state, setState] = useState<ReturnType<typeof serviceState> | null>(null);
  useEffect(() => {
    const tick = () => setState(serviceState());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!REFUSE_ORDERS_WHEN_CLOSED || !state || state.open) return null;

  return (
    <div className="mt-5 rounded-[18px] bg-ink p-4 text-reversed">
      <p className="font-display text-[20px] uppercase leading-none">The kitchen is closed</p>
      <p className="mt-1.5 text-[15px]">
        We open at <b>{state.opensAt}</b>. Build your order now and it will be here waiting — we just can&apos;t take payment
        until the pans are on.
      </p>
      <p className="mt-1 text-[13px] opacity-70">We cook {hoursLine()}.</p>
    </div>
  );
}
