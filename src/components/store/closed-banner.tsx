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
    <div className="mx-5 mt-4 flex items-center gap-3 rounded-[18px] bg-ink px-4 py-3 text-reversed">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-acid text-[17px]" aria-hidden="true">
        ⏰
      </span>
      <p className="text-[14px] leading-snug">
        <b>Closed right now — but you can still order.</b>
        <br />
        <span className="opacity-80">Add what you want and pick a delivery time from {state.opensAt}.</span>
      </p>
    </div>
  );
}
