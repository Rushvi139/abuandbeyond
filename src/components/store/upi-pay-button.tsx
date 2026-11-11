"use client";

import { useState } from "react";
import { formatINR } from "@/lib/pricing";

/**
 * UPI deep-link / QR fallback when Cashfree is not configured.
 *
 * Opens the customer's UPI app via the standard upi:// scheme (works on
 * Android; on iOS it falls back to showing a QR the customer can scan from
 * another device). The order is placed as COD (pay on delivery) so it reaches
 * the kitchen immediately; staff confirm payment receipt from the admin panel.
 */
export function UpiPayButton({
  upiId,
  total,
  orderId,
  onPlace,
  disabled,
  busy,
}: {
  upiId: string;
  total: number;
  orderId?: string;
  onPlace: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  const [showQr, setShowQr] = useState(false);

  if (!upiId) return null;

  const amount = (total / 100).toFixed(2);
  const tn = orderId ? `Abu%26Beyond%20Order%20${orderId}` : "Abu%26Beyond%20Order";
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Abu%26Beyond&am=${amount}&cu=INR&tn=${tn}`;

  return (
    <div className="mt-2">
      {!showQr ? (
        <button
          type="button"
          onClick={() => {
            onPlace();          // place as COD — kitchen gets the ticket
            setShowQr(true);    // then show payment QR
          }}
          disabled={disabled || busy}
          className="flex h-[52px] w-full flex-col items-center justify-center rounded-[16px] border-2 border-ink disabled:opacity-50"
        >
          <span className="text-[15px] font-bold">
            {busy ? "Placing order…" : `Scan & Pay · ${formatINR(total, { decimals: true })}`}
          </span>
          <span className="text-[11px] font-medium text-muted">Pay via any UPI app</span>
        </button>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-[18px] border-2 border-ink p-4">
          <p className="text-sm font-semibold">Order placed! Now pay via UPI</p>
          {/* QR via Google Charts API — no server needed */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(upiLink)}&choe=UTF-8`}
            alt="Scan to pay via UPI"
            width={200}
            height={200}
            className="rounded-lg"
          />
          <a
            href={upiLink}
            className="flex h-11 w-full items-center justify-center rounded-[14px] bg-clay text-sm font-bold text-ink"
          >
            Open UPI App
          </a>
          <p className="text-center text-xs text-muted">
            UPI ID: <span className="font-mono font-semibold text-ink">{upiId}</span>
            <br />Amount: <span className="font-semibold text-ink">₹{amount}</span>
          </p>
        </div>
      )}
    </div>
  );
}
