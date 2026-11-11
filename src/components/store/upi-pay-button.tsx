"use client";

import { useState } from "react";
import { formatINR } from "@/lib/pricing";

/**
 * Passive UPI info card — shown alongside the Pay on Delivery button.
 * No order placement here. Customer can:
 *   1. Copy the UPI ID, open GPay / PhonePe etc., pay, then place the order as COD.
 *   2. Ignore it and pay the rider at delivery (rider carries a QR).
 */
export function UpiInfoCard({
  upiId,
  totalPaise,
}: {
  upiId: string;
  totalPaise: number;
}) {
  const [copied, setCopied] = useState(false);

  if (!upiId) return null;

  const amount = (totalPaise / 100).toFixed(2);

  function copyUpi() {
    navigator.clipboard.writeText(upiId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-[18px] border-2 border-line bg-surface p-4">
      {/* Header */}
      <p className="mb-3 text-center text-[13px] font-semibold text-muted">
        Pay via UPI (optional)
      </p>

      {/* Amount */}
      <div className="mb-4 text-center">
        <p className="text-[11px] text-muted">Amount to pay</p>
        <p className="text-[28px] font-bold leading-tight">
          {formatINR(totalPaise, { decimals: true })}
        </p>
      </div>

      {/* UPI ID copy row */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-3">
        <span className="flex-1 truncate font-mono text-[13px] text-ink">
          {upiId}
        </span>
        <button
          type="button"
          onClick={copyUpi}
          className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            copied
              ? "border-green-600 text-green-600"
              : "border-line text-ink hover:bg-surface"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Instructions */}
      <p className="text-center text-[12px] leading-relaxed text-muted">
        Copy the UPI ID and pay via GPay, PhonePe, or any UPI app.
        <br />
        Or simply pay at delivery — your rider will have a QR.
      </p>
    </div>
  );
}
