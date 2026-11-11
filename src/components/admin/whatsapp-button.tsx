"use client";

import { useState } from "react";

/**
 * Message the guest from whatever phone the staff member is holding.
 *
 * A click-to-chat link, not the API: it opens WhatsApp with the text ready
 * and a person presses send. That is allowed on an ordinary WhatsApp account,
 * needs no Meta approval, and works tonight — which matters, because the
 * Cloud API needs a business verification and template review first.
 *
 * Once the API is live the automatic messages cover the usual path and this
 * stays for the awkward ones: running late, can't find the gate, the paneer
 * is off.
 */
export function WhatsAppButton({
  phone,
  text,
  label = "WhatsApp",
  dark = false,
}: {
  phone: string;
  text: string;
  label?: string;
  dark?: boolean;
}) {
  const to = phone.replace(/\D/g, "");
  if (!to) return null;
  return (
    <a
      href={`https://wa.me/${to}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`h-10 rounded-xl px-3 text-xs font-semibold leading-10 ${dark ? "bg-paper/15" : "bg-paper"}`}
    >
      {label}
    </a>
  );
}

/**
 * Copies a pre-written WhatsApp message to the clipboard so the owner can
 * paste it into the WhatsApp app on their own phone/PC.
 *
 * Used for the order-confirmation message on new orders: tap once → paste in
 * WhatsApp → send. No Cloud API, no Meta approval, works immediately.
 */
export function CopyWhatsAppButton({
  phone,
  text,
  label = "Copy WA msg",
  dark = false,
}: {
  phone: string;
  text: string;
  label?: string;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!phone) return null;

  async function copy() {
    try {
      // Include the number at the top so the owner can tap-to-open WA
      const full = `wa.me/${phone.replace(/\D/g, "")}\n\n${text}`;
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: open wa.me link directly
      window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`h-10 rounded-xl px-3 text-xs font-semibold transition-colors ${
        copied
          ? "bg-success text-reversed"
          : dark
          ? "bg-paper/15 text-reversed"
          : "bg-paper text-ink"
      }`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
