"use client";

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
