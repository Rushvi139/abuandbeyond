"use client";

import { useState } from "react";

/**
 * Hand an unfinished payment back to the guest.
 *
 * There is no sender wired up yet, so this copies the link for someone to
 * paste into WhatsApp. The link is the guest's own order page, not the raw
 * Cashfree session: the page survives, knows whether the money has since
 * arrived, and can offer the payment again.
 */
export function PaymentLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/o/${code}`;

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link:", url);
        }
      }}
      className="h-10 rounded-xl border-[1.5px] border-ink px-3 text-xs font-bold uppercase"
    >
      {copied ? "Copied" : "Copy pay link"}
    </button>
  );
}
