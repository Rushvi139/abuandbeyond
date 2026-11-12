"use client";

import { useState } from "react";
import { formatINR } from "@/lib/pricing";
import { payExistingOrder } from "@/lib/payments/payu-client";

/**
 * The way back into a payment someone walked away from.
 *
 * Their order already exists, so this opens a fresh PayU attempt on it
 * rather than making them build the basket again. Nothing here decides
 * whether the money arrived: that is settled server-side when PayU sends
 * them back, as everywhere else.
 */
export function ResumePayment({ code, amountPaise }: { code: string; amountPaise: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await payExistingOrder(code); // navigates away on success
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open payment.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-5 mt-4">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex h-[60px] w-full flex-col items-center justify-center rounded-[18px] bg-clay text-ink disabled:opacity-50"
      >
        <span className="text-[17px] font-bold">{busy ? "Opening payment…" : `Pay ${formatINR(amountPaise, { decimals: true })} now`}</span>
        <span className="text-xs font-medium">Your order is held — finish paying and the kitchen starts</span>
      </button>
      {error && <p role="alert" className="mt-3 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>}
    </div>
  );
}
