"use client";

import { useEffect, useState } from "react";
import { REFUSE_ORDERS_WHEN_CLOSED, serviceState } from "@/lib/hours";
import { useForcedOpen } from "@/components/store/service-gate";

/**
 * "Closed" on its own reads as "come back later", and the guest leaves. Most
 * of our evening trade is people deciding at 5pm what they want at 8, so the
 * banner has to say the shut door is not the end of it.
 *
 * Rendered on the client and re-checked each minute for the same reason the
 * badge is: this page is cached, and a banner that says "closed" at 7:05pm
 * costs us the order it was meant to save.
 */
export function ClosedBanner() {
  const [state, setState] = useState<ReturnType<typeof serviceState> | null>(null);
  const forcedOpen = useForcedOpen();

  useEffect(() => {
    const tick = () => setState(serviceState());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!REFUSE_ORDERS_WHEN_CLOSED || !state || state.open || forcedOpen) return null;

  return (
    <section role="status" className="mx-5 mt-4 overflow-hidden rounded-[22px] bg-ink px-5 py-5 text-reversed">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-kraft">Kitchen closed right now</p>
      <h2 className="mt-1.5 font-display text-[34px] uppercase leading-[0.92]">
        Orders for now
        <br />
        <span className="text-acid">are paused</span>
      </h2>
      <p className="mt-3 text-[15px] leading-snug">
        You can&apos;t place an order for right now. You <b>can</b> schedule one: add what you want and pick a delivery time{state.opensAt ? <> from <b>{state.opensAt}</b></> : null}.
      </p>
      {state.opensAt && (
        <span className="mt-3.5 inline-flex h-9 items-center gap-2 rounded-full bg-acid px-3.5 text-[13px] font-bold text-ink">
          <span aria-hidden="true">⏰</span> Opens {state.opensAt}
        </span>
      )}
    </section>
  );
}
