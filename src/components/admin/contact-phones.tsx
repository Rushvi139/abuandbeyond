"use client";

import { useState } from "react";

/**
 * The guest's numbers, always in plain sight on an order: readable and
 * selectable (a desktop has no phone to "Call" with), one tap to copy, one to
 * open WhatsApp (web or desktop app), and Call for whoever is on a phone.
 * The alternate number the guest gave sits right under it.
 */
export function ContactPhones({ phone, altPhone, orderNumber, dark = false }: { phone: string; altPhone?: string | null; orderNumber: number; dark?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-xl px-3 py-2 ${dark ? "bg-paper/10" : "bg-paper"}`}>
      <PhoneRow label="Guest" phone={phone} orderNumber={orderNumber} dark={dark} />
      {altPhone && altPhone !== phone && <PhoneRow label="2nd no." phone={altPhone} orderNumber={orderNumber} dark={dark} />}
    </div>
  );
}

const pretty = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
};

function PhoneRow({ label, phone, orderNumber, dark }: { label: string; phone: string; orderNumber: number; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  const digits = phone.replace(/\D/g, "");
  const intl = digits.length === 10 ? "91" + digits : digits;
  const chip = `flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold ${dark ? "bg-paper/15" : "bg-surface border border-line"}`;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className={`w-14 flex-none text-[11px] font-bold uppercase tracking-wide ${dark ? "text-kraft" : "text-muted"}`}>{label}</span>
      <span className="select-all font-display text-[19px] leading-none tracking-wide tabular-nums">{pretty(phone)}</span>
      <span className="ml-auto flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(digits.slice(-10)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
          }}
          className={chip}
          aria-label={`Copy ${label} number`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={`https://wa.me/${intl}?text=${encodeURIComponent(`Hi! This is Abu & Beyond about your order #${orderNumber}.`)}`}
          target="_blank"
          rel="noreferrer"
          className={chip}
        >
          WhatsApp
        </a>
        <a href={`tel:+${intl}`} className={chip}>Call</a>
      </span>
    </div>
  );
}
