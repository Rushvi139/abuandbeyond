"use client";

import { useState } from "react";
import { formatINR } from "@/lib/pricing";

/**
 * UPI payment flow for when Cashfree is not configured.
 *
 * Flow:
 *  1. Customer taps "Pay via UPI" → sees amount + UPI ID + "Open UPI App" button
 *  2. Customer opens their UPI app (GPay / PhonePe / Paytm etc), pays, comes back
 *  3. Customer taps "I've paid — Place my order" → order is placed as COD
 *
 * This keeps the order out of the kitchen until the customer says they've paid,
 * and fixes the ₹0 bug (cart is never cleared before the amount is shown).
 * No QR — customers can't scan their own screen.
 */
export function UpiPayButton({
  upiId,
  total,
  onPlace,
  disabled,
  busy,
}: {
  upiId: string;
  total: number;
  onPlace: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  const [step, setStep] = useState<"idle" | "pay">("idle");
  const [copied, setCopied] = useState(false);

  if (!upiId) return null;

  const amount = (total / 100).toFixed(2);
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Abu%26Beyond&am=${amount}&cu=INR&tn=Abu%26Beyond%20Order`;

  function copyUpi() {
    navigator.clipboard.writeText(upiId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStep("pay")}
        disabled={disabled || busy}
        className="flex h-[52px] w-full flex-col items-center justify-center rounded-[16px] border-2 border-ink disabled:opacity-50"
      >
        <span className="text-[15px] font-bold">
          Pay via UPI · {formatINR(total, { decimals: true })}
        </span>
        <span className="text-[11px] font-medium text-muted">GPay · PhonePe · Paytm · any UPI app</span>
      </button>
    );
  }

  // step === "pay"
  return (
    <div className="rounded-[18px] border-2 border-ink p-4">
      {/* Amount */}
      <div className="mb-4 text-center">
        <p className="text-[13px] text-muted">Pay this amount</p>
        <p className="text-[32px] font-bold leading-tight">₹{amount}</p>
      </div>

      {/* UPI ID copy row */}
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface px-4 py-3">
        <span className="flex-1 truncate font-mono text-[13px]">{upiId}</span>
        <button
          type="button"
          onClick={copyUpi}
          className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            copied ? "border-green-600 text-green-600" : "border-line text-ink"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Open UPI App deep link */}
      <a
        href={upiLink}
        className="mb-3 flex h-[48px] w-full items-center justify-center rounded-[14px] bg-clay text-[15px] font-bold text-paper"
      >
        Open UPI App
      </a>

      {/* After paying, place the order */}
      <button
        type="button"
        onClick={onPlace}
        disabled={busy}
        className="flex h-[48px] w-full items-center justify-center rounded-[14px] border-2 border-ink text-[14px] font-bold disabled:opacity-50"
      >
        {busy ? "Placing order…" : "I've paid — Place my order →"}
      </button>

      <p className="mt-3 text-center text-[11px] text-muted">
        Pay first, then tap the button above to confirm your order.
      </p>

      {/* Go back */}
      <button
        type="button"
        onClick={() => setStep("idle")}
        className="mt-2 w-full text-center text-[12px] text-muted underline-offset-2 hover:underline"
      >
        ← Back
      </button>
    </div>
  );
}
