"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/pricing";

/**
 * The way back into a payment someone walked away from.
 *
 * Their order already exists and the session is still ours, so this reopens
 * the same Cashfree checkout rather than making them build the basket again.
 * Nothing here decides whether the money arrived: that is `verify`, server
 * side, as everywhere else.
 */
export function ResumePayment({
  code,
  amountPaise,
  paymentSessionId,
  mode,
}: {
  code: string;
  amountPaise: number;
  paymentSessionId: string;
  mode: "sandbox" | "production";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!window.Cashfree) throw new Error("Payment page didn't load. Check your connection and try again.");
      const result = await window.Cashfree({ mode }).checkout({ paymentSessionId, redirectTarget: "_modal" });
      if (result?.error) {
        setError("Payment wasn't completed. You can try again.");
        setBusy(false);
        return;
      }
      const v = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const vj = await v.json();
      if (vj.ok && vj.data?.status === "paid") router.refresh();
      else {
        setError("We haven't seen the payment yet. If money left your account, message us and we'll sort it.");
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open payment.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-5 mt-4">
      <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" />
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
